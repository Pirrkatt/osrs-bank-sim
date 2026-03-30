import json
import os
import time
import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": "bank-simulator"
}

BASE = "https://oldschool.runescape.wiki"

def get_item_ids():
    url = f"{BASE}/w/Item_IDs"
    r = requests.get(url, headers=HEADERS, timeout=20)
    r.raise_for_status()

    soup = BeautifulSoup(r.text, "html.parser")
    table = soup.find("table", class_="wikitable")
    if not table:
        raise Exception("Item table not found")

    items = []
    for row in table.find_all("tr")[1:]:
        cols = row.find_all("td")
        if len(cols) >= 2:
            name = cols[0].get_text(strip=True)
            id_ = cols[1].get_text(strip=True)

            if id_.isdigit():
                items.append({
                    "id": int(id_),
                    "name": name
                })

    return items


def get_image_url(item_id):
    url = f"{BASE}/w/Special:Lookup?type=item&id={item_id}"
    r = requests.get(url, headers=HEADERS, timeout=20)

    if r.status_code != 200:
        return None

    soup = BeautifulSoup(r.text, "html.parser")

    img = soup.select_one("img.mw-file-element")
    if not img:
        return None

    src = img.get("src")
    if not src:
        return None

    if src.startswith("//"):
        src = "https:" + src
    elif src.startswith("/"):
        src = BASE + src

    return src


def main():
    output = "items.json"

    items = get_item_ids()
    print(f"Found {len(items)} items")

    result = []

    for i, item in enumerate(items, 1):
        # print(f"[{i}/{len(items)}] {item['name']}")

        img = get_image_url(item["id"])
        if img:
            item["image"] = img
            result.append(item)

        # time.sleep(1)

    with open(output, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"Saved {len(result)} items to {output}")


if __name__ == "__main__":
    main()
