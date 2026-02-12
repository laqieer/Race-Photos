# Race-Photos

My photos from various races, organized and displayed in a beautiful web gallery.

## 📁 Project Structure

```
Race-Photos/
├── scripts/              # Batch download scripts for photos
│   ├── download_photos.py      # Download photos from API responses
│   ├── download_runnerbar.py   # Download photos from RunnerBar API
│   ├── generate_manifest.py    # Generate gallery manifest
│   ├── requirements.txt        # Python dependencies
│   └── README.md              # Scripts documentation
├── docs/                 # GitHub Pages site
│   ├── index.html             # Main gallery page
│   ├── styles.css             # Gallery styles
│   ├── app.js                 # Gallery JavaScript
│   └── images/                # Downloaded photos
│       ├── {race}/            # Race directories
│       │   └── {source}/      # Source directories
│       │       ├── *.jpg      # Photo files
│       │       ├── race_info.json    # Race metadata (committed)
│       │       └── photos_list.json  # Photo metadata (committed)
│       └── manifest.json      # Gallery manifest
└── README.md            # This file
```

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd scripts
pip install -r requirements.txt
```

### 2. Download Photos

Save API response to a JSON file, then run:

```bash
python scripts/download_photos.py <json_file> <race> <source>
```

**Example:**
```bash
python scripts/download_photos.py marathon_api.json marathon2024 official
```

This downloads photos to: `docs/images/marathon2024/official/`

### 3. Generate Gallery Manifest

After downloading photos, update the gallery:

```bash
python scripts/generate_manifest.py
```

### 4. View Gallery

Open `docs/index.html` in a browser, or enable GitHub Pages to view online.

## 📸 Usage Examples

### Download from RunnerBar API

Download photos directly from RunnerBar API:

```bash
python scripts/download_runnerbar.py --activity-id 28183 --uid 3256630 --face-id 7851335 --game-number B51278 --pl-id 3245790

# Or with minimal parameters
python scripts/download_runnerbar.py --activity-id 28183 --uid 3256630

# Update gallery
python scripts/generate_manifest.py
```

The script will:
1. Fetch race information to get the race name
2. Fetch photos list from the API
3. Download all photos to `docs/images/{race_name}/runnerbar/`

### Download from Different Sources

```bash
# Download from official photographer
python scripts/download_photos.py official_response.json marathon2024 official

# Download from another source
python scripts/download_photos.py photographer_a.json marathon2024 photographerA

# Update gallery
python scripts/generate_manifest.py
```

### Supported JSON Formats

The download script handles various API response formats automatically:

**Type 1: Direct photos array**
```json
{
  "photos": [
    {"url": "https://example.com/photo1.jpg", "id": "123"}
  ]
}
```

**Type 2: Items array**
```json
{
  "items": [
    {"image_url": "https://example.com/photo1.jpg", "photo_id": "123"}
  ]
}
```

**Type 3: Nested data structure**
```json
{
  "data": {
    "images": [
      {"src": "https://example.com/photo1.jpg", "identifier": "123"}
    ]
  }
}
```

**Type 4: RunnerBar API format**
```json
{
  "topicInfoList": [
    {"url_hq": "https://example.com/photo1.jpg", "photoId": "123"}
  ]
}
```

## 🌐 GitHub Pages

To enable GitHub Pages:

1. Go to repository Settings → Pages
2. Set Source to "Deploy from a branch"
3. Select branch: `main`, folder: `/docs`
4. Save

Your gallery will be available at: `https://<username>.github.io/Race-Photos/`

## 🎨 Gallery Features

- **Responsive Design**: Works on desktop, tablet, and mobile
- **Organized by Races**: Photos grouped by race events
- **Multiple Sources**: Support for photos from different photographers
- **Lightbox View**: Click any photo to view full size
- **Lazy Loading**: Photos load as you scroll for better performance

## 💾 Metadata Preservation

The download scripts automatically save API responses as JSON files alongside photos:

- **race_info.json**: Race metadata (title, date, location, etc.) committed to Git
- **photos_list.json**: Photo metadata (camera info, GPS, timestamps, etc.) committed to Git

These files provide:
- **API Resilience**: Work offline if API is unavailable
- **Historical Data**: Preserve race information even if API changes
- **Future Enhancement**: Rich metadata available for gallery features
- **Debugging**: Raw API responses for troubleshooting

## 📝 License

All photos are property of their respective owners.
