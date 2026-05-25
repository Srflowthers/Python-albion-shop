import os
import sys
import json
import requests
import webview
from difflib import get_close_matches

ITEMS_URL = "https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json"
CACHE_FILE = "items_cache.json"

class AlbionAPI:
    def __init__(self):
        self.items = []
        self.item_map = {}
        self.item_names = []
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

    def _build_item_maps_cached(self):
        # Mapea todos los items para agilizar búsquedas subsecuentes
        self.item_map = {}
        self.item_names = []
        for item in self.items:
            localized_names = item.get("LocalizedNames")
            if not localized_names:
                continue
            name = localized_names.get("ES-ES")
            if not name:
                continue
            
            if name not in self.item_map:
                self.item_map[name] = []
            
            unique_name = item.get("UniqueName")
            if unique_name and unique_name not in self.item_map[name]:
                self.item_map[name].append(unique_name)
            
            if name not in self.item_names:
                self.item_names.append(name)

    def searchItems(self, category_id, query):
        if not self.items:
            return []
            
        allowed = self.categorias.get(category_id, ("", []))[1]
        
        # Filtrar nombres que pertenezcan a la categoría elegida
        filtered_names = []
        for name in self.item_names:
            if any(k.lower() in name.lower() for k in allowed):
                filtered_names.append(name)
                
        query = query.lower().strip()
        if not query:
            # Retornar los primeros 10 items por defecto para esa categoría
            return filtered_names[:10]
            
        stop_words = ["de", "del", "el", "la", "los", "las", "un", "una"]
        words = [w for w in query.split() if w not in stop_words and len(w) > 1]
        
        scored = []
        for name in filtered_names:
            lname = name.lower()
            item_words = lname.split()
            score = 0
            
            if query in lname:
                score += 15
                
            for w in words:
                if w in lname:
                    score += 5
                else:
                    match = get_close_matches(w, item_words, n=1, cutoff=0.7)
                    if match:
                        score += 3
            if score > 0:
                scored.append((score, name))
                
        scored.sort(key=lambda x: x[0], reverse=True)
        return [x[1] for x in scored[:10]]

    def getPrices(self, selected_name, tier_choice, enc_choice, server):
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
                formatted_prices.append({
                    "city": p["city"],
                    "sell_price_min": p["sell_price_min"],
                    "buy_price_max": p.get("buy_price_max", 0),
                    "item_id": p["item_id"]
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
                "tier_label": tier_best
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

def get_entrypoint():
    # Si se ejecuta como paquete de PyInstaller, buscar en la carpeta temporal _MEIPASS
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