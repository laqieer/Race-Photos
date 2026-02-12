#!/usr/bin/env python3
"""
Generate manifest.json file for the photo gallery.

This script scans the docs/images directory and creates a manifest
of all races and their photo sources.
"""

import json
import os
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
        if not race_dir.is_dir() or race_dir.name.startswith('.'):
            continue
        
        race_name = race_dir.name
        race_data = {
            "name": race_name,
            "sources": []
        }
        
        # Scan for source directories within each race
        for source_dir in sorted(race_dir.iterdir()):
            if not source_dir.is_dir() or source_dir.name.startswith('.'):
                continue
            
            source_name = source_dir.name
            photos = []
            
            # Scan for photos within each source
            for photo_file in sorted(source_dir.iterdir()):
                if photo_file.is_file() and not photo_file.name.startswith('.'):
                    # Check if it's an image file
                    ext = photo_file.suffix.lower()
                    if ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
                        # Use relative path from docs directory
                        relative_path = photo_file.relative_to(Path('docs'))
                        photos.append({
                            "url": str(relative_path),
                            "name": photo_file.name
                        })
            
            if photos:
                race_data["sources"].append({
                    "name": source_name,
                    "photos": photos
                })
        
        if race_data["sources"]:
            manifest["races"].append(race_data)
    
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
