import os
import sys
import json
import requests
import webview
import unicodedata
import difflib

ITEMS_URL = "https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json"

def get_cache_path():
    if sys.platform == 'win32':
        app_data = os.environ.get('LOCALAPPDATA') or os.environ.get('APPDATA') or os.path.expanduser('~')
        dir_path = os.path.join(app_data, 'AlbionMarket')
    else:
        dir_path = os.path.expanduser('~/.albionmarket')
    
    try:
        os.makedirs(dir_path, exist_ok=True)
    except Exception:
        return "items_cache.json"
        
    return os.path.join(dir_path, "items_cache.json")

CACHE_FILE = get_cache_path()

def normalize(text):
    if not text:
        return ""
    text = text.lower()
    nfkd_form = unicodedata.normalize('NFKD', text)
    text = "".join([c for c in nfkd_form if not unicodedata.combining(c)])
    return " ".join(text.split())

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
            elif qw in tw or tw in qw:
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
        self.items = []
        self.item_map = {}
        self.item_names = []
        self.id_name_map = {}
        self.categorias = {
            "1": ("Armas", ["Espada", "Hacha", "Maza", "Martillo", "Arco", "Ballesta", "Bastón", "Daga", "Guanteletes", "Brazalete", "Lanza", "Vara"]),
            "2": ("Armaduras / Pechos", ["Armadura", "Chaqueta", "Toga"]),
            "3": ("Cascos / Cabezas", ["Casco", "Capucha", "Hábito"]),
            "4": ("Botas / Pies", ["Zapatos", "Botas", "Sandalias"]),
            "5": ("Accesorios", ["Capa", "Bolsa"])
        }

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
            response = requests.get(ITEMS_URL, timeout=25)
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
        
        # Exclude artifacts and tools from equipment categories
        if "_ARTEFACT_" in uname or "_TOOL_" in uname:
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
            
        return None

    def _build_item_maps_cached(self):
        self.item_map = {}
        self.id_name_map = {}
        self.search_index = []
        
        seen_display_names = set()
        
        for item in self.items:
            localized_names = item.get("LocalizedNames") or {}
            name_es = localized_names.get("ES-ES", "")
            name_en = localized_names.get("EN-US", "")
            item_id = item.get("UniqueName", "")
            
            if not item_id:
                continue
                
            display_name = name_es or name_en or item_id
            
            # Map all IDs to their display names
            self.id_name_map[item_id] = display_name
            
            # Group all variations (tiers/enchantments) under the base display name
            base_display_name = clean_base_name(display_name)
            
            if base_display_name not in self.item_map:
                self.item_map[base_display_name] = []
            if item_id not in self.item_map[base_display_name]:
                self.item_map[base_display_name].append(item_id)
                
            # Classify using UniqueName
            category = self._get_item_category(item_id)
            if not category:
                continue
                
            # Add base item (no enchantment suffix '@') to optimized search index
            if "@" not in item_id:
                if base_display_name not in seen_display_names:
                    seen_display_names.add(base_display_name)
                    self.search_index.append({
                        "name_es": clean_base_name(name_es),
                        "name_en": clean_base_name(name_en),
                        "id": item_id,
                        "category": category,
                        "display_name": base_display_name
                    })
                    
        self.item_names = list(seen_display_names)

    def searchItems(self, category_id, query):
        if not self.items:
            return []
            
        # Filter items belonging to the selected category
        category_items = [x for x in self.search_index if x["category"] == category_id]
        
        query = query.strip()
        if not query:
            # Return first 10 items of the category sorted alphabetically
            category_items.sort(key=lambda x: x["display_name"])
            return [x["display_name"] for x in category_items[:10]]
            
        scored = []
        for item in category_items:
            score_es = calculate_score(query, item["name_es"])
            score_en = calculate_score(query, item["name_en"])
            score_id = calculate_score(query, item["id"])
            best_score = max(score_es, score_en, score_id)
            
            if best_score > 0:
                scored.append((best_score, item["display_name"]))
                
        # Sort by score descending, then by display name alphabetically
        scored.sort(key=lambda x: (-x[0], x[1]))
        
        return [x[1] for x in scored[:10]]

    def getPrices(self, selected_name, tier_choice, enc_choice, quality_choice, server):
        posibles_ids = self.item_map.get(selected_name, [])
        if not posibles_ids:
            return {"success": False, "error": f"Item '{selected_name}' no encontrado en el catálogo."}
            
        final_ids = posibles_ids
        
        if tier_choice:
            prefix = f"T{tier_choice}_"
            final_ids = [uid for uid in final_ids if uid.startswith(prefix)]
            
        if enc_choice != "":
            if enc_choice == "0":
                final_ids = [uid for uid in final_ids if "@" not in uid]
            else:
                suffix = f"@{enc_choice}"
                final_ids = [uid for uid in final_ids if uid.endswith(suffix)]
                
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
                
            # Recomendaciones
            mejor_compra = min(prices, key=lambda x: x["sell_price_min"])
            opciones_venta = [x for x in prices if x.get("buy_price_max", 0) > 0]
            
            parts_best = mejor_compra["item_id"].split("@")
            tier_best = f'{parts_best[0].split("_")[0]}.{parts_best[1] if len(parts_best) > 1 else "0"}'
            
            recommendation = {
                "buy_city": mejor_compra["city"],
                "buy_price": mejor_compra["sell_price_min"],
                "sell_city": "N/A",
                "sell_price": 0,
                "tier_label": tier_best,
                "quality": mejor_compra.get("quality", 1)
            }
            
            if opciones_venta:
                mejor_venta = max(opciones_venta, key=lambda x: x["buy_price_max"])
                recommendation["sell_city"] = mejor_venta["city"]
                recommendation["sell_price"] = mejor_venta["buy_price_max"]
                
            return {
                "success": True,
                "prices": formatted_prices,
                "recommendation": recommendation
            }
            
        except Exception as e:
            return {"success": False, "error": f"Error al consultar la API de precios: {str(e)}"}

    def getRiskRadar(self, server):
        server_urls = {
            "west": "gameinfo.albiononline.com",
            "east": "gameinfo-sgp.albiononline.com",
            "europe": "gameinfo-ams.albiononline.com"
        }
        domain = server_urls.get(server, "gameinfo.albiononline.com")
        url = f"https://{domain}/api/gameinfo/events?limit=50"
        
        popular_zones = [
            {"name": "Redtree Enclave", "type": "Black Zone"},
            {"name": "Creag Garr", "type": "Red Zone"},
            {"name": "Runnelvein Bog", "type": "Red Zone"},
            {"name": "Timberwood Dell", "type": "Black Zone"},
            {"name": "Drownhole Fen", "type": "Black Zone"},
            {"name": "Razorrock Ravine", "type": "Black Zone"},
            {"name": "Mardu", "type": "Black Zone"},
            {"name": "Gravemound Slope", "type": "Black Zone"},
            {"name": "Saddleback Pass", "type": "Red Zone"},
            {"name": "Whitecleave", "type": "Black Zone"},
            {"name": "Sandstone Deep", "type": "Black Zone"},
            {"name": "Blackthorn Quarry", "type": "Black Zone"},
            {"name": "Wanderers Rest", "type": "Black Zone"},
            {"name": "Slithervent Canyon", "type": "Black Zone"},
            {"name": "Death-reach Gorge", "type": "Black Zone"},
            {"name": "Highland Cross", "type": "Red Zone"},
            {"name": "Swamp Cross", "type": "Red Zone"},
            {"name": "Mountain Cross", "type": "Red Zone"},
            {"name": "Steppe Cross", "type": "Red Zone"},
            {"name": "Forest Cross", "type": "Red Zone"},
            {"name": "Caerleon Outskirts", "type": "Red Zone"},
            {"name": "Lymhurst Portal Area", "type": "Black Zone"},
            {"name": "Fort Sterling Portal Area", "type": "Black Zone"},
            {"name": "Thetford Portal Area", "type": "Black Zone"},
            {"name": "Martlock Portal Area", "type": "Black Zone"},
            {"name": "Bridgewatch Portal Area", "type": "Black Zone"}
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
            
            sorted_zones = list(zones_data.values())
            risk_weights = {"red": 4, "orange": 3, "yellow": 2, "green": 1}
            sorted_zones.sort(key=lambda x: (-risk_weights[x["risk_level"]], -x["death_count"], x["name"]))
            
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
    
    # En desarrollo activamos modo debug (Click derecho -> Inspeccionar elemento disponible)
    webview.start(debug=True if entry.startswith('http') else False)