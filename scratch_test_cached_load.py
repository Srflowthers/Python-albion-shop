import os
import sys
import json
from App import AlbionAPI

try:
    print("Initializing AlbionAPI...")
    api = AlbionAPI()
    print("Zones loaded:", len(api.zones))
    print("Recent zones:", api.recent_zones)
    
    print("\nCalling loadDatabase()...")
    res = api.loadDatabase()
    print("Result:", res)
    if not res["success"]:
        print("Detailed Error:", res.get("error"))
except Exception as e:
    import traceback
    print("CRITICAL EXCEPTION:")
    traceback.print_exc()
