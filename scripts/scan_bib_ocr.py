#!/usr/bin/env python3
"""Scan Pailixiang album thumbnails for a bib number using OCR."""

import requests
import json
import time
import sys
import io
import os
from pathlib import Path

def main():
    album_page_id = "ia4213560272"
    album_id = "213e1462-d348-4235-b669-3849166ec641"
    bib = "498"
    
    import easyocr
    reader = easyocr.Reader(['en'], gpu=False, verbose=False)
    print(f"OCR initialized. Scanning for bib '{bib}'...")
    
    s = requests.Session()
    headers = {'User-Agent': 'Mozilla/5.0'}
    s.get(f'https://www.pailixiang.com/m/album_{album_page_id}.html', headers=headers, timeout=15)
    
    h2 = {
        'User-Agent': 'Mozilla/5.0',
        'Referer': f'https://www.pailixiang.com/m/album_{album_page_id}.html',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
    }
    
    out_dir = Path('_temp_pailixiang_4213560272')
    out_dir.mkdir(exist_ok=True)
    matches_file = out_dir / 'matches.json'
    
    # Load existing matches
    matches = []
    if matches_file.exists():
        matches = json.load(open(matches_file, encoding='utf-8'))
        print(f"Loaded {len(matches)} existing matches")
    
    last_id = ''
    page = 0
    total_scanned = 0
    
    while True:
        page += 1
        body = f'albumId={album_id}&groupId=&len=100&from={last_id}&order=0&accessType=1&opt=0&nw=&pay=0'
        resp = s.post('https://www.pailixiang.com/Wap/Services/AlbumDetail.ashx?t=2&rid=test', 
                      data=body, headers=h2, timeout=15)
        result = resp.json()
        photos = result.get('Data', [])
        if not photos:
            break
        last_id = photos[-1]['ID']
        
        for p in photos:
            total_scanned += 1
            fname = p.get('Name', '')
            img_url = p.get('ImageUrl', '')
            if not img_url:
                continue
            
            try:
                r = s.get(img_url, headers=headers, timeout=10)
                if r.status_code != 200:
                    continue
                
                # OCR on thumbnail bytes
                results = reader.readtext(r.content)
                texts = [t[1] for t in results]
                
                # Check if bib number appears
                for text in texts:
                    if bib in text:
                        print(f"  *** MATCH: {fname} (text: {text}) ShootTime: {p.get('ShootTime','')}")
                        matches.append({
                            'Name': fname,
                            'ID': p.get('ID'),
                            'ShootTime': p.get('ShootTime', ''),
                            'DownloadImageUrl': p.get('DownloadImageUrl', ''),
                            'matched_text': text,
                            'all_texts': texts,
                        })
                        # Save matches incrementally
                        with open(matches_file, 'w', encoding='utf-8') as f:
                            json.dump(matches, f, ensure_ascii=False, indent=2)
                        break
                        
            except Exception as e:
                pass
        
        print(f"Page {page}: scanned {total_scanned} photos, {len(matches)} matches so far")
        
        if len(photos) < 100:
            break
        time.sleep(0.2)
    
    print(f"\nDone! Scanned {total_scanned} photos, found {len(matches)} matches")
    if matches:
        print("\nMatched photos:")
        for m in matches:
            print(f"  {m['Name']} - {m['ShootTime']} (text: {m['matched_text']})")

if __name__ == '__main__':
    main()
