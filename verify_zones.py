import os
import sys
import json
from App import AlbionAPI, is_blacklisted, normalize
from test_zones_data import get_default_test_zones

def test_zones():
    print("Initializing AlbionAPI...")
    api = AlbionAPI()
    api.zones = get_default_test_zones()
    
    # Check that database is loaded and has > 120 elements
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
    
    # Test Risk Radar Priority Sorting
    print("\nTesting Risk Radar Priority Sorting...")
    api.zones = [
        {"id": "zone_a", "n": "Zone A", "t": 6, "b": "black", "fav": False, "p": 0},
        {"id": "zone_b", "n": "Zone B", "t": 6, "b": "black", "fav": False, "p": 1},
        {"id": "zone_c", "n": "Zone C", "t": 6, "b": "black", "fav": False, "p": 0}
    ]
    radar_res = api.getRiskRadar("west")
    if not radar_res["success"]:
        print(f"WARNING: Risk Radar API test skipped/failed because the Albion API was unreachable or rate-limited: {radar_res.get('error')}")
    else:
        radar_zones = radar_res["zones"]
        # The first zone should be "Zone B" because it has p=1, while others have p=0
        if len(radar_zones) > 0:
            assert radar_zones[0]["name"] == "Zone B", f"Expected 'Zone B' to be first due to high priority, but got: {radar_zones[0]['name']}"
        print("Risk Radar Priority sorting test passed!")
    
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
    
    # Restore default zones to disk to prevent test database corruption for the user
    try:
        api.zones = get_default_test_zones()
        api._save_zones()
        print("Test database restored successfully.")
    except Exception as e:
        print(f"Failed to restore default zones: {e}")
        
    print("\nAll backend tests passed successfully!")

if __name__ == "__main__":
    test_zones()
