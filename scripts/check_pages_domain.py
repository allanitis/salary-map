import os, json, sys, urllib.request

TOKEN = os.environ.get("CF_PAGES_TOKEN") or os.environ.get("CLOUDFLARE_API_TOKEN")
ACCOUNT = "688ee08a15b5e77610160a89cf2404db"
url = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/pages/projects/canibuyhere/domains"
req = urllib.request.Request(url, headers={"Authorization": f"Bearer {TOKEN}"})
data = json.loads(urllib.request.urlopen(req).read())
if not data.get("success"):
    print("ERROR:", data.get("errors")); sys.exit(1)
for d in data["result"]:
    print(f"{d['name']:<28} status={d['status']:<14} validation={d.get('validation_data',{}).get('status')}")
