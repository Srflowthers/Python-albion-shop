import json
import os
import sys

# Get cache path
app_data = os.environ.get('LOCALAPPDATA') or os.environ.get('APPDATA') or os.path.expanduser('~')
cache_file = os.path.join(app_data, 'AlbionMarket', 'items_cache.json')

if not os.path.exists(cache_file):
    print("Cache file not found at " + cache_file)
    sys.exit(1)

with open(cache_file, 'r', encoding='utf-8') as f:
    items = json.load(f)

print(f"Total items: {len(items)}")

matches = []
for item in items:
    uname = item.get("UniqueName", "")
    # Check for exact matches of RUNE, SOUL, RELIC with tier prefixes
    if any(uname.endswith(f"_{kw}") for kw in ["RUNE", "SOUL", "RELIC"]):
        matches.append(item)

print(f"Total matching items: {len(matches)}")
for m in matches:
    localized = m.get("LocalizedNames") or {}
    print(f"ID: {m.get('UniqueName')} -> ES: {localized.get('ES-ES')} | EN: {localized.get('EN-US')}")
