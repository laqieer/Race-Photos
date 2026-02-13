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
            
            # Load GPS data from photos_list.json if available
            gps_lookup = {}
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
                            lat = p.get('gps_latitude')
                            lon = p.get('gps_longitude')
                            if lat and lon:
                                gps_lookup[fname] = {"lat": lat, "lon": lon}
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
                        gps = gps_lookup.get(photo_file.name)
                        if gps:
                            entry["lat"] = gps["lat"]
                            entry["lon"] = gps["lon"]
                        photos.append(entry)
            
            if photos:
                race_data["sources"].append({
                    "name": source_name,
                    "photos": photos
                })
        
        if race_data["sources"]:
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
