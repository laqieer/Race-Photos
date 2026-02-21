#!/usr/bin/env python3
"""
Generate manifest.json file for the photo gallery.

This script scans the docs/images directory and creates a manifest
of all races and their photo sources.
"""

import json
import os
from datetime import datetime, timedelta, timezone
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


# Place string to location mapping: "省份城市" -> (city, province, country)
PLACE_LOCATIONS = {
    "江苏苏州": ("苏州", "江苏", "中国"),
    "江苏无锡": ("无锡", "江苏", "中国"),
    "江苏常熟": ("常熟", "江苏", "中国"),
    "江苏张家港": ("张家港", "江苏", "中国"),
    "云南昆明": ("昆明", "云南", "中国"),
    "广东湛江": ("湛江", "广东", "中国"),
}

# City center coordinates for map display fallback
CITY_COORDS = {
    "苏州": (31.2990, 120.5853),
    "无锡": (31.4912, 120.3119),
    "常熟": (31.6538, 120.7522),
    "张家港": (31.8756, 120.5536),
    "昆明": (25.0389, 102.7183),
    "湛江": (21.2707, 110.3594),
}




def _lookup_location_by_place(place: str) -> Dict:
    """Look up city/province/country from place string like '江苏苏州'."""
    if not place:
        return {}
    loc = PLACE_LOCATIONS.get(place)
    if loc:
        return {"city": loc[0], "province": loc[1], "country": loc[2]}
    return {}


def _read_exif_datetime(filepath: Path) -> str:
    """Read DateTimeOriginal from EXIF data, return as 'YYYY-MM-DD HH:MM:SS' or ''."""
    try:
        import piexif
        data = piexif.load(str(filepath))
        dto = data.get('Exif', {}).get(piexif.ExifIFD.DateTimeOriginal, b'')
        if dto:
            dt_str = dto.decode() if isinstance(dto, bytes) else dto
            return dt_str.replace(':', '-', 2)
    except Exception:
        pass
    return ""


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
        
        # Try to read race date and place from race_info.json
        race_place = ""
        for source_dir in race_dir.iterdir():
            race_info_file = source_dir / "race_info.json"
            if race_info_file.exists():
                try:
                    with open(race_info_file, 'r', encoding='utf-8') as f:
                        race_info = json.load(f)
                    # RunnerBar format
                    start_time = race_info.get('activity', {}).get('start_time')
                    if start_time:
                        dt = datetime.fromtimestamp(start_time / 1000, tz=timezone.utc)
                        race_data["date"] = dt.strftime("%Y-%m-%d")
                        break
                    # Yipai360 format
                    data_field = race_info.get('data', {})
                    if isinstance(data_field, dict):
                        begin_time = data_field.get('beginTime')
                        if begin_time:
                            dt = datetime.fromtimestamp(begin_time, tz=timezone(timedelta(hours=8)))
                            race_data["date"] = dt.strftime("%Y-%m-%d")
                        place = data_field.get('place', '')
                        if place:
                            race_place = place
                    if race_data["date"]:
                        break
                    # Pailixiang / generic format
                    if not race_data["date"] and race_info.get('date'):
                        race_data["date"] = race_info['date']
                    place = race_info.get('place', '') or race_place
                    if place:
                        race_place = place
                    if race_data["date"]:
                        break
                    # iHuiPao format
                    cutdown = race_info.get('cutdown', '')
                    if cutdown:
                        race_data["date"] = cutdown[:10]
                    if race_data["date"]:
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
            video_cover_map = {}  # video_filename -> cover_filename
            cover_video_map = {}  # cover_filename -> video_filename
            photos_list_file = source_dir / "photos_list.json"
            if photos_list_file.exists():
                try:
                    with open(photos_list_file, 'r', encoding='utf-8') as f:
                        photos_data = json.load(f)
                    photo_list = []
                    # RunnerBar format
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
                            # For videos, meta_info is a URL string, not JSON
                            if isinstance(mi, str) and mi.startswith('http'):
                                # Video: file on disk is named from meta_info URL
                                vid_fname = mi.rsplit('/', 1)[-1]
                                vid_meta = dict(meta)
                                if vid_meta:
                                    photo_meta[vid_fname] = vid_meta
                                # Map video to its cover (url_hq)
                                video_cover_map[vid_fname] = fname
                                cover_video_map[fname] = vid_fname
                            else:
                                try:
                                    mi_data = json.loads(mi) if isinstance(mi, str) else mi
                                    if mi_data:
                                        dt = mi_data.get('DateTimeOriginal', '')
                                        if dt:
                                            meta["timestamp"] = dt.replace(':', '-', 2)
                                except (json.JSONDecodeError, ValueError):
                                    pass
                            if meta:
                                photo_meta[fname] = meta
                    # Yipai360 format — skip createDateTime (upload time, not capture time)
                    # EXIF DateTimeOriginal will be read directly from photos below
                    # PhotoPlus format
                    if 'pics_array' in photos_data:
                        for p in photos_data['pics_array']:
                            fname = p.get('pic_name', '')
                            if fname:
                                meta = {}
                                ts = p.get('exif_timestamp')
                                if ts:
                                    try:
                                        dt = datetime.fromtimestamp(int(ts), tz=timezone(timedelta(hours=8)))
                                        meta["timestamp"] = dt.strftime("%Y-%m-%d %H:%M:%S")
                                    except (ValueError, OSError):
                                        pass
                                if meta:
                                    photo_meta[fname] = meta
                    # Pailixiang format
                    if 'Data' in photos_data and isinstance(photos_data['Data'], list):
                        for p in photos_data['Data']:
                            fname = p.get('Name', p.get('FileName', ''))
                            if fname:
                                meta = {}
                                shoot_time = p.get('ShootTime', '')
                                if shoot_time:
                                    meta["timestamp"] = shoot_time
                                if meta:
                                    photo_meta[fname] = meta
                    # iHuiPao format (list of dicts with shoot_at/origin)
                    if isinstance(photos_data, list) and photos_data and 'shoot_at' in photos_data[0]:
                        for p in photos_data:
                            origin = p.get('origin', '')
                            shoot_at = p.get('shoot_at', '')
                            if origin:
                                fname = origin.rsplit('/', 1)[-1].split('?')[0]
                                if shoot_at:
                                    ts_prefix = shoot_at.replace('-', '').replace(' ', '_').replace(':', '')
                                    fname = f"{ts_prefix}_{fname}"
                                meta = {}
                                if shoot_at:
                                    meta["timestamp"] = shoot_at
                                if meta:
                                    photo_meta[fname] = meta
                    # RunFF format (list of dicts with big/small/ts)
                    if isinstance(photos_data, list) and photos_data and 'big' in photos_data[0]:
                        for p in photos_data:
                            big_path = p.get('big', '')
                            if big_path:
                                fname = big_path.rsplit('/', 1)[-1]
                                meta = {}
                                ts = p.get('ts')
                                if ts:
                                    try:
                                        dt = datetime.fromtimestamp(int(ts), tz=timezone(timedelta(hours=8)))
                                        meta["timestamp"] = dt.strftime("%Y-%m-%d %H:%M:%S")
                                    except (ValueError, OSError):
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
                    if ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4']:
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
                        else:
                            # Fallback: read EXIF DateTimeOriginal from image
                            ts = _read_exif_datetime(photo_file)
                            if ts:
                                entry["timestamp"] = ts
                        photos.append(entry)
            
            # Add poster field to videos and reorder so covers follow their videos
            if video_cover_map:
                # Build URL lookup by filename
                url_by_name = {e["name"]: e["url"] for e in photos}
                for entry in photos:
                    cover_name = video_cover_map.get(entry["name"])
                    if cover_name and cover_name in url_by_name:
                        entry["poster"] = url_by_name[cover_name]
                # Reorder: remove covers, insert each after its video
                cover_names = set(cover_video_map.keys())
                covers_by_name = {e["name"]: e for e in photos if e["name"] in cover_names}
                photos = [e for e in photos if e["name"] not in cover_names]
                reordered = []
                for e in photos:
                    reordered.append(e)
                    cover_name = video_cover_map.get(e["name"])
                    if cover_name and cover_name in covers_by_name:
                        reordered.append(covers_by_name[cover_name])
                photos = reordered
            
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
            # Fallback: use place from race_info if GPS lookup didn't find location
            if not race_data["city"] and race_place:
                location = _lookup_location_by_place(race_place)
                race_data["city"] = location.get("city", "")
                race_data["province"] = location.get("province", "")
                race_data["country"] = location.get("country", "")
            # Check for GPX route file
            route_file = Path("docs/routes") / (race_name + ".gpx")
            if route_file.exists():
                race_data["route"] = "routes/" + race_name + ".gpx"
            # Set race-level lat/lon: prefer GPX route starting point, then city center
            if route_file.exists():
                try:
                    import xml.etree.ElementTree as ET
                    tree = ET.parse(route_file)
                    ns = {'gpx': 'http://www.topografix.com/GPX/1/1'}
                    trkpt = tree.find('.//gpx:trkpt', ns)
                    if trkpt is None:
                        trkpt = tree.find('.//{http://www.topografix.com/GPX/1/1}trkpt')
                    if trkpt is None:
                        trkpt = tree.find('.//trkpt')
                    if trkpt is not None:
                        race_data["lat"] = float(trkpt.get('lat'))
                        race_data["lon"] = float(trkpt.get('lon'))
                except Exception:
                    pass
            # Fallback: city center coordinates
            if "lat" not in race_data and race_data["city"]:
                coords = CITY_COORDS.get(race_data["city"])
                if coords:
                    race_data["lat"] = coords[0]
                    race_data["lon"] = coords[1]
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
    all_items = [
        p for race in manifest["races"]
        for source in race["sources"]
        for p in source["photos"]
    ]
    video_count = sum(1 for p in all_items if p.get("url", "").lower().endswith((".mp4", ".mov", ".webm")))
    photo_count = len(all_items) - video_count
    
    counts = f"{photo_count} photo(s)"
    if video_count:
        counts += f", {video_count} video(s)"
    print(f"✓ Manifest generated: {race_count} race(s), {counts}")
    print(f"✓ Saved to: {output_path}")


if __name__ == "__main__":
    main()
