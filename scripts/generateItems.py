import os
import requests
import json
import urllib.parse
import re
import time
import html
from pathlib import Path
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

FILE_NAME = '../cdn/json/items.json'
WIKI_BASE = 'https://oldschool.runescape.wiki'
API_BASE = WIKI_BASE + '/api.php'
IMG_PATH = '../cdn/items/'

HEADERS = {
    'User-Agent': 'OSRS Bank-Simulator'
}

BUCKET_API_FIELDS = [
    'page_name',
    'page_name_sub',
    'item_name',
    'image',
    'item_id',
    'infobox_bonuses.equipment_slot',
]

def get_session():
    session = requests.Session()

    retries = Retry(
        total=5,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"]
    )
    session.mount('https://', HTTPAdapter(max_retries=retries))
    session.headers.update(HEADERS)
    return session

def get_equipment_data(session):
    equipment = []
    offset = 0
    fields_csv = ",".join(map(repr, BUCKET_API_FIELDS))
    
    while True:
        print(f'Fetching equipment info: {offset}')
        query = {
            'action': 'bucket',
            'format': 'json',
            'query':
            (
                f"bucket('infobox_item')"
                f".select({fields_csv})"
                f".limit(500).offset({offset})"
                f".where('item_id', '!=', bucket.Null())"
                f".where('Category:Items')"
                # f".where('infobox_bonuses.equipment_slot', '!=', bucket.Null())"
                f".join('infobox_bonuses', 'infobox_bonuses.page_name_sub', 'infobox_item.page_name_sub')"
                # Exclude
                f".where(bucket.Not('Category:Interface items'))"
                f".where(bucket.Not('Category:Discontinued content'))"
                f".where(bucket.Not('Category:Beta items'))"
                f".where(bucket.Not('Category:Unobtainable items'))"
                # ---
                f".orderBy('page_name_sub', 'asc').run()"
            )
        }

        r = session.get(API_BASE, params=query, timeout=30)
        r.raise_for_status()
        data = r.json()

        if 'bucket' not in data:
            break

        equipment.extend(data['bucket'])
        if len(data['bucket']) < 500:
            break
        
        offset += 500
        time.sleep(0.5)

    return equipment

def get_direct_image_urls(session, image_names):
    """
    Takes a list of 'File:Image.png' names and returns a map of {name: direct_url}.
    This is much faster and safer than Special:Filepath.
    """
    url_map = {}

    for i in range(0, len(image_names), 50):
        batch = image_names[i:i+50]
        params = {
            'action': 'query',
            'format': 'json',
            'prop': 'imageinfo',
            'iiprop': 'url',
            'titles': '|'.join([f'File:{img}' if not img.startswith('File:') else img for img in batch])
        }
        r = session.get(API_BASE, params=params)
        data = r.json()
        
        pages = data.get('query', {}).get('pages', {})
        for page_id, info in pages.items():
            title = info.get('title', '').replace('File:', '')
            if 'imageinfo' in info:
                url_map[title] = info['imageinfo'][0]['url']
        
        time.sleep(0.2)
    return url_map

def main():
    session = get_session()
    wiki_data = get_equipment_data(session)

    data = {}
    required_imgs = set()
    download_queue = {}

    for v in wiki_data:
        pns = v['page_name_sub']
        if pns in data:
            continue

        try:
            item_id = int(v.get('item_id')[0]) if v.get('item_id') else None
        except (ValueError, TypeError):
            continue

        wiki_img_name = '' if not v.get('image') else v.get('image')[-1].replace('File:', '')
        if not wiki_img_name:
            continue

        clean_name = html.unescape(wiki_img_name)
        local_filename = re.sub(r'[\\/*?:"<>|]', '', clean_name).replace(' ', '_')

        data[pns] = {
            'name': v['item_name'],
            'id': item_id,
            'image': local_filename,
            'slot': v.get('infobox_bonuses.equipment_slot', ''),
            'category': None # Extend later
        }

        download_queue[local_filename] = clean_name

    # Save JSON
    img_root = Path(IMG_PATH)
    img_root.mkdir(parents=True, exist_ok=True)

    with open(FILE_NAME, 'w', encoding='utf-8') as f:
        print(f'Saving to JSON: {FILE_NAME}')
        json.dump(list(data.values()), f, ensure_ascii=False, indent=2)

    # Download Logic
    to_download = []
    for local, wiki in download_queue.items():
        if not (img_root / local).is_file():
            to_download.append(wiki)

    if not to_download:
        print("All images already exist.")
        return

    print(f"Resolving URLs for {len(to_download)} missing images...")
    url_map = get_direct_image_urls(session, to_download)

    success_count = 0
    for idx, (wiki_name, direct_url) in enumerate(url_map.items()):

        local_name = re.sub(r'[\\/*?:"<>|]', '', wiki_name).replace(' ', '_')
        target_file = img_root / local_name

        print(f'({idx + 1}/{len(url_map)}) Downloading: {local_name}')
        try:
            r = session.get(direct_url, timeout=20)
            if r.ok:
                with open(target_file, 'wb') as f:
                    f.write(r.content)
                success_count += 1
            
            time.sleep(0.2) 
        except Exception as e:
            print(f"Error downloading {wiki_name}: {e}")

    print(f"Finished. Saved {success_count} new images.")

if __name__ == "__main__":
    main()