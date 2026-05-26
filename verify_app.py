import sys
import os

# Add current folder to path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from App import AlbionAPI

print("Initializing AlbionAPI...")
api = AlbionAPI()

print("Loading Database (from cache)...")
res = api.loadDatabase()
print("Load database result:", res)
print(f"Total search index entries: {len(api.search_index)}")
print(f"Total items in item_map: {len(api.item_map)}")
print(f"Total items in id_name_map: {len(api.id_name_map)}")

queries = ["Perfora Nieblas", "perfora nieblas", "mistpiercer", "Mistpiercer", "mist piercer", "perfora"]

for q in queries:
    print(f"\nSearching for '{q}' in category 1 (Armas)...")
    results = api.searchItems("1", q)
    print("Search results:")
    for r in results:
        posibles = api.item_map.get(r, [])
        print(f"  - '{r}' -> UniqueName sample: {posibles[:3]}")

# Test a few other artifact weapons
other_weapons = ["arco susurrante", "invocador de luz", "daybreaker"]
for q in other_weapons:
    print(f"\nSearching for '{q}' in category 1 (Armas)...")
    results = api.searchItems("1", q)
    print("Search results:")
    for r in results:
        posibles = api.item_map.get(r, [])
        print(f"  - '{r}' -> UniqueName sample: {posibles[:3]}")

print("\nVerification completed successfully!")
