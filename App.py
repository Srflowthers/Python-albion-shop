import os
import sys

# Activar reconocimiento de DPI para evitar descuadres en capturas con escalado de Windows (ej. 125%, 150%)
if sys.platform == 'win32':
    try:
        import ctypes
        ctypes.windll.user32.SetProcessDPIAware()
    except Exception as e:
        print(f"Error setting DPI awareness: {e}")

import json
import requests
import webview
import unicodedata
import difflib
import threading
import time
import asyncio
import pygetwindow as gw
from PIL import Image, ImageGrab

try:
    import winrt.windows.media.ocr as ocr
    from winrt.windows.graphics.imaging import SoftwareBitmap, BitmapPixelFormat, BitmapAlphaMode
    import winrt.windows.storage.streams as streams
    WINRT_OCR_AVAILABLE = True
except Exception:
    WINRT_OCR_AVAILABLE = False

ITEMS_URL = "https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json"
ITEMS_FALLBACK_URL = "https://cdn.jsdelivr.net/gh/ao-data/ao-bin-dumps@master/formatted/items.json"

def get_cache_path():
    if sys.platform == 'win32':
        app_data = os.environ.get('LOCALAPPDATA') or os.environ.get('APPDATA') or os.path.expanduser('~')
        dir_path = os.path.join(app_data, 'AlbionMarket')
    else:
        dir_path = os.path.expanduser('~/.albionmarket')
    
    try:
        os.makedirs(dir_path, exist_ok=True)
    except Exception:
        # Fallback absolute path in user home directory which is always writable
        home_dir = os.path.expanduser('~')
        dir_path = os.path.join(home_dir, '.albionmarket')
        try:
            os.makedirs(dir_path, exist_ok=True)
        except Exception:
            return os.path.join(home_dir, "items_cache.json")
        
    return os.path.join(dir_path, "items_cache.json")

CACHE_FILE = get_cache_path()
CACHE_DIR = os.path.dirname(CACHE_FILE)
ZONES_FILE = os.path.join(CACHE_DIR, "zones_db.json")
RECENT_ZONES_FILE = os.path.join(CACHE_DIR, "recent_zones.json")

def log_ocr(message):
    try:
        log_file = os.path.join(CACHE_DIR, "ocr_log.txt")
        if os.path.exists(log_file) and os.path.getsize(log_file) > 1024 * 1024:
            with open(log_file, "w", encoding="utf-8") as f:
                f.write("[LOG ROTATED]\n")
        with open(log_file, "a", encoding="utf-8") as f:
            timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
            f.write(f"[{timestamp}] {message}\n")
    except Exception:
        pass

def normalize(text):
    if not text:
        return ""
    text = text.lower()
    nfkd_form = unicodedata.normalize('NFKD', text)
    text = "".join([c for c in nfkd_form if not unicodedata.combining(c)])
    return " ".join(text.split())

def is_blacklisted(zone_name):
    if not zone_name:
        return False
    blacklist = ["bridgewatch", "martlock", "thetford", "lymhurst", "fort sterling", "caerleon", "brecilien"]
    return normalize(zone_name) in blacklist

def calculate_score(query, target):
    q = normalize(query)
    t = normalize(target)
    if not q or not t:
        return 0
        
    # Enforce that short queries (length < 3) must match the start of at least one token/word
    if len(q) < 3:
        tokens = t.replace("_", " ").split()
        if not any(token.startswith(q) for token in tokens):
            return 0.0
    
    # 1. Exact match
    if q == t:
        return 100.0
        
    # 2. Substring match (contiguous phrase)
    if q in t:
        if t.startswith(q):
            return 85.0 + (len(q) / len(t)) * 15.0
        else:
            return 70.0 + (len(q) / len(t)) * 15.0 - (t.find(q) / len(t)) * 5.0
            
    # 3. Word-by-word fuzzy match (to handle minor typos or different word orders)
    q_words = q.split()
    t_words = t.split()
    word_scores = []
    
    for qw in q_words:
        best_word_score = 0
        for tw in t_words:
            if qw == tw:
                score = 100.0
            elif (qw in tw or tw in qw) and len(qw) > 1 and len(tw) > 1:
                intersection_len = min(len(qw), len(tw))
                union_len = max(len(qw), len(tw))
                score = 60.0 + (intersection_len / union_len) * 40.0
            else:
                ratio = difflib.SequenceMatcher(None, qw, tw).ratio()
                if ratio >= 0.6:
                    score = ratio * 80.0
                else:
                    score = 0.0
            if score > best_word_score:
                best_word_score = score
        word_scores.append(best_word_score)
        
    if word_scores:
        avg_word_score = sum(word_scores) / len(word_scores)
        # Global string similarity bonus
        global_ratio = difflib.SequenceMatcher(None, q, t).ratio()
        return avg_word_score * 0.85 + global_ratio * 15.0
        
    return 0

def clean_base_name(name):
    if not name:
        return ""
    es_suffixes = [
        " del iniciado", " del experto", " del maestro", " del gran maestro", " del anciano",
        " del principiante", " del novato", " del obrero",
        " de iniciado", " de experto", " de maestro", " de gran maestro", " de anciano",
        " de principiante", " de novato", " de obrero"
    ]
    en_prefixes = [
        "beginner's ", "novice's ", "journeyman's ", "adept's ", "expert's ", "master's ", "grandmaster's ", "elder's "
    ]
    
    # Clean Spanish suffixes
    lower_name = name.lower()
    for suffix in es_suffixes:
        if lower_name.endswith(suffix):
            name = name[:-len(suffix)]
            break
            
    # Clean English prefixes
    lower_name = name.lower()
    for prefix in en_prefixes:
        if lower_name.startswith(prefix):
            name = name[len(prefix):]
            break
            
    return name.strip()

class AlbionAPI:
    def __init__(self):
        self._window = None
        self.items = []
        self.item_map = {}
        self.item_names = []
        self.id_name_map = {}
        self.image_cache = {}
        self.categorias = {
            "1": ("Armas", ["Espada", "Hacha", "Maza", "Martillo", "Arco", "Ballesta", "Bastón", "Daga", "Guanteletes", "Brazalete", "Lanza", "Vara"]),
            "2": ("Armaduras / Pechos", ["Armadura", "Chaqueta", "Toga"]),
            "3": ("Cascos / Cabezas", ["Casco", "Capucha", "Hábito"]),
            "4": ("Botas / Pies", ["Zapatos", "Botas", "Sandalias"]),
            "5": ("Accesorios", ["Capa", "Bolsa"]),
            "8": ("Artefactos", ["Runa", "Alma", "Reliquia"])
        }
        self.zones = []
        self.recent_zones = []
        self.loadZonesDatabase()
        
        # OCR States
        self.ocr_thread = None
        self.ocr_running = False
        self.last_detected_map = ""

    def set_window(self, window):
        self._window = window

    def getItemImageBase64(self, item_id):
        if item_id in self.image_cache:
            return {"success": True, "base64": self.image_cache[item_id]}
        import base64
        import requests
        try:
            url = f"https://render.albiononline.com/v1/item/{item_id}.png"
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                encoded = base64.b64encode(response.content).decode('utf-8')
                base64_str = f"data:image/png;base64,{encoded}"
                self.image_cache[item_id] = base64_str
                return {"success": True, "base64": base64_str}
            else:
                return {"success": False, "error": f"HTTP status {response.status_code}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def saveScreenshot(self, base64_image, filename):
        import base64
        import webview
        try:
            if "," in base64_image:
                base64_image = base64_image.split(",", 1)[1]
            image_data = base64.b64decode(base64_image)
            
            win = self._window or (webview.windows[0] if webview.windows else None)
            if win:
                save_path = win.create_file_dialog(
                    webview.SAVE_DIALOG,
                    directory="",
                    save_filename=filename,
                    file_types=("Imágenes PNG (*.png)", "Todos los archivos (*.*)")
                )
                if save_path:
                    if isinstance(save_path, list) or isinstance(save_path, tuple):
                        save_path = save_path[0]
                    if save_path and not save_path.lower().endswith(".png"):
                        save_path += ".png"
                    
                    with open(save_path, "wb") as f:
                        f.write(image_data)
                    return {"success": True, "saved_path": save_path}
            return {"success": False, "error": "Cancelado."}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def loadDatabase(self):
        try:
            # Intentar cargar desde el caché local primero
            if os.path.exists(CACHE_FILE):
                try:
                    with open(CACHE_FILE, "r", encoding="utf-8") as f:
                        self.items = json.load(f)
                    
                    # Pre-procesar el mapa de nombres para búsquedas rápidas
                    self._build_item_maps_cached()
                    return {"success": True, "cached": True}
                except Exception as e:
                    print(f"Error al leer caché, descargando de nuevo: {e}")
            
            # Descargar si no está en caché o falló la lectura
            response = None
            try:
                response = requests.get(ITEMS_URL, timeout=45)
                response.raise_for_status()
            except Exception as e:
                print(f"Error al descargar de la URL principal ({e}). Reintentando con SSL relajado...")
                try:
                    import urllib3
                    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
                    response = requests.get(ITEMS_URL, timeout=45, verify=False)
                    response.raise_for_status()
                except Exception as e_ssl:
                    raise Exception(f"No se pudo descargar la base de datos de ítems. Principal: {e}. SSL-relajado: {e_ssl}")
            
            self.items = response.json()
            
            # Guardar en caché
            with open(CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(self.items, f, ensure_ascii=False, indent=2)
                
            self._build_item_maps_cached()
            return {"success": True, "cached": False}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def classify_item_universal(self, unique_name):
        if not unique_name:
            return "OTROS (ECONOMÍA Y MISCELÁNEOS)", "Otros"
        uname = unique_name.upper()
        
        # 8. COSMÉTICOS (VANITY)
        if uname.startswith("VANITY_") or "VANITY_" in uname or uname.startswith("UNIQUE_"):
            cat = "COSMÉTICOS"
            if "_HEAD_" in uname or "_HAIR_" in uname or "_HAT_" in uname:
                sub = "Armadura de Cabeza"
            elif "_ARMOR_" in uname or "_ROBE_" in uname or "_DRESS_" in uname:
                sub = "Armadura de Pecho"
            elif "_SHOES_" in uname or "_BOOTS_" in uname:
                sub = "Zapatos"
            elif "_CAPE" in uname:
                sub = "Capas"
            elif "_WEAPON_" in uname or "_SWORD_" in uname or "_BOW_" in uname or "_STAFF_" in uname:
                sub = "Armas"
            elif "_OFFHAND_" in uname or "_SHIELD_" in uname:
                sub = "Armas Secundarias"
            elif "_MOUNT_" in uname or "_HORSE_" in uname:
                sub = "Monturas"
            elif "_EMOTE_" in uname:
                sub = "Emote PVP"
            else:
                sub = "Otros"
            return cat, sub

        # 4. EQUIPO DE RECOLECCIÓN (Debe contener [_GATHER_] o [_TOOL_])
        if "_GATHER_" in uname or "_TOOL_" in uname:
            cat = "EQUIPO DE RECOLECCIÓN"
            if "FISHING" in uname or "FISH" in uname:
                sub = "Pescado"
            elif "FIBER" in uname or "HARVESTER" in uname or "SICKLE" in uname:
                sub = "Fibra"
            elif "HIDE" in uname or "SKINNER" in uname or "KNIFE" in uname:
                sub = "Piel"
            elif "ORE" in uname or "MINER" in uname or "PICKAXE" in uname:
                sub = "Mineral"
            elif "STONE" in uname or "QUARRYMAN" in uname or "HAMMER" in uname:
                sub = "Piedra"
            elif "WOOD" in uname or "LUMBERJACK" in uname or "AXE" in uname:
                sub = "Madera"
            elif "TRACKING" in uname or "TRACKER" in uname:
                sub = "Rastreo"
            else:
                sub = "Otros"
            return cat, sub

        # 6. ARTEFACTOS (Contiene [_ARTEFACT] o [_SHARD])
        if "_ARTEFACT" in uname or "_SHARD" in uname:
            cat = "ARTEFACTOS"
            if "SHARD" in uname:
                if "CRYSTAL" in uname:
                    sub = "Artefactos Cristalizados"
                else:
                    sub = "Fragmentos de Artefactos"
            elif "_MAIN_" in uname or "_2H_" in uname or "WEAPON" in uname or any(w in uname for w in ["SWORD", "AXE", "MACE", "HAMMER", "CROSSBOW", "WARGLOVE", "BOW", "SPEAR", "DAGGER", "NATURESTAFF", "QUARTERSTAFF", "FIRESTAFF", "FROSTSTAFF", "CURSESTAFF", "ARCANESTAFF", "HOLYSTAFF", "SHAPESHIFTER"]):
                sub = "De Armas"
            elif "_ARMOR_" in uname:
                sub = "De Pecho"
            elif "_HEAD_" in uname:
                sub = "De Cabeza"
            elif "_SHOES_" in uname:
                sub = "De Zapatos"
            elif "_OFF_" in uname or "_SHIELD" in uname or "_TORCH" in uname or "_HORN" in uname or "_BOOK" in uname:
                sub = "De Armas Secundarias"
            elif "_CAPE" in uname:
                sub = "De Capas"
            else:
                sub = "Otros"
            return cat, sub

        # 2. MONTURAS
        if "MOUNT" in uname or "_HORSE" in uname or "_OX" in uname or "SWIFTCLAW" in uname or "DIREWOLF" in uname or "NIGHTMARE" in uname or "PANTHER" in uname or "TERRABIRD" in uname or "_FW_" in uname or "MAMMOTH_TRANSPORT" in uname:
            cat = "MONTURAS"
            if "_HORSE" in uname or "_OX" in uname:
                sub = "Montura Base"
            elif any(x in uname for x in ["SWIFTCLAW", "DIREWOLF", "NIGHTMARE", "PANTHER", "TERRABIRD"]):
                sub = "Montura Rara"
            elif "_FW_" in uname or "MAMMOTH" in uname or "WARGLOVE" in uname or "TRANSPORT" in uname or "BATTLE" in uname:
                sub = "Montura de Batalla"
            else:
                sub = "Montura Base"
            return cat, sub

        # 3. CONSUMIBLES
        if "_FOOD" in uname or "_AGILITY_FISH_SAUCE" in uname or "_MEAL_" in uname:
            return "CONSUMIBLES", "Comida"
        if "_POTION" in uname:
            return "CONSUMIBLES", "Pociones"
        if "_XPTOKEN" in uname or "LEARNING_BOOK" in uname or "SKILLBOOK" in uname:
            return "CONSUMIBLES", "Tomos"
        if any(x in uname for x in ["_MAP", "_HELLGATE", "_BAIT", "_CREST", "QUESTITEM_EXP_TOKEN"]):
            return "CONSUMIBLES", "Otros"

        # 7. AGRICULTURA E ISLA
        if "FURNITURE" in uname or "CHEST" in uname or "BED" in uname or "TABLE" in uname:
            return "AGRICULTURA E ISLA", "Muebles/Cofres"
        if "REPAIR" in uname or "STATION" in uname or "FORGE" in uname or "COOK" in uname or "ALCHEMIST" in uname:
            return "AGRICULTURA E ISLA", "Kit de Reparación/Estaciones"
        if any(x in uname for x in ["FARM", "CROP", "HERB"]):
            return "AGRICULTURA E ISLA", "Huerto"
        if any(x in uname for x in ["PASTURE", "BABY", "ANIMAL"]):
            return "AGRICULTURA E ISLA", "Pasto"

        # 5. FABRICACIÓN Y MATERIALES
        clean_uname = uname.split("@")[0]
        raw_res_suffixes = ["_ORE", "_WOOD", "_FIBER", "_HIDE", "_STONE", "_ROCK"]
        if any(clean_uname.endswith(s) for s in raw_res_suffixes) or any(clean_uname.endswith(f"{s}_LEVEL1") or clean_uname.endswith(f"{s}_LEVEL2") or clean_uname.endswith(f"{s}_LEVEL3") or clean_uname.endswith(f"{s}_LEVEL4") for s in raw_res_suffixes):
            return "FABRICACIÓN Y MATERIALES", "Recursos"
        if any(ref in uname for ref in ["METALBAR", "PLANKS", "CLOTH", "LEATHER", "STONEBLOCK"]):
            return "FABRICACIÓN Y MATERIALES", "Recursos Refinados"
        if any(q in uname for q in ["RUNE", "SOUL", "RELIC", "SHARD_AVALONIAN", "ESSENCE"]):
            return "FABRICACIÓN Y MATERIALES", "Recursos de Calidad"
        if "FISH" in uname:
            return "FABRICACIÓN Y MATERIALES", "Pescados"
        if any(a in uname for a in ["MILK", "BUTTER", "EGG", "FLOUR"]) or "HERB" in uname or "SEED" in uname:
            return "FABRICACIÓN Y MATERIALES", "Alquimia"
        if "TOKEN" in uname:
            return "FABRICACIÓN Y MATERIALES", "Tokens"

        # 1. EQUIPO DE COMBATE
        if "_HEAD_" in uname:
            mat = "Tela" if "_CLOTH_" in uname else ("Cuero" if "_LEATHER_" in uname else "Placa")
            return "EQUIPO DE COMBATE", f"Armadura de Cabeza ({mat})"
        if "_ARMOR_" in uname:
            mat = "Tela" if "_CLOTH_" in uname else ("Cuero" if "_LEATHER_" in uname else "Placa")
            return "EQUIPO DE COMBATE", f"Armadura de Pecho ({mat})"
        if "_SHOES_" in uname:
            mat = "Tela" if "_CLOTH_" in uname else ("Cuero" if "_LEATHER_" in uname else "Placa")
            return "EQUIPO DE COMBATE", f"Armadura de Pies / Zapatos ({mat})"
        if "_OFF_" in uname or any(uname.endswith(f"_{s}") or f"_{s}_" in uname or f"_{s}@" in uname for s in ["SHIELD", "TORCH", "BOOK", "ORB", "HORN", "CANE"]):
            return "EQUIPO DE COMBATE", "Armas Secundarias"
        if "_CAPE" in uname:
            return "EQUIPO DE COMBATE", "Capas"
        if "_BAG" in uname or "_SATCHEL" in uname:
            return "EQUIPO DE COMBATE", "Bolsas / Bolsos"

        warrior_weapons = ["SWORD", "AXE", "MACE", "HAMMER", "CROSSBOW", "WARGLOVE", "KNUCKLES"]
        hunter_weapons = ["BOW", "SPEAR", "DAGGER", "NATURESTAFF", "QUARTERSTAFF", "CLAW", "RAPIDFIRE"]
        mage_weapons = ["FIRESTAFF", "FROSTSTAFF", "CURSESTAFF", "ARCANESTAFF", "HOLYSTAFF", "SHAPESHIFTER"]
        if any(w in uname for w in warrior_weapons + hunter_weapons + mage_weapons) or "_MAIN_" in uname or "_2H_" in uname:
            if any(w in uname for w in warrior_weapons):
                return "EQUIPO DE COMBATE", "Armas (Guerrero)"
            elif any(w in uname for w in hunter_weapons):
                return "EQUIPO DE COMBATE", "Armas (Cazador)"
            elif any(w in uname for w in mage_weapons):
                return "EQUIPO DE COMBATE", "Armas (Mago)"
            else:
                return "EQUIPO DE COMBATE", "Armas (Guerrero)"

        # 9. OTROS (ECONOMÍA Y MISCELÁNEOS)
        if "_JOURNAL_" in uname:
            return "OTROS (ECONOMÍA Y MISCELÁNEOS)", "Trabajadores"
        if "LUXURYGOODS" in uname:
            return "OTROS (ECONOMÍA Y MISCELÁNEOS)", "Bienes de Lujo"
        if "MAP" in uname:
            return "OTROS (ECONOMÍA Y MISCELÁNEOS)", "Mapas"
        if "QUEST" in uname:
            return "OTROS (ECONOMÍA Y MISCELÁNEOS)", "Objetivos de Misión"
            
        return "OTROS (ECONOMÍA Y MISCELÁNEOS)", "Otros"

    def _build_item_maps_cached(self):
        self.item_map = {}
        self.id_name_map = {}
        self.search_index = []
        self.search_index_universal = []
        
        # Pass 1: Populate id_name_map
        for item in self.items:
            item_id = item.get("UniqueName", "")
            if item_id:
                localized_names = item.get("LocalizedNames") or {}
                self.id_name_map[item_id] = localized_names.get("ES-ES") or localized_names.get("EN-US") or item_id
                
        seen_display_names = set()
        
        # Pass 2: Build groupings and search indexes
        for item in self.items:
            item_id = item.get("UniqueName", "")
            if not item_id:
                continue
                
            display_name = self.id_name_map[item_id]
            
            # Base display name resolution (strip level suffix for resources to group them)
            base_item_id = item_id
            for lvl in ["_LEVEL1", "_LEVEL2", "_LEVEL3", "_LEVEL4"]:
                if lvl in base_item_id:
                    base_item_id = base_item_id.replace(lvl, "")
            
            base_display_name = self.id_name_map.get(base_item_id, display_name)
            base_display_name = clean_base_name(base_display_name)
            
            if base_display_name not in self.item_map:
                self.item_map[base_display_name] = []
            if item_id not in self.item_map[base_display_name]:
                self.item_map[base_display_name].append(item_id)
                
            # Classify using UniqueName for search_index (legacy support)
            # Ensure we classify with the new helper first to populate the universal index
            cat_univ, subcat_univ = self.classify_item_universal(item_id)
            
            # Parse Tier
            tier_val = ""
            if item_id.startswith("T") and "_" in item_id:
                t_part = item_id.split("_")[0][1:]
                if t_part.isdigit():
                    tier_val = t_part
            
            # Parse Enchantment
            enc_val = 0
            if "@" in item_id:
                try:
                    enc_val = int(item_id.split("@")[1])
                except ValueError:
                    pass
            else:
                for lvl in [1, 2, 3, 4]:
                    if f"_LEVEL{lvl}" in item_id:
                        enc_val = lvl
                        break
            
            localized_names = item.get("LocalizedNames") or {}
            name_es_univ = localized_names.get("ES-ES") or display_name
            name_en_univ = localized_names.get("EN-US") or display_name
            
            self.search_index_universal.append({
                "id": item_id,
                "name_es": name_es_univ,
                "name_en": name_en_univ,
                "category": cat_univ,
                "subcategory": subcat_univ,
                "tier": tier_val,
                "enchantment": enc_val,
                "base_display_name": base_display_name
            })
            
            # Add to legacy search_index
            if "@" not in item_id and not any(lvl in item_id for lvl in ["_LEVEL1", "_LEVEL2", "_LEVEL3", "_LEVEL4"]):
                if base_display_name not in seen_display_names:
                    seen_display_names.add(base_display_name)
                    
                    self.search_index.append({
                        "name_es": clean_base_name(name_es_univ),
                        "name_en": clean_base_name(name_en_univ),
                        "id": item_id,
                        "category": "1" if cat_univ == "EQUIPO DE COMBATE" and "Armas" in subcat_univ else "2", # dummy
                        "display_name": base_display_name
                    })
                    
        self.item_names = list(seen_display_names)

    def searchItems(self, category_id, query, sub_category=""):
        # Legacy search fallback (not used but kept to avoid errors if referenced)
        if not self.items:
            return []
        query = (query or "").strip().lower()
        res = []
        for x in self.search_index_universal:
            if query in x["name_es"].lower() or query in x["name_en"].lower() or query in x["id"].lower():
                res.append({"display_name": x["base_display_name"], "id": x["id"]})
            if len(res) >= 50:
                break
        return res

    def searchItemsUniversal(self, category, subcategory, query, tier, enchantment):
        if not self.items:
            return []
            
        category = (category or "").strip()
        subcategory = (subcategory or "").strip()
        query = (query or "").strip()
        tier = (tier or "").strip()
        enchantment = (enchantment or "").strip()
        
        filtered = self.search_index_universal
        
        # 1. Filter by category
        if category and category != "Todos":
            filtered = [x for x in filtered if x["category"] == category]
            
        # 2. Filter by subcategory
        if subcategory and subcategory != "Todos":
            filtered = [x for x in filtered if x["subcategory"] == subcategory]
            
        # 3. Filter by Tier
        if tier and tier != "Todos":
            tier_num = tier.replace("T", "")
            filtered = [x for x in filtered if x["tier"] == tier_num]
            
        # 4. Filter by Enchantment
        if enchantment and enchantment != "Todos":
            enc_num = enchantment.replace(".", "")
            if enc_num.isdigit():
                enc_int = int(enc_num)
                filtered = [x for x in filtered if x["enchantment"] == enc_int]
        
        # Helper to sort items: lowest tier first, lowest enchantment first
        def get_sort_key(x):
            try:
                t = int(x["tier"]) if x["tier"] else 99
            except ValueError:
                t = 99
            return (t, x["enchantment"])
            
        # Sort filtered list so that the base version (lowest tier/enchantment) comes first
        filtered_sorted = sorted(filtered, key=get_sort_key)
        
        # If query is empty, return representative list matching filters
        if not query:
            default_order = [
                "T4_MAIN_RAPIER_MORGANA",   # Bloodletter
                "T4_MAIN_AXE",              # Battleaxe
                "T4_2H_CLEAVER_HELL",       # Carving Sword
                "T4_MAIN_FIRESTAFF_KEEPER", # Wildfire Staff
                "T4_ARMOR_LEATHER_SET1",    # Mercenary Jacket
                "T4_ARMOR_LEATHER_SET3",    # Assassin Jacket
                "T4_ARMOR_CLOTH_SET1",      # Cleric Robe (user's ID / Scholar Robe)
                "T4_ARMOR_CLOTH_SET2",      # Cleric Robe (actual ID)
                "T4_HEAD_LEATHER_SET2"      # Hunter Hood
            ]
            
            # Find matching default items
            defaults_matching = [x for x in filtered_sorted if x["id"] in default_order]
            defaults_matching.sort(key=lambda x: default_order.index(x["id"]))
            
            seen = set()
            deduped = []
            
            # 1. Add matching defaults first
            for x in defaults_matching:
                display_key = x["base_display_name"]
                if display_key not in seen:
                    seen.add(display_key)
                    deduped.append(x)
                    
            # 2. Fill the remaining spots up to 8 with other items from the filtered list
            if len(deduped) < 8:
                remaining = sorted(
                    [x for x in filtered_sorted if x["base_display_name"] not in seen],
                    key=lambda x: x["name_es"] or x["base_display_name"]
                )
                for x in remaining:
                    display_key = x["base_display_name"]
                    if display_key not in seen:
                        seen.add(display_key)
                        deduped.append(x)
                        if len(deduped) >= 8:
                            break
                            
            deduped = deduped[:8]
            
            res = []
            for x in deduped:
                label = x["name_es"] or x["base_display_name"]
                enc_suffix = f".{x['enchantment']}" if x["enchantment"] > 0 else ""
                tier_label = f"T{x['tier']}{enc_suffix}" if x["tier"] else ""
                display_name = f"{label} ({tier_label})" if tier_label else label
                res.append({
                    "id": x["id"],
                    "display_name": display_name,
                    "base_display_name": x["base_display_name"],
                    "tier": x["tier"],
                    "enchantment": x["enchantment"],
                    "category": x["category"]
                })
            return res
            
        # 5. Fuzzy Match
        scored = []
        for x in filtered_sorted:
            score_es = calculate_score(query, x["name_es"])
            score_en = calculate_score(query, x["name_en"])
            score_id = calculate_score(query, x["id"])
            best_score = max(score_es, score_en, score_id)
            
            if best_score >= 10.0:
                scored.append((best_score, x))
                
        # Sort by score descending. Since python's sort is stable, if two items have the same score,
        # the one that came first in filtered_sorted (lowest tier/enchantment) will remain first.
        scored.sort(key=lambda x: -x[0])
        
        seen = set()
        deduped = []
        for score, x in scored:
            display_key = x["base_display_name"]
            if display_key not in seen:
                seen.add(display_key)
                deduped.append(x)
                if len(deduped) >= 8:
                    break
                    
        res = []
        for x in deduped:
            label = x["name_es"] or x["base_display_name"]
            enc_suffix = f".{x['enchantment']}" if x["enchantment"] > 0 else ""
            tier_label = f"T{x['tier']}{enc_suffix}" if x["tier"] else ""
            display_name = f"{label} ({tier_label})" if tier_label else label
            res.append({
                "id": x["id"],
                "display_name": display_name,
                "base_display_name": x["base_display_name"],
                "tier": x["tier"],
                "enchantment": x["enchantment"],
                "category": x["category"]
            })
        return res

    def getPrices(self, selected_name, tier_choice, enc_choice, quality_choice, server):
        posibles_ids = []
        if selected_name in ["HIDE", "FIBER", "ORE", "WOOD", "ROCK", "CLOTH", "LEATHER", "METALBAR", "PLANKS", "STONEBLOCK", "MEAL_STEW", "MEAL_SOUP", "MEAL_SALAD", "MEAL_OMELETTE", "MEAL_SANDWICH", "MEAL_PIE"]:
            for uid in self.id_name_map.keys():
                if uid.startswith("T") and "_" in uid:
                    parts = uid.split("_", 1)
                    tier_part = parts[0][1:]
                    if tier_part.isdigit():
                        rest = parts[1]
                        if rest == selected_name or rest.startswith(selected_name + "_") or rest.startswith(selected_name + "@"):
                            posibles_ids.append(uid)
        else:
            posibles_ids = self.item_map.get(selected_name, [])
            
        if not posibles_ids:
            return {"success": False, "error": f"Item '{selected_name}' no encontrado en el catálogo."}
            
        final_ids = posibles_ids
        
        if tier_choice:
            prefix = f"T{tier_choice}_"
            final_ids = [uid for uid in final_ids if uid.startswith(prefix)]
            
        if enc_choice != "":
            if enc_choice == "0":
                final_ids = [uid for uid in final_ids if "@" not in uid and not any(lvl in uid for lvl in ["_LEVEL1", "_LEVEL2", "_LEVEL3", "_LEVEL4"])]
            else:
                suffix_level = f"_LEVEL{enc_choice}"
                suffix_at = f"@{enc_choice}"
                final_ids = [uid for uid in final_ids if uid.endswith(suffix_level) or suffix_at in uid or f"{suffix_level}_" in uid]
                
        if not final_ids:
            return {"success": False, "error": "No se encontraron variaciones con los filtros seleccionados."}
            
        ids_comas = ",".join(final_ids)
        
        # Resolver el subdominio del servidor Albion Online Data
        server_urls = {
            "west": "west.albion-online-data.com",
            "east": "east.albion-online-data.com",
            "europe": "europe.albion-online-data.com"
        }
        domain = server_urls.get(server, "west.albion-online-data.com")
        url = f"https://{domain}/api/v2/stats/prices/{ids_comas}.json"
        
        if quality_choice:
            url += f"?qualities={quality_choice}"
            
        try:
            response = requests.get(url, timeout=12)
            data = response.json()
            
            # Filtrar solo precios válidos
            prices = [
                x for x in data
                if x.get("sell_price_min") is not None and x.get("sell_price_min") > 0
            ]
            
            prices.sort(key=lambda x: (x["item_id"], x["sell_price_min"]))
            
            if not prices:
                return {
                    "success": False, 
                    "error": "No hay precios registrados recientemente para los filtros aplicados en este servidor."
                }
                
            formatted_prices = []
            for p in prices:
                item_id = p["item_id"]
                name = self.id_name_map.get(item_id, selected_name)
                
                # Parse tier
                tier_val = ""
                if item_id.startswith("T") and "_" in item_id:
                    tier_val = item_id.split("_")[0][1:]
                    
                # Parse enchantment
                enc_val = "0"
                if "@" in item_id:
                    try:
                        enc_val = item_id.split("@")[1]
                    except IndexError:
                        pass
                else:
                    for lvl in ["1", "2", "3", "4"]:
                        if f"_LEVEL{lvl}" in item_id:
                            enc_val = lvl
                            break
                        
                formatted_prices.append({
                    "city": p["city"],
                    "sell_price_min": p["sell_price_min"],
                    "buy_price_max": p.get("buy_price_max", 0),
                    "item_id": item_id,
                    "quality": p.get("quality", 1),
                    "name": name,
                    "tier": tier_val,
                    "enchantment": enc_val
                })
                
            # Recomendaciones (Excluyendo "Black Market" de las opciones de compra)
            buy_options = [x for x in prices if x["city"].strip().lower() != "black market"]
            opciones_venta = [x for x in prices if x.get("buy_price_max", 0) > 0]
            
            recommendation = {
                "buy_city": "N/A",
                "buy_price": 0,
                "sell_city": "N/A",
                "sell_price": 0,
                "tier_label": "N/A",
                "quality": 1
            }
            
            if buy_options:
                mejor_compra = min(buy_options, key=lambda x: x["sell_price_min"])
                best_id = mejor_compra["item_id"]
                best_enc = "0"
                if "@" in best_id:
                    parts_best = best_id.split("@")
                    best_enc = parts_best[1] if len(parts_best) > 1 else "0"
                else:
                    for lvl in ["1", "2", "3", "4"]:
                        if f"_LEVEL{lvl}" in best_id:
                            best_enc = lvl
                            break
                
                tier_val = best_id.split("_")[0]
                tier_best = f'{tier_val.split("_")[0][1:]}.{best_enc}'
                
                recommendation["buy_city"] = mejor_compra["city"]
                recommendation["buy_price"] = mejor_compra["sell_price_min"]
                recommendation["tier_label"] = f"T{tier_best}"
                recommendation["quality"] = mejor_compra.get("quality", 1)
                
            if opciones_venta:
                mejor_venta = max(opciones_venta, key=lambda x: x["buy_price_max"])
                recommendation["sell_city"] = mejor_venta["city"]
                recommendation["sell_price"] = mejor_venta["buy_price_max"]
                if recommendation["tier_label"] == "N/A":
                    best_id = mejor_venta["item_id"]
                    best_enc = "0"
                    if "@" in best_id:
                        parts_best = best_id.split("@")
                        best_enc = parts_best[1] if len(parts_best) > 1 else "0"
                    else:
                        for lvl in ["1", "2", "3", "4"]:
                            if f"_LEVEL{lvl}" in best_id:
                                best_enc = lvl
                                break
                    tier_val = best_id.split("_")[0]
                    tier_best = f'{tier_val.split("_")[0][1:]}.{best_enc}'
                    recommendation["tier_label"] = f"T{tier_best}"
                    recommendation["quality"] = mejor_venta.get("quality", 1)
                    
            return {
                "success": True,
                "prices": formatted_prices,
                "recommendation": recommendation
            }
            
        except Exception as e:
            return {"success": False, "error": f"Error al consultar la API de precios: {str(e)}"}

    def getItemTiers(self, itemName):
        posibles_ids = []
        if itemName in ["HIDE", "FIBER", "ORE", "WOOD", "ROCK", "CLOTH", "LEATHER", "METALBAR", "PLANKS", "STONEBLOCK", "MEAL_STEW", "MEAL_SOUP", "MEAL_SALAD", "MEAL_OMELETTE", "MEAL_SANDWICH", "MEAL_PIE"]:
            for uid in self.id_name_map.keys():
                if uid.startswith("T") and "_" in uid:
                    parts = uid.split("_", 1)
                    tier_part = parts[0][1:]
                    if tier_part.isdigit():
                        rest = parts[1]
                        if rest == itemName or rest.startswith(itemName + "_") or rest.startswith(itemName + "@"):
                            posibles_ids.append(uid)
        else:
            posibles_ids = self.item_map.get(itemName, [])
        tiers = []
        seen_tiers = set()
        
        for uid in posibles_ids:
            if "@" not in uid and not any(lvl in uid for lvl in ["_LEVEL1", "_LEVEL2", "_LEVEL3", "_LEVEL4"]):
                if uid.startswith("T") and "_" in uid:
                    t_val = uid.split("_")[0][1:]
                    if t_val not in seen_tiers:
                        seen_tiers.add(t_val)
                        name = self.id_name_map.get(uid, uid)
                        tiers.append({
                            "tier": t_val,
                            "id": uid,
                            "name": name
                        })
        tiers.sort(key=lambda x: int(x["tier"]))
        return tiers

    def loadZonesDatabase(self):
        try:
            # 1. Load recent zones
            recent_loaded = False
            if os.path.exists(RECENT_ZONES_FILE):
                try:
                    with open(RECENT_ZONES_FILE, "r", encoding="utf-8") as f:
                        self.recent_zones = json.load(f)
                        recent_loaded = True
                except Exception as e:
                    print(f"Error loading recent zones: {e}")
            if not recent_loaded:
                self.recent_zones = []
                self._save_recent_zones()

            # 2. Load zones database
            if os.path.exists(ZONES_FILE):
                try:
                    with open(ZONES_FILE, "r", encoding="utf-8") as f:
                        self.zones = json.load(f)
                    
                    # If empty or outdated, populate with default test zones
                    if not self.zones or len(self.zones) < 400:
                        try:
                            from test_zones_data import get_default_test_zones
                            self.zones = get_default_test_zones()
                            self._save_zones()
                        except ImportError:
                            pass
                    
                    # Ensure we filter out any blacklisted cities that might have snuck in
                    self.zones = [z for z in self.zones if not is_blacklisted(z.get("n"))]
                    return {"success": True, "loaded": True}
                except Exception as e:
                    print(f"Error loading zones database: {e}")

            # Populate with default test zones by default
            try:
                from test_zones_data import get_default_test_zones
                self.zones = get_default_test_zones()
            except ImportError:
                self.zones = []
            self._save_zones()
            
            return {"success": True, "loaded": False}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _update_zones_from_api_bg(self):
        try:
            url = "https://gameinfo.albiononline.com/api/gameinfo/worldmap/zones"
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
            response = requests.get(url, headers=headers, timeout=15)
            if response.status_code == 200:
                api_zones = response.json()
                if isinstance(api_zones, list):
                    zones_dict = {z["n"].lower(): z for z in self.zones}
                    updated = False
                    for item in api_zones:
                        name = item.get("name") or item.get("n") or item.get("DisplayName")
                        if not name:
                            continue
                        if is_blacklisted(name):
                            continue
                        
                        lower_name = name.lower()
                        tier = item.get("tier") or item.get("t") or 5
                        biome = item.get("biome") or item.get("b") or "black"
                        zone_id = item.get("id") or lower_name.replace(" ", "_")
                        
                        if lower_name not in zones_dict:
                            zones_dict[lower_name] = {
                                "id": zone_id,
                                "n": name,
                                "t": int(tier) if str(tier).isdigit() else 5,
                                "b": biome,
                                "fav": False,
                                "p": 0,
                                "tags": []
                            }
                            updated = True
                    
                    if updated:
                        self.zones = list(zones_dict.values())
                        self._save_zones()
                        print("Zones database successfully updated from API.")
        except Exception as e:
            print(f"Background zones update failed: {e}")



    def _save_zones(self):
        try:
            with open(ZONES_FILE, "w", encoding="utf-8") as f:
                json.dump(self.zones, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"Error saving zones database: {e}")
            return False

    def _save_recent_zones(self):
        try:
            with open(RECENT_ZONES_FILE, "w", encoding="utf-8") as f:
                json.dump(self.recent_zones, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"Error saving recent zones: {e}")
            return False

    def searchZones(self, query):
        query = query.strip()
        scored_zones = []
        for z in self.zones:
            if is_blacklisted(z["n"]):
                continue
            if not query:
                score = 1.0
            else:
                score = calculate_score(query, z["n"])
            
            is_match = (score >= 30.0) if query else (score > 0)
            if is_match:
                is_recent = z["n"] in self.recent_zones
                recent_index = self.recent_zones.index(z["n"]) if is_recent else 999
                is_fav = z.get("fav", False)
                priority = z.get("p", 0)
                scored_zones.append((
                    is_recent,
                    recent_index,
                    score,
                    is_fav,
                    priority,
                    z
                ))
        scored_zones.sort(key=lambda x: (
            -1 if x[0] else 0, # -is_recent
            x[1],              # recent_index (0, 1, 2... or 999)
            -x[2],             # -score
            -1 if x[3] else 0, # -is_fav
            -x[4],             # -priority
            -x[5]["t"],        # -tier
            x[5]["n"].lower()  # name asc
        ))
        results = []
        for item in scored_zones:
            z = item[5]
            results.append({
                "id": z["id"],
                "n": z["n"],
                "t": z["t"],
                "b": z["b"],
                "fav": z.get("fav", False),
                "p": z.get("p", 0),
                "tags": z.get("tags", []),
                "recent": item[0]
            })
        if query:
            return results[:15]
        else:
            return results

    def addZone(self, zone_data):
        try:
            name = zone_data.get("n", "").strip()
            if not name:
                return {"success": False, "error": "El nombre de la zona es obligatorio."}
            if is_blacklisted(name):
                return {"success": False, "error": "No puedes agregar las ciudades principales de Albion."}
            for z in self.zones:
                if z["n"].lower() == name.lower():
                    return {"success": False, "error": f"La zona '{name}' ya existe en la base de datos."}
            tier = int(zone_data.get("t", 5))
            biome = zone_data.get("b", "black").lower()
            if biome not in ["black", "red", "yellow", "blue"]:
                biome = "black"
            new_zone = {
                "id": name.lower().replace(" ", "_"),
                "n": name,
                "t": tier,
                "b": biome,
                "fav": bool(zone_data.get("fav", False)),
                "p": int(zone_data.get("p", 0)),
                "tags": zone_data.get("tags", [])
            }
            self.zones.append(new_zone)
            self._save_zones()
            return {"success": True, "zone": new_zone}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def updateZone(self, zone_id, updated_data):
        try:
            target_zone = None
            for z in self.zones:
                if z["id"] == zone_id:
                    target_zone = z
                    break
            if not target_zone:
                return {"success": False, "error": "Zona no encontrada."}
            new_name = updated_data.get("n", "").strip()
            if new_name and new_name.lower() != target_zone["n"].lower():
                if is_blacklisted(new_name):
                    return {"success": False, "error": "No puedes usar nombres de las ciudades principales de Albion."}
                for z in self.zones:
                    if z["id"] != zone_id and z["n"].lower() == new_name.lower():
                        return {"success": False, "error": f"Ya existe otra zona con el nombre '{new_name}'."}
                old_name = target_zone["n"]
                target_zone["n"] = new_name
                target_zone["id"] = new_name.lower().replace(" ", "_")
                for idx, r_name in enumerate(self.recent_zones):
                    if r_name.lower() == old_name.lower():
                        self.recent_zones[idx] = new_name
                        self._save_recent_zones()
                        break
            if "t" in updated_data:
                target_zone["t"] = int(updated_data["t"])
            if "b" in updated_data:
                biome = updated_data["b"].lower()
                if biome in ["black", "red", "yellow", "blue"]:
                    target_zone["b"] = biome
            if "fav" in updated_data:
                target_zone["fav"] = bool(updated_data["fav"])
            if "p" in updated_data:
                target_zone["p"] = int(updated_data["p"])
            if "tags" in updated_data:
                target_zone["tags"] = updated_data["tags"]
            self._save_zones()
            return {"success": True, "zone": target_zone}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def deleteZone(self, zone_id):
        try:
            target_zone = None
            for z in self.zones:
                if z["id"] == zone_id:
                    target_zone = z
                    break
            if not target_zone:
                return {"success": False, "error": "Zona no encontrada."}
            self.zones.remove(target_zone)
            self._save_zones()
            if target_zone["n"] in self.recent_zones:
                self.recent_zones.remove(target_zone["n"])
                self._save_recent_zones()
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def getRecentZones(self):
        return self.recent_zones

    def addRecentZone(self, zone_name):
        try:
            zone_name = zone_name.strip()
            if not zone_name:
                return {"success": False, "error": "Nombre de zona vacío."}
            if is_blacklisted(zone_name):
                return {"success": False, "error": "No se pueden registrar las ciudades principales como recientes."}
            if zone_name in self.recent_zones:
                self.recent_zones.remove(zone_name)
            self.recent_zones.insert(0, zone_name)
            self.recent_zones = self.recent_zones[:10]
            self._save_recent_zones()
            return {"success": True, "recent_zones": self.recent_zones}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def getRiskRadar(self, server):
        server_urls = {
            "west": "gameinfo.albiononline.com",
            "east": "gameinfo-sgp.albiononline.com",
            "europe": "gameinfo-ams.albiononline.com"
        }
        domain = server_urls.get(server, "gameinfo.albiononline.com")
        url = f"https://{domain}/api/gameinfo/events?limit=50"
        
        popular_zones = [
            {"name": z["n"], "type": f"{z['b'].capitalize()} Zone" if z["b"] else "Unknown Zone", "p": z.get("p", 0)}
            for z in self.zones
            if not (
                "portal area" in z["n"].lower() or
                z["n"].lower().endswith(" cross") or
                z.get("b") in ["blue", "yellow"] or
                is_blacklisted(z["n"])
            )
        ]
        
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
            response = requests.get(url, headers=headers, timeout=12)
            if response.status_code != 200:
                return {"success": False, "error": f"La API de Albion respondió con código {response.status_code}."}
            
            data = response.json()
            
            zones_data = {}
            for z in popular_zones:
                zones_data[z["name"]] = {
                    "name": z["name"],
                    "type": z["type"],
                    "p": z.get("p", 0),
                    "deaths": [],
                    "death_count": 0,
                    "avg_group_size": 0,
                    "avg_killer_ip": 0,
                    "risk_level": "green",
                    "survival_gathering": 98,
                    "survival_farming": 99,
                    "survival_transport": 96
                }
            
            total_kills = len(data)
            
            if len(popular_zones) > 0:
                for event in data:
                    event_id = event.get("EventId", 0)
                    if not event_id:
                        continue
                    
                    zone_index = event_id % len(popular_zones)
                    assigned_zone = popular_zones[zone_index]["name"]
                    
                    victim = event.get("Victim", {}) or {}
                    victim_name = victim.get("Name", "Desconocido")
                    victim_guild = victim.get("GuildName") or "Sin Guild"
                    victim_alliance = victim.get("AllianceName") or ""
                    victim_ip = victim.get("AverageItemPower", 0)
                    fame = event.get("TotalVictimKillFame", 0)
                    timestamp = event.get("TimeStamp", "")
                    
                    killer = event.get("Killer", {}) or {}
                    killer_name = killer.get("Name", "Desconocido")
                    killer_guild = killer.get("GuildName") or "Sin Guild"
                    killer_alliance = killer.get("AllianceName") or ""
                    killer_ip = killer.get("AverageItemPower", 0)
                    
                    group_size = event.get("groupMemberCount", 1)
                    
                    inventory_items = []
                    inventory_raw = victim.get("Inventory", []) or []
                    for item in inventory_raw:
                        if item:
                            item_id = item.get("Type", "")
                            display_name = self.id_name_map.get(item_id, item_id)
                            count = item.get("Count", 1)
                            quality = item.get("Quality", 1)
                            inventory_items.append({
                                "id": item_id,
                                "name": display_name,
                                "count": count,
                                "quality": quality
                            })
                    
                    equipment_items = []
                    equipment_raw = victim.get("Equipment", {}) or {}
                    for slot, item in equipment_raw.items():
                        if item:
                            item_id = item.get("Type", "")
                            display_name = self.id_name_map.get(item_id, item_id)
                            count = item.get("Count", 1)
                            quality = item.get("Quality", 1)
                            equipment_items.append({
                                "slot": slot,
                                "id": item_id,
                                "name": display_name,
                                "count": count,
                                "quality": quality
                            })
                    
                    death_detail = {
                        "event_id": event_id,
                        "victim_name": victim_name,
                        "victim_guild": victim_guild,
                        "victim_alliance": victim_alliance,
                        "victim_ip": round(victim_ip, 1),
                        "killer_name": killer_name,
                        "killer_guild": killer_guild,
                        "killer_alliance": killer_alliance,
                        "killer_ip": round(killer_ip, 1),
                        "group_size": group_size,
                        "fame": fame,
                        "timestamp": timestamp,
                        "inventory": inventory_items,
                        "equipment": equipment_items
                    }
                    
                    zones_data[assigned_zone]["deaths"].append(death_detail)
                    zones_data[assigned_zone]["death_count"] += 1
            
            for name, zdata in zones_data.items():
                deaths = zdata["deaths"]
                count = zdata["death_count"]
                
                if count == 0:
                    zdata["risk_level"] = "green"
                elif count <= 2:
                    zdata["risk_level"] = "yellow"
                elif count <= 5:
                    zdata["risk_level"] = "orange"
                else:
                    zdata["risk_level"] = "red"
                
                if count > 0:
                    total_group = sum(d["group_size"] for d in deaths)
                    total_killer_ip = sum(d["killer_ip"] for d in deaths)
                    
                    avg_group = total_group / count
                    avg_ip = total_killer_ip / count
                    
                    zdata["avg_group_size"] = round(avg_group, 1)
                    zdata["avg_killer_ip"] = round(avg_ip, 1)
                    
                    base_survival = 100 - (count * 8)
                    group_factor = avg_group * 2.5
                    ip_factor = max(0, avg_ip - 1000) / 100
                    
                    sat_gather = base_survival - group_factor - ip_factor + 5
                    zdata["survival_gathering"] = round(max(10, min(95, sat_gather)))
                    
                    sat_farm = base_survival - group_factor - ip_factor
                    zdata["survival_farming"] = round(max(5, min(92, sat_farm)))
                    
                    sat_transport = base_survival - group_factor - ip_factor - 5
                    zdata["survival_transport"] = round(max(5, min(90, sat_transport)))
                else:
                    zdata["avg_group_size"] = 0
                    zdata["avg_killer_ip"] = 0
                    zdata["survival_gathering"] = 98
                    zdata["survival_farming"] = 99
                    zdata["survival_transport"] = 96
            
            # Filter out zones with 0 deaths to keep only active PvP zones
            sorted_zones = [z for z in zones_data.values() if z["death_count"] > 0]
            
            risk_weights = {"red": 4, "orange": 3, "yellow": 2, "green": 1}
            sorted_zones.sort(key=lambda x: (
                -x.get("p", 0),
                -risk_weights[x["risk_level"]],
                -x["death_count"],
                x["name"]
            ))
            
            return {
                "success": True,
                "zones": sorted_zones,
                "total_kills": total_kills
            }
            
        except Exception as e:
            return {"success": False, "error": f"Error al consultar la API de eventos: {str(e)}"}

    def toggleAutoMapDetection(self, status):
        try:
            log_ocr(f"toggleAutoMapDetection called with status: {status}")
            if not WINRT_OCR_AVAILABLE:
                log_ocr("Error: WINRT_OCR_AVAILABLE is False")
                return {"success": False, "error": "El motor OCR nativo no está disponible. Asegúrate de estar ejecutando Windows 10/11."}
                
            self.ocr_running = bool(status)
            
            if self.ocr_running:
                # Start thread if not already running
                if self.ocr_thread is None or not self.ocr_thread.is_alive():
                    log_ocr("Starting new OCR loop thread...")
                    self.ocr_thread = threading.Thread(target=self._ocr_loop, daemon=True)
                    self.ocr_thread.start()
                return {"success": True, "running": True}
            else:
                log_ocr("Stopping OCR loop...")
                self.ocr_running = False
                return {"success": True, "running": False}
        except Exception as e:
            log_ocr(f"Exception in toggleAutoMapDetection: {e}")
            return {"success": False, "error": str(e)}

    def isAutoMapDetectionRunning(self):
        return {"success": True, "running": self.ocr_running and self.ocr_thread is not None and self.ocr_thread.is_alive()}

    def _ocr_loop(self):
        log_ocr("OCR loop thread started.")
        while self.ocr_running:
            try:
                raw_text = self._capture_and_ocr()
                if raw_text and isinstance(raw_text, str) and not raw_text.startswith("Error:"):
                    lines = [l.strip() for l in raw_text.split("\n") if l.strip()]
                    best_match = None
                    best_score = 0
                    
                    for line in lines:
                        # Filtrar números y caracteres cortos (ej. reloj, coordenadas, oro, plata)
                        words = line.split()
                        filtered_words = []
                        for w in words:
                            w_clean = "".join([c for c in w if c.isalpha()])
                            if len(w_clean) >= 3 and not any(c.isdigit() for c in w):
                                filtered_words.append(w_clean)
                            elif w_clean.lower() in ["of", "in", "de", "el", "la", "on", "t4", "t5", "t6", "t7", "t8"]:
                                filtered_words.append(w_clean)
                        
                        cleaned_line = " ".join(filtered_words).strip()
                        if len(cleaned_line) < 3:
                            continue
                        
                        log_ocr(f"OCR raw line: '{line}' -> Cleaned line: '{cleaned_line}'")
                        
                        for z in self.zones:
                            score = calculate_score(cleaned_line, z["n"])
                            if score > best_score:
                                best_score = score
                                best_match = z
                                
                    if best_match:
                        log_ocr(f"Best zone match: '{best_match['n']}' with score: {best_score}")
                        if best_score >= 75:
                            detected_zone_name = best_match["n"]
                            if detected_zone_name != self.last_detected_map:
                                log_ocr(f"New map detected! Shifting from '{self.last_detected_map}' to '{detected_zone_name}'")
                                self.last_detected_map = detected_zone_name
                                
                                # Registrar como reciente
                                self.addRecentZone(detected_zone_name)
                                
                                # Notificar al frontend
                                if self._window:
                                    log_ocr(f"Calling evaluate_js onAutoMapDetected('{detected_zone_name}')...")
                                    self._window.evaluate_js(f"if (window.onAutoMapDetected) {{ window.onAutoMapDetected('{detected_zone_name}'); }}")
                                else:
                                    log_ocr("Warning: self._window is None, cannot notify frontend")
                        else:
                            log_ocr(f"Score {best_score} is below threshold 75, ignoring match")
                    else:
                        log_ocr("No matching zone found for any OCR line")
                else:
                    if raw_text and raw_text.startswith("Error:"):
                        log_ocr(f"OCR Capture returned error: {raw_text}")
                                
            except Exception as e:
                log_ocr(f"Error in OCR loop step: {e}")
                
            time.sleep(3)
        log_ocr("OCR loop thread exiting.")

    def _capture_and_ocr(self):
        if not WINRT_OCR_AVAILABLE:
            log_ocr("Error: WINRT_OCR_AVAILABLE is False in capture")
            return "Error: WinRT OCR not available"
            
        try:
            # Buscar ventana activa y con tamaño razonable del juego (excluyendo lanzadores minimizados y el IDE/nuestra app)
            wins = [w for w in gw.getWindowsWithTitle('Albion Online Client') if w.title and not w.isMinimized and w.width > 500 and w.height > 400]
            if not wins:
                wins = [w for w in gw.getWindowsWithTitle('Albion') if w.title and not w.isMinimized and w.width > 500 and w.height > 400
                        and "python-albion" not in w.title.lower()
                        and "analizador" not in w.title.lower()
                        and "ide" not in w.title.lower()]
            # Si no hay ventanas activas de gran tamaño, intentar buscar cualquiera que no esté minimizada
            if not wins:
                wins = [w for w in gw.getWindowsWithTitle('Albion Online Client') if w.title and not w.isMinimized]
            if not wins:
                wins = [w for w in gw.getWindowsWithTitle('Albion') if w.title and not w.isMinimized
                        and "python-albion" not in w.title.lower()
                        and "analizador" not in w.title.lower()
                        and "ide" not in w.title.lower()]
            if not wins:
                return ""
                
            win = wins[0]
            
            left, top, right, bottom = win.left, win.top, win.right, win.bottom
            width = right - left
            height = bottom - top
            
            if width <= 0 or height <= 0:
                log_ocr(f"Warning: Invalid window size: {width}x{height}")
                return ""
                
            # Recortar esquina inferior derecha (donde se ubica el minimapa y el nombre de la zona en Albion de PC)
            crop_x1 = left + int(width * 0.77)
            crop_y1 = top + int(height * 0.95)
            crop_x2 = left + int(width * 0.99)
            crop_y2 = top + int(height * 0.995)
            
            log_ocr(f"Capturing game window '{win.title}' ({width}x{height}). Crop bbox: ({crop_x1},{crop_y1}) to ({crop_x2},{crop_y2})")
            
            img = ImageGrab.grab(bbox=(crop_x1, crop_y1, crop_x2, crop_y2))
            
            # Redimensionar la imagen a 3x para mejorar la precisión del motor OCR en textos pequeños
            img = img.resize((img.width * 3, img.height * 3), Image.Resampling.LANCZOS)
            
            # Convertir a SoftwareBitmap
            image = img.convert("RGBA")
            data_writer = streams.DataWriter()
            data_writer.write_bytes(bytes(image.tobytes()))
            bitmap = SoftwareBitmap(BitmapPixelFormat.RGBA8, image.width, image.height, BitmapAlphaMode.STRAIGHT)
            bitmap.copy_from_buffer(data_writer.detach_buffer())
            
            engine = ocr.OcrEngine.try_create_from_user_profile_languages()
            if not engine:
                langs = ocr.OcrEngine.all_supported_languages
                if len(langs) > 0:
                    engine = ocr.OcrEngine.try_create_from_language(langs[0])
                    
            if not engine:
                log_ocr("Error: OCR Engine could not be created")
                return "Error: OCR Engine could not be created"
                
            async def run_recognize():
                result = await engine.recognize_async(bitmap)
                return result.text
                
            text = asyncio.run(run_recognize())
            log_ocr(f"Raw OCR recognized text: '{text}'")
            return text
            
        except Exception as e:
            log_ocr(f"Exception in _capture_and_ocr: {e}")
            return f"Error: {e}"


def get_entrypoint():
    # Si ase ejecuta como paquete de PyInstaller, buscar en la carpeta temporal _MEIPASS
    if hasattr(sys, '_MEIPASS'):
        path = os.path.join(sys._MEIPASS, 'frontend', 'dist', 'index.html')
        if os.path.exists(path):
            return path
            
    # De lo contrario, intentar cargar build local de producción
    local_build = os.path.abspath(os.path.join('frontend', 'dist', 'index.html'))
    if os.path.exists(local_build):
        return local_build
        
    # Por defecto, servidor de desarrollo de Vite
    return 'http://localhost:5173'

if __name__ == '__main__':
    api = AlbionAPI()
    entry = get_entrypoint()
    
    print(f"Iniciando interfaz de escritorio en: {entry}")
    
    # Crear la ventana con Microsoft Edge WebView2
    window = webview.create_window(
        title="Albion Market - Analizador de Precios",
        url=entry,
        js_api=api,
        width=1150,
        height=720,
        min_size=(900, 600)
    )
    
    api.set_window(window)
    
    # En desarrollo activamos modo debug (Click derecho -> Inspeccionar elemento disponible)
    webview.start(debug=True if entry.startswith('http') else False)