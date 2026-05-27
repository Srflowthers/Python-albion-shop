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
        posibles = api.item_map.get(r["display_name"], [])
        print(f"  - '{r['display_name']}' ({r['id']}) -> UniqueName sample: {posibles[:3]}")

# Test a few other artifact weapons
other_weapons = ["arco susurrante", "invocador de luz", "daybreaker"]
for q in other_weapons:
    print(f"\nSearching for '{q}' in category 1 (Armas)...")
    results = api.searchItems("1", q)
    print("Search results:")
    for r in results:
        posibles = api.item_map.get(r["display_name"], [])
        print(f"  - '{r['display_name']}' ({r['id']}) -> UniqueName sample: {posibles[:3]}")

# Test Food Tiers lookup
print("\nTesting Food Tiers lookup for 'MEAL_STEW'...")
food_tiers = api.getItemTiers("MEAL_STEW")
print("Food Tiers found:")
for t in food_tiers:
    print(f"  - Tier {t['tier']} ({t['id']}): {t['name']}")

# Test Artifacts Category and Tiers lookup
print("\nTesting Artifacts Category (Category 8)...")
results = api.searchItems("8", "Runa")
print("Artifact search results for 'Runa':")
for r in results:
    print(f"  - '{r['display_name']}' ({r['id']})")

print("\nTesting Artifact Tiers lookup for 'Runa'...")
runa_tiers = api.getItemTiers("Runa")
print("Runa Tiers found:")
for t in runa_tiers:
    print(f"  - Tier {t['tier']} ({t['id']}): {t['name']}")

print("\nVerification completed successfully!")
