import os
import sys
import json
import requests

ITEMS_URL = "https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json"
ITEMS_FALLBACK_URL = "https://cdn.jsdelivr.net/gh/ao-data/ao-bin-dumps@master/formatted/items.json"

app_data = os.environ.get('LOCALAPPDATA') or os.environ.get('APPDATA') or os.path.expanduser('~')
dir_path = os.path.join(app_data, 'AlbionMarket')
CACHE_FILE = os.path.join(dir_path, "items_cache.json")

print("1. CACHE FILE PATH:", CACHE_FILE)
print("2. CACHE FILE EXISTS:", os.path.exists(CACHE_FILE))
if os.path.exists(CACHE_FILE):
    size = os.path.getsize(CACHE_FILE)
    print("3. CACHE FILE SIZE:", size, "bytes")
    if size < 100:
        print("WARNING: Cache file is suspiciously small!")

print("\n--- Testing Main URL ---")
try:
    response = requests.get(ITEMS_URL, timeout=10)
    print("Status Code:", response.status_code)
    print("Response Length:", len(response.content))
    print("JSON Parse Test:", type(response.json()))
except Exception as e:
    print("MAIN URL ERROR:", e)

print("\n--- Testing Fallback URL ---")
try:
    response = requests.get(ITEMS_FALLBACK_URL, timeout=10)
    print("Status Code:", response.status_code)
    print("Response Length:", len(response.content))
    print("JSON Parse Test:", type(response.json()))
except Exception as e:
    print("FALLBACK URL ERROR:", e)
