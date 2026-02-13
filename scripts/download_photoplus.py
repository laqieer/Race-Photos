#!/usr/bin/env python3
"""
Download photos from PhotoPlus API (live.photoplus.cn).

This script handles downloading race photos from PhotoPlus's API,
using signed URLs from the browser's network requests.

API endpoints:
  - Bib search: GET /home/pic/self/recognize?list={actNos}&number={bib}&_s={sig}&_t={ts}
  - Image: https://pb.plusx.cn/plus/immediate/{actNo}/{date}/{fname}.heic~tplv-...

Note: The _s (signature) and _t (timestamp) parameters expire quickly.
      You must provide a fresh URL from the browser each time.
"""

import json
import os
import sys
import argparse
import time
import requests
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.parse import urlparse, parse_qs


class PhotoPlusDownloader:
    """Handle downloading photos from PhotoPlus API."""

    def __init__(self, base_dir: str = "docs/images"):
        self.base_dir = Path(base_dir)
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://live.photoplus.cn/',
        })

    def fetch_photos(self, api_url: str) -> dict:
        """Fetch photos from the signed API URL."""
        print(f"Fetching photos from API...")
        resp = self.session.get(api_url, timeout=15)
        resp.raise_for_status()
        data = resp.json()

        if not data.get('success'):
            print(f"✗ API error: {data.get('message', 'Unknown error')}")
            print("  The signature may have expired. Please provide a fresh URL.")
            sys.exit(1)

        result = data.get('result', {})
        total = result.get('pics_total', 0)
        pics = result.get('pics_array', [])
        print(f"✓ Found {total} photos")
        return data

    def download_photos(self, api_url: str):
        """Download all photos from the API response."""
        data = self.fetch_photos(api_url)
        pics = data['result']['pics_array']

        if not pics:
            print("No photos found.")
            return

        # Determine race name from first photo
        race_name = pics[0].get('activity_name', 'unknown_race')
        # Sanitize race name for filesystem
        race_name = race_name.replace('/', '_').replace('\\', '_').replace(':', '_')
        output_dir = self.base_dir / race_name / "photoplus"
        output_dir.mkdir(parents=True, exist_ok=True)

        # Save metadata
        race_info = {
            'activity_name': race_name,
            'activity_no': pics[0].get('activity_no'),
            'source': 'photoplus'
        }
        with open(output_dir / 'race_info.json', 'w', encoding='utf-8') as f:
            json.dump(race_info, f, ensure_ascii=False, indent=2)

        with open(output_dir / 'photos_list.json', 'w', encoding='utf-8') as f:
            json.dump({'pics_array': pics}, f, ensure_ascii=False, indent=2)

        print(f"Downloading {len(pics)} photos to {output_dir}")

        downloaded = 0
        skipped = 0
        failed = 0

        for i, p in enumerate(pics):
            # Determine filename
            pic_name = p.get('pic_name', '')
            if not pic_name:
                base = p.get('origin_img', '').split('~')[0]
                pic_name = base.rsplit('/', 1)[-1].replace('.heic', '.JPG')
            pic_name = pic_name.replace(' ', '_')

            output_path = output_dir / pic_name

            if output_path.exists():
                print(f"  [{i+1}/{len(pics)}] ⊙ Skipped (exists): {pic_name}")
                skipped += 1
                continue

            # Download from origin_img URL (includes format conversion)
            url = 'https:' + p['origin_img']
            try:
                resp = self.session.get(url, timeout=30)
                if resp.status_code == 200:
                    with open(output_path, 'wb') as f:
                        f.write(resp.content)

                    # Set file timestamp from exif_timestamp
                    ts = p.get('exif_timestamp')
                    if ts:
                        os.utime(output_path, (int(ts), int(ts)))

                    print(f"  [{i+1}/{len(pics)}] ✓ Downloaded: {pic_name} ({len(resp.content)} bytes)")
                    downloaded += 1
                else:
                    print(f"  [{i+1}/{len(pics)}] ✗ Failed: {pic_name} (HTTP {resp.status_code})")
                    failed += 1
            except Exception as e:
                print(f"  [{i+1}/{len(pics)}] ✗ Error: {pic_name} ({e})")
                failed += 1

            time.sleep(0.5)

        print(f"\nDone! Downloaded: {downloaded}, Skipped: {skipped}, Failed: {failed}")


def main():
    parser = argparse.ArgumentParser(description='Download photos from PhotoPlus')
    parser.add_argument('--url', required=True,
                        help='Full signed API URL from browser. Supports both bib search '
                             '(/home/pic/self/recognize) and face search '
                             '(/home/findme/activitys/pic) URLs')
    parser.add_argument('--base-dir', default='docs/images',
                        help='Base directory for photos')
    args = parser.parse_args()

    downloader = PhotoPlusDownloader(base_dir=args.base_dir)
    downloader.download_photos(args.url)


if __name__ == '__main__':
    main()
