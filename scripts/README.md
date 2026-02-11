# Scripts

Batch download photos from API responses.

## Installation

```bash
pip install -r requirements.txt
```

## Usage

### download_photos.py

Download photos from a JSON API response file:

```bash
python download_photos.py <json_file> <race> <source>
```

**Arguments:**
- `json_file`: Path to JSON file containing the API response
- `race`: Race name/identifier (e.g., "marathon2024", "5k-run-2024")
- `source`: Source name (e.g., "photographerA", "official-photos")

**Example:**

```bash
python download_photos.py api_response.json marathon2024 photographerA
```

This will download photos to: `docs/images/marathon2024/photographerA/`

## Supported JSON Formats

The script automatically detects and handles various JSON structures from different sources:

### Type 1: Direct photos array
```json
{
  "photos": [
    {"url": "https://example.com/photo1.jpg", "id": "123"},
    {"url": "https://example.com/photo2.jpg", "id": "124"}
  ]
}
```

### Type 2: Items array
```json
{
  "items": [
    {"image_url": "https://example.com/photo1.jpg", "photo_id": "123"},
    {"image_url": "https://example.com/photo2.jpg", "photo_id": "124"}
  ]
}
```

### Type 3: Nested data structure
```json
{
  "data": {
    "images": [
      {"src": "https://example.com/photo1.jpg", "identifier": "123"},
      {"src": "https://example.com/photo2.jpg", "identifier": "124"}
    ]
  }
}
```

### Type 4: RunnerBar API format
```json
{
  "topicInfoList": [
    {"url_hq": "https://example.com/photo1.jpg", "photoId": "123"},
    {"url_hq": "https://example.com/photo2.jpg", "photoId": "124"}
  ]
}
```

The script will automatically detect which format is being used and extract the photo URLs accordingly.

## Features

- **Flexible JSON parsing**: Handles multiple API response formats
- **Automatic directory creation**: Creates `docs/images/{race}/{source}/` structure
- **Skip existing files**: Won't re-download photos that already exist
- **Error handling**: Continues downloading even if some photos fail
- **Progress tracking**: Shows download progress and statistics

### download_runnerbar.py

Download photos directly from RunnerBar API:

```bash
python download_runnerbar.py --activity-id <activity_id> --uid <uid> [options]
```

**Required Arguments:**
- `--activity-id`: Activity ID for the race
- `--uid`: User ID

**Optional Arguments:**
- `--face-id`: Face ID
- `--game-number`: Game/Bib number
- `--photo-num`: Number of photos to retrieve (default: 200)
- `--pl-id`: PL ID
- `--source`: Source name for organizing photos (default: "runnerbar")

**Examples:**

```bash
# Download photos with all parameters
python download_runnerbar.py --activity-id 28183 --uid 3256630 --face-id 7851335 --game-number B51278 --pl-id 3245790

# Download photos with minimal parameters
python download_runnerbar.py --activity-id 28183 --uid 3256630

# Specify custom source name
python download_runnerbar.py --activity-id 28183 --uid 3256630 --source official

# Download more photos
python download_runnerbar.py --activity-id 28183 --uid 3256630 --photo-num 500
```

This script will:
1. Fetch race information from the API to get the race name
2. Fetch the photos list from the API
3. Download all photos with `url_hq` to `docs/images/{race_name}/runnerbar/`

### generate_manifest.py

After downloading photos, generate the manifest file for the web gallery:

```bash
python generate_manifest.py
```

This scans the `docs/images/` directory and creates `docs/images/manifest.json` which is used by the web gallery to display photos.

**Note:** Run this script after each batch download to update the gallery.
