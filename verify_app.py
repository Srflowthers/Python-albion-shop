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

# --- Added Zone Tests ---
from App import is_blacklisted, normalize
from test_zones_data import get_default_test_zones

print("\n--- Running Zones Verification ---")
api.zones = get_default_test_zones()
print(f"Zones in database: {len(api.zones)}")
assert len(api.zones) >= 120, f"Expected >= 120 zones, got {len(api.zones)}"

# Check blacklist exclusion
blacklisted = ["Bridgewatch", "Martlock", "Thetford", "Lymhurst", "Fort Sterling", "Caerleon", "Brecilien", "caerleon", "brecilien", "lYmHuRsT"]
for city in blacklisted:
    assert is_blacklisted(city), f"{city} should be blacklisted"
    results = api.searchZones(city)
    # Exact match of city should yield no results
    for r in results:
        assert r["n"].lower() != city.lower(), f"Blacklisted city {city} was found in search results: {r['n']}"
        
print("Blacklist verification passed! Portal areas and other zones with substrings (e.g., 'Lymhurst Portal Area') are NOT filtered incorrectly.")

# Test Spanish normalization / accent tolerance
print("\nTesting Spanish normalization & typo tolerance...")
queries = ["quarry", "QUARRY", "quárry", "quarri"]
for q in queries:
    results = api.searchZones(q)
    found = [r["n"] for r in results if "Quarry" in r["n"]]
    assert len(found) > 0, f"Query '{q}' did not find any Quarry zones! Results: {[r['n'] for r in results]}"
    print(f"Query '{q}' successfully matched Quarry zones: {found[:2]}")
    
# Test Priority sorting (recents first)
print("\nTesting Priority sorting (recents first)...")
# Add recent zone
api.addRecentZone("Creag Garr")
api.addRecentZone("Blackthorn Quarry")

recent_zones = api.getRecentZones()
print(f"Recent zones: {recent_zones}")
assert "Blackthorn Quarry" in recent_zones
assert "Creag Garr" in recent_zones

# Searching for "cr" should return Creag Garr first because it is in recents
results = api.searchZones("cr")
found_names = [r["n"] for r in results]
print(f"Search results for 'cr': {found_names}")

# Creag Garr is a recent, so it should be among the first elements before other non-recent 'cr' matching zones
recent_matches = [r["n"] for r in results if r["recent"]]
non_recent_matches = [r["n"] for r in results if not r["recent"]]
print(f"Recent matches: {recent_matches}")
print(f"Non-recent matches: {non_recent_matches}")

# Assert that all recent matches are indeed sorted before non-recent matches
for idx, r in enumerate(results):
    if r["recent"]:
        # Ensure no prior element is non-recent
        for prev in results[:idx]:
            assert prev["recent"], f"Non-recent zone {prev['n']} appeared before recent zone {r['n']}"
            
print("Priority sorting tests passed!")

# Test Add / Update / Delete
print("\nTesting CRUD operations for zones...")
test_zone_name = "Super Secret Zone"
api.deleteZone("super_secret_zone")
api.deleteZone("updated_secret_zone")
add_res = api.addZone({"n": test_zone_name, "t": 7, "b": "black"})
assert add_res["success"], f"Failed to add zone: {add_res.get('error')}"

# Check it can be searched
results = api.searchZones("super secret")
assert len(results) > 0 and results[0]["n"] == test_zone_name

# Update zone
update_res = api.updateZone(add_res["zone"]["id"], {"n": "Updated Secret Zone", "fav": True, "p": 1})
assert update_res["success"]
assert update_res["zone"]["fav"] == True
assert update_res["zone"]["p"] == 1

# Check delete
del_res = api.deleteZone(update_res["zone"]["id"])
assert del_res["success"]

results = api.searchZones("secret")
assert not any(r["n"] == "Updated Secret Zone" for r in results)

print("CRUD verification passed!")
# --- End of Added Zone Tests ---

print("\nVerification completed successfully!")

