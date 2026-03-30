import json
import os
import requests
from bs4 import BeautifulSoup

url = "https://oldschool.runescape.wiki/w/Item_IDs"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

response = requests.get(url, headers=headers)
response.raise_for_status()

soup = BeautifulSoup(response.text, "html.parser")

file_path = "items.json"
old_items = []

if os.path.exists(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        old_items = json.load(f)

items = []

table = soup.find("table", {"class": "wikitable"})
if not table:
    raise Exception("Could not find wikitable on site")

for row in table.find_all("tr")[1:]:
    cols = row.find_all("td")
    if len(cols) >= 2:
        name = cols[0].text.strip()
        id_ = cols[1].text.strip()
        if id_.isdigit():
            items.append({"id": id_, "name": name})

if len(items) > len(old_items):
    with open("items.json", "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)
    print("Saved new items.json")
else:
    print("items.json already up to date.")