#!/usr/bin/env python3
"""
Batch download photos from API responses with varying JSON structures.

This script handles downloading race photos from different sources,
each with their own JSON response format.
"""

import json
import os
import sys
import hashlib
import requests
from pathlib import Path
from typing import Dict, List, Any
from urllib.parse import urlparse


class PhotoDownloader:
    """Handle downloading photos from various API sources."""
    
    def __init__(self, base_dir: str = "docs/images"):
        """Initialize the downloader with a base directory."""
        self.base_dir = Path(base_dir)
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Race-Photos-Downloader/1.0'
        })
    
    def parse_api_response(self, response_data: Dict[str, Any], source: str) -> List[Dict[str, str]]:
        """
        Parse API response based on source type.
        
        Different sources have different JSON structures:
        - Type 1: {'photos': [{'url': '...', 'id': '...'}]}
        - Type 2: {'items': [{'image_url': '...', 'photo_id': '...'}]}
        - Type 3: {'data': {'images': [{'src': '...', 'identifier': '...'}]}}
        - Type 4: {'topicInfoList': [{'url_hq': '...', 'photoId': '...'}]} (RunnerBar)
        
        Returns a list of dicts with normalized 'url' and 'id' keys.
        """
        photos = []
        
        # Try different JSON structures
        if 'photos' in response_data:
            # Type 1: Direct photos array
            for photo in response_data.get('photos', []):
                photos.append({
                    'url': photo.get('url') or photo.get('image_url') or photo.get('src'),
                    'id': photo.get('id') or photo.get('photo_id') or photo.get('identifier')
                })
        elif 'items' in response_data:
            # Type 2: Items array
            for item in response_data.get('items', []):
                photos.append({
                    'url': item.get('image_url') or item.get('url') or item.get('src'),
                    'id': item.get('photo_id') or item.get('id') or item.get('identifier')
                })
        elif 'topicInfoList' in response_data:
            # Type 4: RunnerBar API format
            for photo in response_data.get('topicInfoList', []):
                photos.append({
                    'url': photo.get('url_hq') or photo.get('url'),
                    'id': photo.get('photoId') or photo.get('id')
                })
        elif 'data' in response_data:
            # Type 3: Nested data structure
            data = response_data.get('data', {})
            if 'images' in data:
                for image in data.get('images', []):
                    photos.append({
                        'url': image.get('src') or image.get('url') or image.get('image_url'),
                        'id': image.get('identifier') or image.get('id') or image.get('photo_id')
                    })
            elif 'photos' in data:
                for photo in data.get('photos', []):
                    photos.append({
                        'url': photo.get('url') or photo.get('image_url') or photo.get('src'),
                        'id': photo.get('id') or photo.get('photo_id') or photo.get('identifier')
                    })
        
        # Filter out entries without URLs
        photos = [p for p in photos if p.get('url')]
        
        return photos
    
    def download_photo(self, url: str, output_path: Path) -> bool:
        """Download a single photo from URL to output path."""
        try:
            response = self.session.get(url, timeout=30)
            response.raise_for_status()
            
            # Create parent directory if it doesn't exist
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Write the image data
            with open(output_path, 'wb') as f:
                f.write(response.content)
            
            print(f"✓ Downloaded: {output_path.name}")
            return True
            
        except requests.RequestException as e:
            print(f"✗ Failed to download {url}: {e}", file=sys.stderr)
            return False
    
    def get_filename_from_url(self, url: str, photo_id: str = None) -> str:
        """Extract filename from URL or generate from photo ID."""
        parsed = urlparse(url)
        filename = os.path.basename(parsed.path)
        
        # If filename is empty or invalid, use photo_id
        if not filename or '.' not in filename:
            ext = '.jpg'  # Default extension
            if photo_id:
                filename = f"{photo_id}{ext}"
            else:
                # Use stable hash for consistent filenames across runs
                url_hash = hashlib.md5(url.encode()).hexdigest()[:10]
                filename = f"photo_{url_hash}{ext}"
        
        return filename
    
    def batch_download(self, json_file: str, race: str, source: str) -> int:
        """
        Batch download photos from a JSON API response file.
        
        Args:
            json_file: Path to JSON file containing API response
            race: Race name/identifier for organizing photos
            source: Source name for organizing photos
            
        Returns:
            Number of successfully downloaded photos
        """
        # Load the JSON response
        try:
            with open(json_file, 'r') as f:
                response_data = json.load(f)
        except (IOError, json.JSONDecodeError) as e:
            print(f"Error reading JSON file: {e}", file=sys.stderr)
            return 0
        
        # Parse the response to get photo URLs
        photos = self.parse_api_response(response_data, source)
        
        if not photos:
            print(f"No photos found in {json_file}")
            return 0
        
        print(f"Found {len(photos)} photos to download")
        
        # Create output directory
        output_dir = self.base_dir / race / source
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Download each photo
        success_count = 0
        for i, photo in enumerate(photos, 1):
            url = photo['url']
            photo_id = photo.get('id', f'photo_{i}')
            filename = self.get_filename_from_url(url, photo_id)
            output_path = output_dir / filename
            
            # Skip if already downloaded
            if output_path.exists():
                print(f"⊙ Skipped (exists): {filename}")
                success_count += 1
                continue
            
            if self.download_photo(url, output_path):
                success_count += 1
        
        print(f"\nCompleted: {success_count}/{len(photos)} photos downloaded")
        return success_count


def main():
    """Main entry point for the script."""
    if len(sys.argv) < 4:
        print("Usage: python download_photos.py <json_file> <race> <source>")
        print("\nExample:")
        print("  python download_photos.py api_response.json marathon2024 photographerA")
        print("\nThis will download photos to: docs/images/marathon2024/photographerA/")
        sys.exit(1)
    
    json_file = sys.argv[1]
    race = sys.argv[2]
    source = sys.argv[3]
    
    downloader = PhotoDownloader()
    success_count = downloader.batch_download(json_file, race, source)
    
    if success_count == 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
