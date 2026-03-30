"""
    Script to generate an items.json of all the items on the OSRS Wiki, and downloads images for each item.
    The JSON file is placed in ../src/lib/items.json.

    The images are placed in ../cdn/items/. This directory is NOT included in the Next.js app bundle, and should
    be deployed separately to our file storage solution.

    Written for Python 3.9.
"""
import os
import requests
import json
import urllib.parse
import re

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
]

ITEMS_TO_SKIP = [
    'The dogsword',
    'Drygore blowpipe',
    'Amulet of the monarchs',
    'Emperor ring',
    'Devil\'s element',
    'Nature\'s reprisal',
    'Gloves of the damned',
    'Crystal blessing',
    'Sunlight spear',
    'Sunlit bracers',
    'Thunder khopesh',
    'Thousand-dragon ward',
    'Arcane grimoire',
    'Wristbands of the arena',
    'Wristbands of the arena (i)',
    'Armadyl chainskirt (or)',
    'Armadyl chestplate (or)',
    'Armadyl helmet (or)',
    'Dagon\'hai hat (or)',
    'Dagon\'hai robe bottom (or)',
    'Dagon\'hai robe top (or)',
    'Dragon warhammer (or)',
    'Centurion cuirass',
    'Ruinous powers (item)',
    'Battlehat',
    'Zaryte bow'
]

def getEquipmentData():
    equipment = []
    offset = 0
    fields_csv = ",".join(map(repr, BUCKET_API_FIELDS))
    while True:
        print('Fetching equipment info: ' + str(offset))
        innerQuery = {
            'query': 
            (
                f"bucket('infobox_item')"
                f".select({fields_csv})"
                f".limit(500).offset({offset})"
                f".where('item_id', '!=', bucket.Null())"
                f".where('Category:Items')"
                # f".where('Category:Equipable items')"
                # Exclude
                f".where(bucket.Not('Category:Interface items'))"
                f".where(bucket.Not('Category:Unobtainable items'))"
                f".where(bucket.Not('Category:Discontinued content'))"
                f".where(bucket.Not('Category:Beta items'))"
                # ---
                f".orderBy('item_name', 'asc').run()"
            )
        }
        query = {
            'action': 'bucket',
            'format': 'json',
            'query':  innerQuery.get('query')
        }

        r = requests.get(API_BASE + '?' + urllib.parse.urlencode(query), headers=HEADERS)

        if (r.status_code != 200):
            print("Error fetching data from wiki API: " + str(r.status_code))
            break

        data = r.json()

        if 'bucket' not in data:
            print("No bucket data found!")
            # No results?
            break

        equipment = equipment + data['bucket']

        # Bucket's API doesn't tell you when there are more results, so we'll just have to guess
        if len(data['bucket']) == 500:
            offset += 500
        else:
            # If we are at the end of the results, break out of this loop
            break

    return equipment


def main():
    # Grab the equipment info using Bucket
    wiki_data = getEquipmentData()

    # Use an object rather than an array, so that we can't have duplicate items with the same page_name_sub
    data = {}
    required_imgs = []

    # Loop over the equipment data from the wiki
    for v in wiki_data:
        if v['page_name_sub'] in data:
            continue

        print(f"Processing {v['page_name_sub']}")

        try:
            item_id = int(v.get('item_id')[0]) if v.get('item_id') else None
        except ValueError:
            # Item has an invalid ID, do not show it here as it's probably historical or something.
            print("Skipping - invalid item ID (not an int)")
            continue

        equipment = {
            'name': v['item_name'],
            'id': item_id,
            'image': '' if not v.get('image') else v.get('image')[-1].replace('File:', ''),
            'imagepath': re.sub(r'[^a-zA-Z0-9\s._()-]', '_','' if not v.get('image') else v.get('image')[-1].replace('File:', '')),
        }
    
        if equipment['name'] in ITEMS_TO_SKIP:
            continue

        # Set the current equipment item to the calc's equipment list
        data[v['page_name_sub']] = equipment

        if not equipment['image'] == '':
            required_imgs.append(equipment['image'])

    new_data = list(data.values())

    print('Total equipment: ' + str(len(new_data)))
    new_data.sort(key=lambda d: d.get('name'))

    with open(FILE_NAME, 'w') as f:
        print('Saving to JSON at file: ' + FILE_NAME)
        json.dump(new_data, f, ensure_ascii=False, indent=2)

    success_img_dls = 0
    failed_img_dls = 0
    skipped_img_dls = 0
    required_imgs = set(required_imgs)

    # Fetch all the images from the wiki and store them for local serving
    for idx, img in enumerate(required_imgs):

        imgName = re.sub(r'[^a-zA-Z0-9\s._()-]', '_', img)

        if os.path.isfile(IMG_PATH + imgName):
            skipped_img_dls += 1
            continue

        print(f'({idx}/{len(required_imgs)}) Fetching image: {img}')
        r = requests.get(WIKI_BASE + '/w/Special:Filepath/' + img, headers=HEADERS)
        if r.ok:
            with open(IMG_PATH + imgName, 'wb') as f:
                f.write(r.content)
                print('Saved image: ' + imgName)
                success_img_dls += 1
        else:
            print('Unable to save image: ' + imgName)
            failed_img_dls += 1

    print('Total images saved: ' + str(success_img_dls))
    print('Total images skipped (already exists): ' + str(skipped_img_dls))
    print('Total images failed to save: ' + str(failed_img_dls))
    
    # Download the itemsmin.js file into ../cdn/js/
    try:
        url = 'https://chisel.weirdgloop.org/moid/data_files/itemsmin.js'
        local_filename = url.split('/')[-1]
        target_dir = os.path.normpath(os.path.join(os.path.dirname(FILE_NAME), '..', 'js'))
        os.makedirs(target_dir, exist_ok=True)
        out_path = os.path.join(target_dir, local_filename)
        print(f'Downloading {url} -> {out_path}')
        with requests.get(url, stream=True, headers=HEADERS) as r:
            if r.ok:
                with open(out_path, 'wb') as f:
                    f.write(r.content[6:])
                print('Saved', out_path)
            else:
                print('Failed to download', url, 'status', r.status_code)
    except Exception as e:
        print('Error downloading itemsmin.js:', e)

main()