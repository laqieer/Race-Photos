#!/usr/bin/env python3
"""
Download photos from RunFF API (www.runff.com / chinarun.com).

This script handles downloading race photos from RunFF's XML-based API,
which returns photo data as JSON embedded in XML responses.

API endpoints:
  - Photo search: POST https://www.runff.com/html/live/s{race_id}.html?isbxapimode=true&_xmltime={ts}
    Body: XML with Action=getPhotoList, fid, number (bib), pageindex, pagesize
  - Image CDN: https://p.chinarun.com{path}

Usage:
  python scripts/download_runff.py --race-id 4039 --fid 24584147 --bib B30483 --race-name "苏州环阳山半程马拉松"
"""

import json
import os
import sys
import re
import argparse
import time
import requests
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from pathlib import Path


class RunFFDownloader:
    """Handle downloading photos from RunFF API."""

    BASE_URL = "https://www.runff.com"
    CDN_BASE = "https://p.chinarun.com"

    def __init__(self, base_dir: str = "docs/images"):
        self.base_dir = Path(base_dir)
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "X-Requested-With": "XMLHttpRequest",
            "Content-Type": "text/plain",
        })

    def _build_xml(self, action: str, data_fields: dict) -> str:
        """Build BxMessage XML request body."""
        data_xml = "".join(f"<{k}>{v}</{k}>" for k, v in data_fields.items())
        return (
            '<?xml version="1.0" encoding="utf-8"?>'
            f"<BxMessage><AppId>BxAPI</AppId><Type>1</Type>"
            f"<Action>{action}</Action><Data>{data_xml}</Data></BxMessage>"
        )

    def _parse_response(self, resp) -> dict:
        """Parse XML response and extract JSON data."""
        # Strip BOM and decode
        content = resp.content.lstrip(b"\xef\xbb\xbf")
        text = content.decode("utf-8")
        root = ET.fromstring(text)
        state_code = root.findtext("StateCode")
        if state_code != "0":
            msg = root.findtext("Message", "unknown error")
            raise RuntimeError(f"API error: {msg}")
        return root.find("Data")

    def search_photos(self, race_id: str, fid: str, bib: str,
                      page: int = 1, page_size: int = 200) -> tuple:
        """Search photos by bib number. Returns (photos_list, has_more, total)."""
        ts = f"{time.time():.1f}"
        url = f"{self.BASE_URL}/html/live/s{race_id}.html?isbxapimode=true&_xmltime={ts}"
        self.session.headers["Referer"] = f"{self.BASE_URL}/html/live/s{race_id}.html"

        body = self._build_xml("getPhotoList", {
            "fid": fid,
            "number": bib,
            "faceUrl": "",
            "pageindex": str(page),
            "time": "",
            "sign": "false",
            "pagesize": str(page_size),
            "display": "normal",
        })

        resp = self.session.post(url, data=body, timeout=30)
        resp.raise_for_status()

        data = self._parse_response(resp)
        list_text = data.findtext("list", "[]")
        more = data.findtext("more", "false").lower() == "true"
        total = int(data.findtext("total", "0"))

        # Parse JSON (may contain JS Date objects, strip them)
        photos = json.loads(list_text)
        return photos, more, total

    def download_photos(self, race_id: str, fid: str, bib: str,
                        race_name: str, cookie_str: str = ""):
        """Download all photos for a bib number."""
        if cookie_str:
            for part in cookie_str.split(";"):
                part = part.strip()
                if "=" in part:
                    k, v = part.split("=", 1)
                    self.session.cookies.set(k.strip(), v.strip())

        out_dir = self.base_dir / race_name / "runff"
        out_dir.mkdir(parents=True, exist_ok=True)

        # Fetch all pages
        all_photos = []
        page = 1
        while True:
            print(f"📡 Fetching page {page}...")
            photos, more, total = self.search_photos(race_id, fid, bib, page)
            all_photos.extend(photos)
            print(f"  Got {len(photos)} photos (total: {total})")
            if not more:
                break
            page += 1
            time.sleep(0.5)

        if not all_photos:
            print("❌ No photos found")
            return

        print(f"\n📸 Found {len(all_photos)} photos total")

        # Save metadata
        race_info = {
            "source": "runff",
            "race_id": race_id,
            "fid": fid,
            "bib": bib,
            "race_page": f"{self.BASE_URL}/html/live/s{race_id}.html",
        }
        with open(out_dir / "race_info.json", "w", encoding="utf-8") as f:
            json.dump(race_info, f, ensure_ascii=False, indent=2)

        with open(out_dir / "photos_list.json", "w", encoding="utf-8") as f:
            json.dump(all_photos, f, ensure_ascii=False, indent=2)

        # Download photos
        downloaded = 0
        skipped = 0
        for photo in all_photos:
            big_path = photo.get("big", "")
            if not big_path:
                continue

            fname = big_path.split("/")[-1]
            out_path = out_dir / fname

            if out_path.exists():
                print(f"  ⊙ Skipped (exists): {fname}")
                skipped += 1
                continue

            img_url = f"{self.CDN_BASE}{big_path}"
            try:
                img_resp = self.session.get(img_url, timeout=30)
                if img_resp.status_code == 200:
                    with open(out_path, "wb") as f:
                        f.write(img_resp.content)

                    # Set file mtime from timestamp
                    ts = photo.get("ts")
                    if ts:
                        ts_int = int(ts)
                        os.utime(out_path, (ts_int, ts_int))

                    print(f"  ✓ Downloaded: {fname} ({len(img_resp.content)} bytes)")
                    downloaded += 1
                else:
                    print(f"  ✗ Failed ({img_resp.status_code}): {fname}")
            except Exception as e:
                print(f"  ✗ Error: {fname}: {e}")

            time.sleep(0.3)

        print(f"\n✅ Done! Downloaded: {downloaded}, Skipped: {skipped}")


def main():
    parser = argparse.ArgumentParser(description="Download photos from RunFF")
    parser.add_argument("--race-id", required=True, help="Race ID (e.g., 4039)")
    parser.add_argument("--fid", required=True, help="Photo folder ID (e.g., 24584147)")
    parser.add_argument("--bib", required=True, help="Bib number (e.g., B30483)")
    parser.add_argument("--race-name", required=True, help="Race name for output directory")
    parser.add_argument("--cookie", default="", help="Cookie string (optional)")
    parser.add_argument("--base-dir", default="docs/images", help="Base output directory")
    args = parser.parse_args()

    downloader = RunFFDownloader(base_dir=args.base_dir)
    downloader.download_photos(
        race_id=args.race_id,
        fid=args.fid,
        bib=args.bib,
        race_name=args.race_name,
        cookie_str=args.cookie,
    )


if __name__ == "__main__":
    main()
