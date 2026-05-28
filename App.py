import os
import sys
import json
import requests
import webview
import unicodedata
import difflib

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

    def _get_item_category(self, unique_name):
        if not unique_name:
            return None
        uname = unique_name.upper()
        
        # Exclude artifacts, tools, and vanity/cosmetic items from equipment categories
        if "_ARTEFACT_" in uname or "_TOOL_" in uname or uname.startswith("UNIQUE_"):
            return None
            
        if "_CAPE" in uname or "_BAG" in uname:
            return "5"  # Accesorios
        if "_SHOES" in uname:
            return "4"  # Botas / Pies
        if "_HEAD" in uname:
            return "3"  # Cascos / Cabezas
        if "_ARMOR" in uname:
            return "2"  # Armaduras / Pechos
            
        weapon_keywords = [
            "_BOW", "_CROSSBOW", "_DUALCROSSBOW", "_DAGGER", "_CLAW", "_BLOODLETTER", 
            "_SPEAR", "_LANCE", "_TRIDENT", "_AXE", "_HALBERD", "_SCYTHE", 
            "_MACE", "_HAMMER", "_QUARTERSTAFF", "_FIRESTAFF", "_HOLYSTAFF", 
            "_FROSTSTAFF", "_ARCANESTAFF", "_NATURESTAFF", "_CURSESTAFF", 
            "_SHAPESHIFTER", "_KNUCKLES", "_GLOVES", "_MAIN_", "_2H_", 
            "_OFF_", "_SHIELD", "_TORCH", "_BOOK", "_ORB", "_HORN", "_CANE"
        ]
        if any(kw in uname for kw in weapon_keywords):
            return "1"  # Armas
            
        resource_keywords = [
            "_CLOTH", "_LEATHER", "_METALBAR", "_PLANKS", "_STONEBLOCK",
            "_FIBER", "_ORE", "_HIDE", "_WOOD", "_ROCK"
        ]
        if any(kw in uname for kw in resource_keywords):
            return "6"  # Materiales
            
        if "_FOOD" in uname:
            return "71"  # Comida
        if "_POTION" in uname:
            return "72"  # Pociones
        if "_SKILLBOOK" in uname or "_JOURNAL" in uname:
            return "73"  # Tomos
        if any(kw in uname for kw in ["_MAP", "_HELLGATE", "_BAIT", "_CREST", "QUESTITEM_EXP_TOKEN"]):
            return "74"  # Otros Consumibles
            
        if uname.endswith("_RUNE") or uname.endswith("_SOUL") or uname.endswith("_RELIC"):
            return "8"  # Artefactos (Runas, Almas, Reliquias)
            
        return None

    def _build_item_maps_cached(self):
        self.item_map = {}
        self.id_name_map = {}
        self.search_index = []
        
        # Pass 1: Populate id_name_map
        for item in self.items:
            item_id = item.get("UniqueName", "")
            if item_id:
                localized_names = item.get("LocalizedNames") or {}
                self.id_name_map[item_id] = localized_names.get("ES-ES") or localized_names.get("EN-US") or item_id
                
        seen_display_names = set()
        
        # Pass 2: Build groupings and search index
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
                
            # Classify using UniqueName
            category = self._get_item_category(item_id)
            if not category:
                continue
                
            # Add base item (no enchantment level/suffix) to optimized search index
            if "@" not in item_id and not any(lvl in item_id for lvl in ["_LEVEL1", "_LEVEL2", "_LEVEL3", "_LEVEL4"]):
                if base_display_name not in seen_display_names:
                    seen_display_names.add(base_display_name)
                    
                    localized_names = item.get("LocalizedNames") or {}
                    name_es = localized_names.get("ES-ES") or display_name
                    name_en = localized_names.get("EN-US") or display_name
                    
                    self.search_index.append({
                        "name_es": clean_base_name(name_es),
                        "name_en": clean_base_name(name_en),
                        "id": item_id,
                        "category": category,
                        "display_name": base_display_name
                    })
                    
        self.item_names = list(seen_display_names)

    def searchItems(self, category_id, query, sub_category=""):
        if not self.items:
            return []
            
        # Filter items belonging to the selected category
        category_items = [x for x in self.search_index if x["category"] == category_id]
        
        # Filter by sub-category (Plate, Leather, Cloth)
        if sub_category:
            sub = sub_category.upper()
            if sub == "PLACA":
                category_items = [x for x in category_items if "_PLATE_" in x["id"]]
            elif sub == "CUERO":
                category_items = [x for x in category_items if "_LEATHER_" in x["id"]]
            elif sub == "TELA":
                category_items = [x for x in category_items if "_CLOTH_" in x["id"]]
            elif sub == "CAPA":
                category_items = [x for x in category_items if "_CAPE" in x["id"]]
            elif sub == "BOLSA":
                category_items = [x for x in category_items if "_BAG" in x["id"]]
        
        query = query.strip()
        if not query:
            # Return first 50 items of the category sorted alphabetically
            category_items.sort(key=lambda x: x["display_name"])
            return [{"display_name": x["display_name"], "id": x["id"]} for x in category_items[:50]]
            
        scored = []
        for item in category_items:
            score_es = calculate_score(query, item["name_es"])
            score_en = calculate_score(query, item["name_en"])
            score_id = calculate_score(query, item["id"])
            best_score = max(score_es, score_en, score_id)
            
            if best_score > 0:
                scored.append((best_score, item["display_name"], item["id"]))
                
        # Sort by score descending, then by display name alphabetically
        scored.sort(key=lambda x: (-x[0], x[1]))
        
        return [{"display_name": x[1], "id": x[2]} for x in scored[:50]]

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
                    
                    # If empty, populate with default test zones
                    if not self.zones:
                        try:
                            from test_zones_data import get_default_test_zones
                            self.zones = get_default_test_zones()
                            self._save_zones()
                        except ImportError:
                            pass
                    else:
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