#!/usr/bin/env python3
"""
Download photos from RunnerBar API.

This script handles downloading race photos from RunnerBar's API,
which requires two API calls:
1. Get race info to retrieve the race name
2. Get photos list to retrieve photo URLs
"""

import json
import os
import sys
import argparse
import requests
from pathlib import Path
from typing import Dict, List, Any, Optional
from download_photos import PhotoDownloader


class RunnerBarDownloader:
    """Handle downloading photos from RunnerBar API."""
    
    def __init__(self, base_dir: str = "docs/images"):
        """Initialize the downloader."""
        self.base_dir = Path(base_dir)
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Race-Photos-Downloader/1.0'
        })
        self.photo_downloader = PhotoDownloader(base_dir)
        self.cache_dir = None  # Will be set during download_photos
    
    @staticmethod
    def sanitize_directory_name(name: str) -> str:
        """
        Sanitize a string to be used as a directory name.
        
        Args:
            name: The string to sanitize
            
        Returns:
            Sanitized string suitable for use as a directory name
        """
        # Keep only alphanumeric characters, spaces, hyphens, and underscores
        sanitized = "".join(c if c.isalnum() or c in (' ', '-', '_') else '_' for c in name)
        # Replace spaces with hyphens and strip whitespace
        return sanitized.strip().replace(' ', '-')
    
    def save_cache(self, filename: str, data: Dict[str, Any]) -> bool:
        """
        Save API response data to cache file.
        
        Args:
            filename: Name of cache file (e.g., 'race_info.json')
            data: Data to cache
            
        Returns:
            True if saved successfully, False otherwise
        """
        if not self.cache_dir:
            return False
        
        try:
            cache_file = self.cache_dir / filename
            with open(cache_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            print(f"✓ Cached to {filename}")
            return True
        except Exception as e:
            print(f"⚠ Failed to save cache {filename}: {e}", file=sys.stderr)
            return False
    
    def load_cache(self, filename: str) -> Optional[Dict[str, Any]]:
        """
        Load API response data from cache file.
        
        Args:
            filename: Name of cache file (e.g., 'race_info.json')
            
        Returns:
            Cached data if found, None otherwise
        """
        if not self.cache_dir:
            return None
        
        cache_file = self.cache_dir / filename
        if not cache_file.exists():
            return None
        
        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            print(f"✓ Loaded from cache: {filename}")
            return data
        except Exception as e:
            print(f"⚠ Failed to load cache {filename}: {e}", file=sys.stderr)
            return None
    
    @staticmethod
    def extract_photo_id(photo: Dict[str, Any], fallback_index: Optional[int] = None) -> str:
        """
        Extract photo ID from photo dictionary.
        
        Args:
            photo: Photo dictionary
            fallback_index: Fallback index if no ID found
            
        Returns:
            Photo ID as string
        """
        photo_id = photo.get('photoId') or photo.get('id')
        if photo_id:
            return str(photo_id)
        return f'photo_{fallback_index}' if fallback_index is not None else 'photo'
    
    def get_race_info(self, activity_id: str, use_cache: bool = True) -> Optional[Dict[str, Any]]:
        """
        Fetch race information from RunnerBar API with caching support.
        
        Args:
            activity_id: The activity ID for the race
            use_cache: Whether to use cached data on API failure
            
        Returns:
            Dictionary containing race info, or None if failed
        """
        url = "https://apiface.store.runnerbar.com/yundong/yd_album/getUserGroupAlbumDetail_modify.json"
        params = {"activity_id": activity_id}
        
        # Try API call first
        try:
            print(f"Fetching race info for activity {activity_id}...")
            response = self.session.get(url, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()
            
            if 'activity' in data and 'title' in data['activity']:
                print(f"✓ Found race: {data['activity']['title']}")
                # Save to cache if cache_dir is set
                if self.cache_dir:
                    self.save_cache('race_info.json', data)
                return data
            else:
                print("✗ No activity.title found in response", file=sys.stderr)
                # Try cache as fallback
                if use_cache:
                    cached = self.load_cache('race_info.json')
                    if cached:
                        print("→ Using cached race info")
                        return cached
                return None
                
        except requests.RequestException as e:
            print(f"✗ Failed to fetch race info: {e}", file=sys.stderr)
            # Try cache as fallback
            if use_cache:
                cached = self.load_cache('race_info.json')
                if cached:
                    print("→ Using cached race info")
                    return cached
            return None
        except json.JSONDecodeError as e:
            print(f"✗ Failed to parse race info JSON: {e}", file=sys.stderr)
            # Try cache as fallback
            if use_cache:
                cached = self.load_cache('race_info.json')
                if cached:
                    print("→ Using cached race info")
                    return cached
            return None
    
    def get_photos_list(self, uid: str, activity_id: str, face_id: str = None, 
                       game_number: str = None, photo_num: int = 200, 
                       pl_id: str = None, use_cache: bool = True) -> Optional[List[Dict[str, Any]]]:
        """
        Fetch photos list from RunnerBar API with caching support.
        
        Args:
            uid: User ID
            activity_id: Activity ID
            face_id: Face ID (optional)
            game_number: Game/Bib number (optional)
            photo_num: Number of photos to retrieve (default: 200)
            pl_id: PL ID (optional)
            use_cache: Whether to use cached data on API failure
            
        Returns:
            List of photo info dictionaries, or None if failed
        """
        url = "https://apiface.store.runnerbar.com/yundong/faceSearch/getFaceAndGameNumSearchPhotoV2.json"
        params = {
            "uid": uid,
            "activity_id": activity_id,
            "photoNum": photo_num,
            "source": "h5"
        }
        
        # Add optional parameters
        if face_id:
            params["face_id"] = face_id
        if game_number:
            params["game_number"] = game_number
        if pl_id:
            params["pl_id"] = pl_id
        
        # Try API call first
        try:
            print(f"Fetching photos list...")
            response = self.session.get(url, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()
            
            if 'topicInfoList' in data:
                photos = data['topicInfoList']
                print(f"✓ Found {len(photos)} photos")
                # Save full response to cache if cache_dir is set
                if self.cache_dir:
                    self.save_cache('photos_list.json', data)
                return photos
            else:
                print("✗ No topicInfoList found in response", file=sys.stderr)
                # Try cache as fallback
                if use_cache:
                    cached = self.load_cache('photos_list.json')
                    if cached and 'topicInfoList' in cached:
                        print("→ Using cached photos list")
                        return cached['topicInfoList']
                return None
                
        except requests.RequestException as e:
            print(f"✗ Failed to fetch photos list: {e}", file=sys.stderr)
            # Try cache as fallback
            if use_cache:
                cached = self.load_cache('photos_list.json')
                if cached and 'topicInfoList' in cached:
                    print("→ Using cached photos list")
                    return cached['topicInfoList']
            return None
        except json.JSONDecodeError as e:
            print(f"✗ Failed to parse photos JSON: {e}", file=sys.stderr)
            # Try cache as fallback
            if use_cache:
                cached = self.load_cache('photos_list.json')
                if cached and 'topicInfoList' in cached:
                    print("→ Using cached photos list")
                    return cached['topicInfoList']
            return None
    
    def download_photos(self, activity_id: str, uid: str, face_id: str = None,
                       game_number: str = None, photo_num: int = 200,
                       pl_id: str = None, source: str = "runnerbar") -> int:
        """
        Download photos from RunnerBar API with caching support.
        
        Args:
            activity_id: Activity ID for the race
            uid: User ID
            face_id: Face ID (optional)
            game_number: Game/Bib number (optional)
            photo_num: Number of photos to retrieve (default: 200)
            pl_id: PL ID (optional)
            source: Source name for organizing photos (default: "runnerbar")
            
        Returns:
            Number of successfully downloaded photos
        """
        # First, try to get race info to determine the race name
        # We'll use a temporary cache location based on activity_id
        temp_cache_dir = self.base_dir / f".cache_{activity_id}" / source
        temp_cache_dir.mkdir(parents=True, exist_ok=True)
        self.cache_dir = temp_cache_dir
        
        # Get race info (will try cache if API fails)
        race_info = self.get_race_info(activity_id)
        if not race_info:
            print("Failed to get race info from both API and cache")
            return 0
        
        # Extract race name from activity.title with validation
        if 'activity' not in race_info or 'title' not in race_info['activity']:
            print("✗ No activity.title found in race info", file=sys.stderr)
            return 0
        
        race_name = race_info['activity']['title']
        # Clean race name for use as directory name
        race_name = self.sanitize_directory_name(race_name)
        
        # Now set the final cache directory
        final_cache_dir = self.base_dir / race_name / source
        final_cache_dir.mkdir(parents=True, exist_ok=True)
        
        # Move cache files from temp to final location if they exist
        if temp_cache_dir != final_cache_dir:
            for cache_file in ['race_info.json', 'photos_list.json']:
                temp_file = temp_cache_dir / cache_file
                final_file = final_cache_dir / cache_file
                if temp_file.exists() and not final_file.exists():
                    temp_file.rename(final_file)
            # Update cache_dir to final location
            self.cache_dir = final_cache_dir
            # Clean up temp directory
            try:
                temp_cache_dir.rmdir()
                (self.base_dir / f".cache_{activity_id}").rmdir()
            except:
                pass  # Ignore if directory not empty or other issues
        
        # Get photos list (will try cache if API fails)
        photos_list = self.get_photos_list(uid, activity_id, face_id, game_number, photo_num, pl_id)
        if not photos_list:
            print("Failed to get photos list from both API and cache")
            return 0
        
        # Extract photo URLs from topicInfoList
        photo_urls = []
        for i, photo in enumerate(photos_list, 1):
            if 'url_hq' in photo and photo['url_hq']:
                photo_id = self.extract_photo_id(photo, i)
                photo_urls.append({
                    'url': photo['url_hq'],
                    'id': photo_id
                })
        
        if not photo_urls:
            print("No url_hq found in photos list")
            return 0
        
        print(f"\nDownloading {len(photo_urls)} photos to docs/images/{race_name}/{source}/")
        
        # Create output directory (should already exist from cache_dir)
        output_dir = self.base_dir / race_name / source
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Download each photo
        success_count = 0
        for i, photo in enumerate(photo_urls, 1):
            url = photo['url']
            photo_id = photo.get('id', f'photo_{i}')
            filename = self.photo_downloader.get_filename_from_url(url, str(photo_id))
            output_path = output_dir / filename
            
            # Skip if already downloaded
            if output_path.exists():
                print(f"⊙ Skipped (exists): {filename}")
                success_count += 1
                continue
            
            if self.photo_downloader.download_photo(url, output_path):
                success_count += 1
        
        print(f"\nCompleted: {success_count}/{len(photo_urls)} photos downloaded")
        return success_count


def main():
    """Main entry point for the script."""
    parser = argparse.ArgumentParser(
        description='Download photos from RunnerBar API',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Download photos with all parameters
  python download_runnerbar.py --activity-id 28183 --uid 3256630 --face-id 7851335 --game-number B51278 --pl-id 3245790

  # Download photos with minimal parameters
  python download_runnerbar.py --activity-id 28183 --uid 3256630
  
  # Specify custom source name
  python download_runnerbar.py --activity-id 28183 --uid 3256630 --source official

  # Download more photos
  python download_runnerbar.py --activity-id 28183 --uid 3256630 --photo-num 500
"""
    )
    
    parser.add_argument('--activity-id', required=True, help='Activity ID for the race')
    parser.add_argument('--uid', required=True, help='User ID')
    parser.add_argument('--face-id', help='Face ID (optional)')
    parser.add_argument('--game-number', help='Game/Bib number (optional)')
    parser.add_argument('--photo-num', type=int, default=200, help='Number of photos to retrieve (default: 200)')
    parser.add_argument('--pl-id', help='PL ID (optional)')
    parser.add_argument('--source', default='runnerbar', help='Source name for organizing photos (default: runnerbar)')
    
    args = parser.parse_args()
    
    downloader = RunnerBarDownloader()
    success_count = downloader.download_photos(
        activity_id=args.activity_id,
        uid=args.uid,
        face_id=args.face_id,
        game_number=args.game_number,
        photo_num=args.photo_num,
        pl_id=args.pl_id,
        source=args.source
    )
    
    if success_count == 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
