import requests

urls = [
    "https://gameinfo.albiononline.com/worldmap/zones",
    "https://gameinfo.albiononline.com/api/worldmap/zones",
    "https://gameinfo.albiononline.com/api/gameinfo/worldmap/zones"
]

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json"
}

for url in urls:
    try:
        print(f"Testing {url}...")
        r = requests.get(url, headers=headers, timeout=10)
        print(f"Status: {r.status_code}")
        if r.status_code == 200:
            print("Success! Length:", len(r.json()))
            print("First item:", r.json()[0])
            break
        else:
            print(f"Response: {r.text[:200]}")
    except Exception as e:
        print(f"Error for {url}: {e}")
