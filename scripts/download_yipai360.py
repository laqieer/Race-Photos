#!/usr/bin/env python3
"""
Download photos from Yipai360 API.

This script handles downloading race photos from Yipai360's API,
using OCR-based bib number search to find personal photos.

API endpoints:
  - Race info: POST /applet/v2/order/detail
  - Bib search: GET /applet/v2/ocr/getPhotosByContent
  - Image: https://c360-o2o.yipai360.com/{etag}
  - EXIF: https://c360-o2o.yipai360.com/{etag}?exif
"""

import json
import os
import sys
import argparse
import time
import requests
from datetime import datetime
from pathlib import Path
from typing import Optional


class Yipai360Downloader:
    """Handle downloading photos from Yipai360 API."""

    BASE_URL = "https://www.yipai360.com"
    CDN_URL = "https://c360-o2o.yipai360.com"

    def __init__(self, base_dir: str = "docs/images"):
        self.base_dir = Path(base_dir)
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Race-Photos-Downloader/1.0',
            'Accept': 'application/json',
        })

    @staticmethod
    def sanitize_directory_name(name: str) -> str:
        """Sanitize a string for use as a directory name."""
        import re
        name = re.sub(r'[<>:"/\\|?*]', '_', name)
        return name.strip().strip('.')

    def get_race_info(self, order_id: str) -> dict:
        """Fetch race info from Yipai360 API."""
        resp = self.session.post(
            f"{self.BASE_URL}/applet/v2/order/detail",
            data={'orderId': order_id}
        )
        resp.raise_for_status()
        return resp.json()

    def search_photos_by_bib(self, order_id: str, bib: str, page_size: int = 100) -> list:
        """Search photos by bib number using OCR endpoint."""
        all_photos = []
        page = 1
        while True:
            resp = self.session.get(
                f"{self.BASE_URL}/applet/v2/ocr/getPhotosByContent",
                params={
                    'orderId': order_id,
                    'content': bib,
                    'page': page,
                    'pageSize': page_size,
                }
            )
            resp.raise_for_status()
            data = resp.json().get('data', {})
            result = data.get('result', [])
            all_photos.extend(result)

            total_page = int(data.get('totalPage', 1))
            print(f"  Page {page}/{total_page}: {len(result)} photos")
            if page >= total_page:
                break
            page += 1
            time.sleep(0.5)

        return all_photos

    def get_photo_exif(self, etag: str) -> dict:
        """Fetch EXIF data for a photo."""
        try:
            resp = self.session.get(f"{self.CDN_URL}/{etag}?exif", timeout=10)
            if resp.ok:
                return resp.json()
        except Exception:
            pass
        return {}

    @staticmethod
    def parse_exif_datetime(exif: dict) -> Optional[float]:
        """Parse DateTimeOriginal from EXIF data into a unix timestamp."""
        dt_str = exif.get('DateTimeOriginal', {}).get('val', '')
        if not dt_str:
            return None
        try:
            dt = datetime.strptime(dt_str, "%Y:%m:%d %H:%M:%S")
            return dt.timestamp()
        except ValueError:
            return None

    @staticmethod
    def set_file_timestamp(filepath: Path, timestamp: float) -> None:
        """Set file creation, access, and modification time."""
        try:
            os.utime(filepath, (timestamp, timestamp))
            if sys.platform == 'win32':
                import pywintypes
                import win32file
                import win32con
                wintime = pywintypes.Time(timestamp)
                handle = win32file.CreateFile(
                    str(filepath),
                    win32con.GENERIC_WRITE,
                    win32con.FILE_SHARE_READ | win32con.FILE_SHARE_WRITE,
                    None, win32con.OPEN_EXISTING,
                    win32con.FILE_ATTRIBUTE_NORMAL, None
                )
                win32file.SetFileTime(handle, wintime, wintime, wintime)
                handle.close()
        except (OSError, ImportError):
            pass

    def download_photos(self, order_id: str, bib: str):
        """Download all photos for a bib number from a race."""
        # 1. Get race info
        print(f"Fetching race info for order {order_id}...")
        race_data = self.get_race_info(order_id)
        race_info = race_data.get('data', {})
        race_name = self.sanitize_directory_name(race_info.get('title', order_id))
        place = race_info.get('place', '')
        print(f"✓ Found race: {race_name}")
        if place:
            print(f"  Location: {place}")

        # 2. Search photos by bib
        print(f"Searching photos for bib {bib}...")
        photos = self.search_photos_by_bib(order_id, bib)
        print(f"✓ Found {len(photos)} photos")

        if not photos:
            print("No photos found.")
            return

        # 3. Prepare output directory
        output_dir = self.base_dir / race_name / "yipai360"
        output_dir.mkdir(parents=True, exist_ok=True)

        # 4. Save metadata
        race_info_file = output_dir / "race_info.json"
        with open(race_info_file, 'w', encoding='utf-8') as f:
            json.dump(race_data, f, indent=2, ensure_ascii=False)
        print("✓ Cached to race_info.json")

        photos_list_file = output_dir / "photos_list.json"
        # Merge with existing if present
        existing_photos = {}
        if photos_list_file.exists():
            try:
                with open(photos_list_file, 'r', encoding='utf-8') as f:
                    existing = json.load(f)
                for p in existing.get('photos', []):
                    existing_photos[p.get('id') or p.get('etag')] = p
            except (json.JSONDecodeError, IOError):
                pass

        for p in photos:
            key = p.get('id') or p.get('etag')
            existing_photos[key] = p

        merged = sorted(existing_photos.values(), key=lambda x: x.get('id', 0))
        photos_data = {'photos': merged, 'bib': bib, 'orderId': order_id}
        with open(photos_list_file, 'w', encoding='utf-8') as f:
            json.dump(photos_data, f, indent=2, ensure_ascii=False)
        print(f"✓ Cached to photos_list.json ({len(merged)} total)")

        # 5. Download photos
        print(f"\nDownloading {len(photos)} photos to {output_dir}/")
        downloaded = 0
        for photo in photos:
            etag = photo.get('etag', '')
            fname = photo.get('fname', f"{etag}.jpg")
            output_path = output_dir / fname

            if output_path.exists():
                print(f"⊙ Skipped (exists): {fname}")
                downloaded += 1
                continue

            url = f"{self.CDN_URL}/{etag}"
            try:
                resp = self.session.get(url, timeout=30)
                resp.raise_for_status()
                with open(output_path, 'wb') as f:
                    f.write(resp.content)

                # Set file timestamp from EXIF
                exif = self.get_photo_exif(etag)
                ts = self.parse_exif_datetime(exif)
                if ts:
                    self.set_file_timestamp(output_path, ts)

                downloaded += 1
                print(f"✓ Downloaded: {fname}")
                time.sleep(0.2)
            except Exception as e:
                print(f"✗ Failed: {fname} ({e})")

        print(f"\nCompleted: {downloaded}/{len(photos)} photos downloaded")


def main():
    parser = argparse.ArgumentParser(description='Download photos from Yipai360')
    parser.add_argument('--order-id', required=True, help='Order ID from Yipai360 URL')
    parser.add_argument('--bib', required=True, help='Bib number to search for')
    parser.add_argument('--base-dir', default='docs/images', help='Base directory for photos')

    args = parser.parse_args()

    downloader = Yipai360Downloader(args.base_dir)
    downloader.download_photos(args.order_id, args.bib)


if __name__ == "__main__":
    main()
