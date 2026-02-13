#!/usr/bin/env python3
"""
Generate manifest.json file for the photo gallery.

This script scans the docs/images directory and creates a manifest
of all races and their photo sources.
"""

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List


# GPS-based location lookup: (lat_min, lat_max, lon_min, lon_max) -> (city, province, country)
GPS_LOCATIONS = [
    (31.0, 32.0, 120.0, 121.0, "苏州", "江苏", "中国"),
    (24.5, 25.5, 102.0, 103.5, "昆明", "云南", "中国"),
    (20.5, 21.5, 110.0, 111.0, "湛江", "广东", "中国"),
]


def _lookup_location_by_gps(lat: float, lon: float) -> Dict:
    """Look up city/province/country from GPS coordinates."""
    for lat_min, lat_max, lon_min, lon_max, city, province, country in GPS_LOCATIONS:
        if lat_min <= lat <= lat_max and lon_min <= lon <= lon_max:
            return {"city": city, "province": province, "country": country}
    return {}


def generate_manifest(base_dir: str = "docs/images") -> Dict:
    """
    Scan the images directory and generate a manifest.
    
    Returns a dict with the following structure:
    {
        "races": [
            {
                "name": "race-name",
                "date": "2024-01-21",
                "sources": [
                    {
                        "name": "source-name",
                        "photos": [
                            {"url": "images/race/source/photo.jpg", "name": "photo.jpg"}
                        ]
                    }
                ]
            }
        ]
    }
    """
    base_path = Path(base_dir)
    manifest = {"races": []}
    
    if not base_path.exists():
        print(f"Directory {base_dir} does not exist")
        return manifest
    
    # Scan for race directories
    for race_dir in sorted(base_path.iterdir()):
        if not race_dir.is_dir() or race_dir.name.startswith('.') or race_dir.name.startswith('_'):
            continue
        
        race_name = race_dir.name
        race_data = {
            "name": race_name,
            "date": "",
            "city": "",
            "province": "",
            "country": "",
            "sources": []
        }
        
        # Try to read race date from race_info.json
        for source_dir in race_dir.iterdir():
            race_info_file = source_dir / "race_info.json"
            if race_info_file.exists():
                try:
                    with open(race_info_file, 'r', encoding='utf-8') as f:
                        race_info = json.load(f)
                    start_time = race_info.get('activity', {}).get('start_time')
                    if start_time:
                        dt = datetime.fromtimestamp(start_time / 1000, tz=timezone.utc)
                        race_data["date"] = dt.strftime("%Y-%m-%d")
                        break
                except (IOError, json.JSONDecodeError, ValueError, TypeError):
                    pass
        
        # Scan for source directories within each race
        for source_dir in sorted(race_dir.iterdir()):
            if not source_dir.is_dir() or source_dir.name.startswith('.'):
                continue
            
            source_name = source_dir.name
            photos = []
            
            # Load metadata from photos_list.json if available
            photo_meta = {}
            photos_list_file = source_dir / "photos_list.json"
            if photos_list_file.exists():
                try:
                    with open(photos_list_file, 'r', encoding='utf-8') as f:
                        photos_data = json.load(f)
                    photo_list = []
                    if 'result' in photos_data and 'topicInfoList' in photos_data['result']:
                        photo_list = photos_data['result']['topicInfoList']
                    elif 'topicInfoList' in photos_data:
                        photo_list = photos_data['topicInfoList']
                    for p in photo_list:
                        url_hq = p.get('url_hq', '')
                        if url_hq:
                            fname = url_hq.rsplit('/', 1)[-1]
                            meta = {}
                            lat = p.get('gps_latitude')
                            lon = p.get('gps_longitude')
                            if lat and lon:
                                meta["lat"] = lat
                                meta["lon"] = lon
                            mi = p.get('meta_info', '{}')
                            try:
                                mi_data = json.loads(mi) if isinstance(mi, str) else mi
                                dt = mi_data.get('DateTimeOriginal', '')
                                if dt:
                                    meta["timestamp"] = dt.replace(':', '-', 2)
                            except (json.JSONDecodeError, ValueError):
                                pass
                            if meta:
                                photo_meta[fname] = meta
                except (IOError, json.JSONDecodeError):
                    pass
            
            # Scan for photos within each source
            for photo_file in sorted(source_dir.iterdir()):
                if photo_file.is_file() and not photo_file.name.startswith('.'):
                    # Check if it's an image file
                    ext = photo_file.suffix.lower()
                    if ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
                        # Use relative path from docs directory
                        relative_path = photo_file.relative_to(Path('docs'))
                        entry = {
                            "url": relative_path.as_posix(),
                            "name": photo_file.name
                        }
                        meta = photo_meta.get(photo_file.name, {})
                        if "lat" in meta:
                            entry["lat"] = meta["lat"]
                        if "lon" in meta:
                            entry["lon"] = meta["lon"]
                        if "timestamp" in meta:
                            entry["timestamp"] = meta["timestamp"]
                        photos.append(entry)
            
            if photos:
                race_data["sources"].append({
                    "name": source_name,
                    "photos": photos
                })
        
        if race_data["sources"]:
            # Determine location from first photo's GPS
            for source in race_data["sources"]:
                for photo in source["photos"]:
                    if photo.get("lat") and photo.get("lon"):
                        location = _lookup_location_by_gps(photo["lat"], photo["lon"])
                        race_data["city"] = location.get("city", "")
                        race_data["province"] = location.get("province", "")
                        race_data["country"] = location.get("country", "")
                        break
                if race_data["city"]:
                    break
            # Check for GPX route file
            route_file = Path("docs/routes") / (race_name + ".gpx")
            if route_file.exists():
                race_data["route"] = "routes/" + race_name + ".gpx"
            manifest["races"].append(race_data)
    
    # Sort races by date, latest first
    manifest["races"].sort(key=lambda r: r.get("date", ""), reverse=True)
    
    return manifest


def main():
    """Generate and save the manifest file."""
    print("Generating manifest...")
    manifest = generate_manifest()
    
    # Write manifest to file
    output_path = Path("docs/images/manifest.json")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w') as f:
        json.dump(manifest, f, indent=2)
    
    race_count = len(manifest["races"])
    photo_count = sum(
        len(source["photos"])
        for race in manifest["races"] 
        for source in race["sources"]
    )
    
    print(f"✓ Manifest generated: {race_count} race(s), {photo_count} photo(s)")
    print(f"✓ Saved to: {output_path}")


if __name__ == "__main__":
    main()
