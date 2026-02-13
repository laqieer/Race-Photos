#!/usr/bin/env python3
"""
Download photos from Pailixiang API (pailixiang.com).

This script handles downloading race photos from Pailixiang's API,
using bib number search to find personal photos.

API endpoints:
  - Album page: GET /m/album_{albumPageId}.html (for session cookies)
  - Bib search: POST /Wap/Services/FindMe.ashx?t=4 (albumId + num)
  - Original photo: GET /Wap/Services/AlbumDetail.ashx?t=0 (fid + uid + ext)
"""

import json
import os
import sys
import argparse
import time
import requests
from datetime import datetime
from pathlib import Path


class PailixiangDownloader:
    """Handle downloading photos from Pailixiang API."""

    BASE_URL = "https://www.pailixiang.com"

    def __init__(self, base_dir: str = "docs/images"):
        self.base_dir = Path(base_dir)
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        })

    def init_session(self, album_page_id: str):
        """Visit the album page to initialize session cookies."""
        url = f"{self.BASE_URL}/m/album_{album_page_id}.html"
        print(f"Initializing session from {url}...")
        resp = self.session.get(url, timeout=15)
        resp.raise_for_status()

        # Extract race name from page title
        import re
        title_match = re.search(r'<title>(.*?)</title>', resp.text)
        race_name = title_match.group(1).strip() if title_match else None
        if race_name:
            print(f"✓ Race: {race_name}")
        return race_name

    def search_photos(self, album_id: str, bib: str) -> dict:
        """Search photos by bib number."""
        print(f"Searching photos for bib {bib}...")
        url = f"{self.BASE_URL}/Wap/Services/FindMe.ashx?t=4&rid=req{int(time.time()*1000)}"
        headers = {
            'Referer': self.BASE_URL,
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'application/json, text/javascript, */*; q=0.01',
        }
        data = f"albumId={album_id}&num={bib}&nw=&pay=0"
        resp = self.session.post(url, data=data, headers=headers, timeout=15)
        resp.raise_for_status()
        result = resp.json()

        if result.get('Code') != 1:
            print(f"✗ Search failed: {result.get('Message', 'Unknown error')}")
            return result

        photos = result.get('Data', [])
        print(f"✓ Found {len(photos)} photos")
        return result

    def get_original_url(self, download_params: str) -> str:
        """Get the original photo download URL via AlbumDetail."""
        url = f"{self.BASE_URL}/Wap/Services/AlbumDetail.ashx?t=0&rid=req{int(time.time()*1000)}&{download_params}"
        resp = self.session.get(url, timeout=15)
        resp.raise_for_status()
        result = resp.json()
        if result.get('Code') == 1:
            return result['Data']
        return None

    def download_photos(self, album_page_id: str, album_id: str, bib: str,
                        race_name: str = None, place: str = None):
        """Search and download all photos for a bib number."""
        # Initialize session
        page_title = self.init_session(album_page_id)

        # Search photos
        result = self.search_photos(album_id, bib)
        photos = result.get('Data', [])
        if not photos:
            print("No photos found.")
            return

        # Determine race name
        if not race_name:
            race_name = page_title or 'unknown_race'
        race_name = race_name.replace('/', '_').replace('\\', '_').replace(':', '_')

        output_dir = self.base_dir / race_name / "pailixiang"
        output_dir.mkdir(parents=True, exist_ok=True)

        # Save metadata
        race_info = {
            'name': race_name,
            'source': 'pailixiang',
            'album_page': f'{self.BASE_URL}/m/album_{album_page_id}.html',
        }
        # Extract date from first photo's ShootTime
        shoot_time = photos[0].get('ShootTime', '')
        if shoot_time:
            race_info['date'] = shoot_time.split(' ')[0]
        if place:
            race_info['place'] = place

        with open(output_dir / 'race_info.json', 'w', encoding='utf-8') as f:
            json.dump(race_info, f, ensure_ascii=False, indent=2)

        with open(output_dir / 'photos_list.json', 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)

        print(f"Downloading {len(photos)} photos to {output_dir}")

        downloaded = 0
        skipped = 0
        failed = 0

        for i, p in enumerate(photos):
            fname = p.get('Name', p.get('FileName', f'photo_{i}.jpg'))

            output_path = output_dir / fname
            if output_path.exists():
                print(f"  [{i+1}/{len(photos)}] ⊙ Skipped (exists): {fname}")
                skipped += 1
                continue

            # Get original photo URL
            dl_params = p.get('DownloadImageUrl', '')
            if not dl_params:
                print(f"  [{i+1}/{len(photos)}] ✗ No download URL: {fname}")
                failed += 1
                continue

            original_url = self.get_original_url(dl_params)
            if not original_url:
                print(f"  [{i+1}/{len(photos)}] ✗ Failed to get original URL: {fname}")
                failed += 1
                continue

            try:
                resp = self.session.get(original_url, timeout=30)
                if resp.status_code == 200:
                    with open(output_path, 'wb') as f:
                        f.write(resp.content)

                    # Set file timestamp from ShootTime
                    shoot_time = p.get('ShootTime', '')
                    if shoot_time:
                        try:
                            dt = datetime.strptime(shoot_time, '%Y-%m-%d %H:%M:%S')
                            ts = dt.timestamp()
                            os.utime(output_path, (ts, ts))
                        except ValueError:
                            pass

                    print(f"  [{i+1}/{len(photos)}] ✓ Downloaded: {fname} ({len(resp.content)} bytes)")
                    downloaded += 1
                else:
                    print(f"  [{i+1}/{len(photos)}] ✗ Failed: {fname} (HTTP {resp.status_code})")
                    failed += 1
            except Exception as e:
                print(f"  [{i+1}/{len(photos)}] ✗ Error: {fname} ({e})")
                failed += 1

            time.sleep(0.5)

        print(f"\nDone! Downloaded: {downloaded}, Skipped: {skipped}, Failed: {failed}")


def main():
    parser = argparse.ArgumentParser(description='Download photos from Pailixiang')
    parser.add_argument('--album-page-id', required=True,
                        help='Album page ID from URL (e.g., "ia3939628040" from album_ia3939628040.html)')
    parser.add_argument('--album-id', required=True,
                        help='Album UUID from the search request body (e.g., "a94acb7b-8339-429a-ace2-26b8edfcba29")')
    parser.add_argument('--bib', required=True,
                        help='Bib number to search for (e.g., M01080)')
    parser.add_argument('--race-name', default=None,
                        help='Override race name (default: extracted from page title)')
    parser.add_argument('--place', default=None,
                        help='Race location (e.g., "江苏苏州") for gallery display')
    parser.add_argument('--base-dir', default='docs/images',
                        help='Base directory for photos')
    args = parser.parse_args()

    downloader = PailixiangDownloader(base_dir=args.base_dir)
    downloader.download_photos(
        album_page_id=args.album_page_id,
        album_id=args.album_id,
        bib=args.bib,
        race_name=args.race_name,
        place=args.place,
    )


if __name__ == '__main__':
    main()
