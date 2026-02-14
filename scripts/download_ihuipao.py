#!/usr/bin/env python3
"""
Download photos from iHuiPao API (api.ihuipao.com).

This script handles downloading race photos from iHuiPao's API,
supporting face search, bib search, and purchased photo retrieval.

API endpoints:
  - Race list: POST /api/helper/races (year + _token)
  - Race detail: POST /helper/detail (id + _token)
  - Face search: POST /photo/search/face (albumid + face URL + _token)
  - Bib search: POST /photo/search/idnum (albumid + idnum + _token)
  - My purchases: POST /photo/apply/my (page + _token)
  - Photo detail: POST /photo/detail (id + _token)
  - Photo download: POST /photo/download (photoid + _token)
  - Image CDN: https://weruns3.obs.cn-east-3.myhuaweicloud.com/...

Usage:
  python scripts/download_ihuipao.py --token TOKEN --race-name "2023COLMO环蠡湖半程马拉松" --mode purchases
  python scripts/download_ihuipao.py --token TOKEN --album-id Xn6MVGlkDod2jwvZWQB3 --face-url URL --race-name "..." --mode face
"""

import json
import os
import sys
import argparse
import time
import requests
from datetime import datetime
from pathlib import Path


class IHuiPaoDownloader:
    """Handle downloading photos from iHuiPao API."""

    API_BASE = "https://api.ihuipao.com"

    def __init__(self, token: str, base_dir: str = "docs/images"):
        self.base_dir = Path(base_dir)
        self.token = token
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Referer": "https://servicewechat.com/wxbb540bd1c82899fa/1239/page-frame.html",
        })

    def _post(self, path: str, data: dict) -> dict:
        """Make an API POST request."""
        data["app"] = "helper"
        data["_token"] = self.token
        resp = self.session.post(f"{self.API_BASE}{path}", json=data, timeout=30)
        resp.raise_for_status()
        result = resp.json()
        if result.get("code") not in ("200", 200):
            msg = result.get("msg") or result.get("err") or "unknown error"
            raise RuntimeError(f"API error: {msg}")
        return result.get("data", {})

    def get_race_detail(self, race_id: str) -> dict:
        """Get race details."""
        return self._post("/helper/detail", {"id": race_id})

    def search_by_face(self, album_id: str, face_url: str, page: int = 1) -> list:
        """Search photos by face image URL."""
        data = self._post("/photo/search/face", {
            "albumid": album_id,
            "page": page,
            "face": face_url,
            "type": "url",
        })
        return data if isinstance(data, list) else []

    def search_by_idnum(self, album_id: str, idnum: str) -> list:
        """Search photos by ID card number."""
        data = self._post("/photo/search/idnum", {
            "albumid": album_id,
            "idnum": idnum,
        })
        return data if isinstance(data, list) else []

    def get_my_purchases(self) -> list:
        """Get all purchased photos."""
        all_items = []
        page = 1
        while True:
            data = self._post("/photo/apply/my", {"page": page})
            items = data.get("data", [])
            all_items.extend(items)
            if page >= data.get("last_page", 1):
                break
            page += 1
        return all_items

    def get_photo_detail(self, photo_id) -> dict:
        """Get photo detail including origin URL."""
        return self._post("/photo/detail", {"id": str(photo_id)})

    def get_download_url(self, photo_id) -> str:
        """Get the download URL for a photo."""
        data = self._post("/photo/download", {"photoid": str(photo_id)})
        url = data.get("url", "")
        if url.startswith("//"):
            url = "https:" + url
        return url

    def download_photos(self, photo_ids: list, race_name: str, race_info: dict = None):
        """Download photos by their IDs."""
        out_dir = self.base_dir / race_name / "ihuipao"
        out_dir.mkdir(parents=True, exist_ok=True)

        # Save race info
        if race_info:
            with open(out_dir / "race_info.json", "w", encoding="utf-8") as f:
                json.dump(race_info, f, ensure_ascii=False, indent=2)

        all_details = []
        downloaded = 0
        skipped = 0

        for photo_id in photo_ids:
            print(f"\n📡 Fetching detail for photo {photo_id}...")
            try:
                detail = self.get_photo_detail(photo_id)
                all_details.append(detail)
            except Exception as e:
                print(f"  ✗ Failed to get detail: {e}")
                continue

            # Get origin URL
            origin_url = detail.get("origin", "")
            if not origin_url:
                # Fall back to download endpoint
                try:
                    origin_url = self.get_download_url(photo_id)
                except Exception as e:
                    print(f"  ✗ Failed to get download URL: {e}")
                    continue

            if origin_url.startswith("//"):
                origin_url = "https:" + origin_url

            # Derive filename from origin URL or photo metadata
            fname = origin_url.rsplit("/", 1)[-1].split("?")[0]
            shoot_at = detail.get("shoot_at", "")
            if shoot_at:
                # Use shoot time as prefix for better sorting
                ts_prefix = shoot_at.replace("-", "").replace(" ", "_").replace(":", "")
                fname = f"{ts_prefix}_{fname}"

            out_path = out_dir / fname

            if out_path.exists():
                print(f"  ⊙ Skipped (exists): {fname}")
                skipped += 1
                continue

            try:
                img_resp = self.session.get(origin_url, timeout=60)
                if img_resp.status_code == 200:
                    with open(out_path, "wb") as f:
                        f.write(img_resp.content)

                    # Set mtime from shoot_at
                    if shoot_at:
                        try:
                            dt = datetime.strptime(shoot_at, "%Y-%m-%d %H:%M:%S")
                            ts = dt.timestamp()
                            os.utime(out_path, (ts, ts))
                        except ValueError:
                            pass

                    print(f"  ✓ Downloaded: {fname} ({len(img_resp.content)} bytes)")
                    downloaded += 1
                else:
                    print(f"  ✗ Failed ({img_resp.status_code}): {fname}")
            except Exception as e:
                print(f"  ✗ Error: {fname}: {e}")

            time.sleep(0.3)

        # Save photos list
        with open(out_dir / "photos_list.json", "w", encoding="utf-8") as f:
            json.dump(all_details, f, ensure_ascii=False, indent=2)

        print(f"\n✅ Done! Downloaded: {downloaded}, Skipped: {skipped}")


def main():
    parser = argparse.ArgumentParser(description="Download photos from iHuiPao")
    parser.add_argument("--token", required=True, help="API token (_token)")
    parser.add_argument("--race-name", required=True, help="Race name for output directory")
    parser.add_argument("--race-id", help="Race helper ID (e.g., BKn6NygxDqkP0qPZebWM)")
    parser.add_argument("--album-id", help="Album ID for face/bib search")
    parser.add_argument("--face-url", help="Face image URL for face search")
    parser.add_argument("--idnum", help="ID card number for bib search")
    parser.add_argument("--photo-ids", help="Comma-separated photo IDs to download directly")
    parser.add_argument("--mode", choices=["face", "idnum", "purchases", "direct"],
                        default="purchases", help="Search mode")
    parser.add_argument("--base-dir", default="docs/images", help="Base output directory")
    args = parser.parse_args()

    downloader = IHuiPaoDownloader(token=args.token, base_dir=args.base_dir)

    # Get race info if race_id provided
    race_info = None
    if args.race_id:
        print("📡 Fetching race info...")
        race_info = downloader.get_race_detail(args.race_id)
        race_info["source"] = "ihuipao"
        print(f"  ✓ Race: {race_info.get('name')}")

    # Find photo IDs based on mode
    photo_ids = []
    if args.mode == "direct" and args.photo_ids:
        photo_ids = [pid.strip() for pid in args.photo_ids.split(",")]
    elif args.mode == "purchases":
        print("📡 Fetching purchased photos...")
        purchases = downloader.get_my_purchases()
        photo_ids = [str(p["photoid"]) for p in purchases]
        print(f"  ✓ Found {len(photo_ids)} purchased photo(s)")
    elif args.mode == "face":
        if not args.album_id or not args.face_url:
            parser.error("--album-id and --face-url required for face search")
        print("📡 Searching by face...")
        results = downloader.search_by_face(args.album_id, args.face_url)
        photo_ids = [str(r.get("id", r.get("photoid"))) for r in results]
        print(f"  ✓ Found {len(photo_ids)} photo(s)")
    elif args.mode == "idnum":
        if not args.album_id or not args.idnum:
            parser.error("--album-id and --idnum required for ID search")
        print("📡 Searching by ID number...")
        results = downloader.search_by_idnum(args.album_id, args.idnum)
        photo_ids = [str(r.get("id", r.get("photoid"))) for r in results]
        print(f"  ✓ Found {len(photo_ids)} photo(s)")

    if not photo_ids:
        print("❌ No photos found")
        return

    print(f"\n📸 Downloading {len(photo_ids)} photo(s)...")
    downloader.download_photos(photo_ids, args.race_name, race_info)


if __name__ == "__main__":
    main()
