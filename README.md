# Race-Photos

My photos from various races, organized and displayed in a beautiful web gallery.

## 📁 Project Structure

```
Race-Photos/
├── scripts/              # Batch download scripts for photos
│   ├── download_photos.py      # Download photos from API responses
│   ├── download_runnerbar.py   # Download photos from RunnerBar API
│   ├── download_yipai360.py    # Download photos from Yipai360 API
│   ├── download_photoplus.py   # Download photos from PhotoPlus API
│   ├── download_pailixiang.py  # Download photos from Pailixiang API
│   ├── generate_manifest.py    # Generate gallery manifest
│   ├── serve.py               # Local dev server (no cache)
│   ├── requirements.txt        # Python dependencies
│   └── README.md              # Scripts documentation
├── docs/                 # GitHub Pages site
│   ├── index.html             # Main gallery page
│   ├── styles.css             # Gallery styles
│   ├── app.js                 # Gallery JavaScript
│   ├── routes/                # GPX route files
│   │   └── {race}.gpx         # GPS route data
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

Start a local development server (with cache disabled) and open in browser:

```bash
python scripts/serve.py
```

Then visit http://localhost:8080, or enable GitHub Pages to view online.

## 📸 Usage Examples

### Download from RunnerBar API

Download photos directly from RunnerBar API:

```bash
# From API URL (extracts parameters automatically)
python scripts/download_runnerbar.py --url "https://apiface.store.runnerbar.com/yundong/faceSearch/getFaceAndGameNumSearchPhotoV2.json?uid=3256630&activity_id=28183&face_id=7851335&game_number=B51278&photoNum=200&pl_id=3245790&source=h5"

# Or with explicit parameters
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

### Download from Yipai360 API

Download photos from Yipai360 using OCR-based bib number search:

```bash
# Search and download photos by bib number
python scripts/download_yipai360.py --order-id 202311222019389358 --bib H1369

# Update gallery
python scripts/generate_manifest.py
```

The `order-id` can be found in the Yipai360 photo live URL (e.g., `https://www.yipai360.com/photolivepc/?orderId=202311222019389358`).

The script will:
1. Fetch race information (name, location, date)
2. Search photos by bib number via OCR recognition
3. Download original photos (without watermark) to `docs/images/{race_name}/yipai360/`
4. Read EXIF metadata and set file timestamps

### Download from PhotoPlus API

Download photos from PhotoPlus (live.photoplus.cn) using bib number or face search:

```bash
# The API requires signed URLs. Open the race page in your browser, search by bib number
# or face photo, and copy the network request URL from DevTools (F12 → Network tab).

# Bib number search:
python scripts/download_photoplus.py --url "https://live.photoplus.cn/home/pic/self/recognize?list=70266832,74915292&number=30483&..."

# Face search:
python scripts/download_photoplus.py --url "https://live.photoplus.cn/home/findme/activitys/pic?url=...&hash=...&activityNos=...&..."

# Update gallery
python scripts/generate_manifest.py
```

> **Note:** The `_s` (signature) and `_t` (timestamp) parameters expire quickly. You must provide a fresh URL each time.

The script will:
1. Fetch photos from the signed API URL
2. Download original photos (without watermark) to `docs/images/{race_name}/photoplus/`
3. Set file timestamps from EXIF metadata

### Download from Pailixiang API

Download photos from Pailixiang (pailixiang.com) using bib number search:

```bash
# You need two IDs from the browser:
# 1. album-page-id: from the URL (e.g., "ia3939628040" from album_ia3939628040.html)
# 2. album-id: from the search POST body in DevTools (a UUID like "a94acb7b-...")

python scripts/download_pailixiang.py \
  --album-page-id ia3939628040 \
  --album-id a94acb7b-8339-429a-ace2-26b8edfcba29 \
  --bib M01080 \
  --place 江苏苏州

# Update gallery
python scripts/generate_manifest.py
```

To find the `album-id`: open the race page, search your bib number, then check the POST request body in DevTools (F12 → Network tab) for the `albumId` field.

The script will:
1. Initialize session from the album page
2. Search photos by bib number
3. Download original photos to `docs/images/{race_name}/pailixiang/`
4. Set file timestamps from ShootTime metadata

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
- **Organized by Races**: Photos grouped by race events, sorted by date
- **Multiple Sources**: Support for photos from different platforms (RunnerBar, Yipai360)
- **Interactive Map**: Overview map with race locations, detail map with GPX route and photo markers
- **GPX Route Display**: Race route with km distance markers and photo positions along the route
- **Performance Chart**: Elevation, pace, and heart rate chart from GPX data
- **Photo Grouping**: Photos grouped by time proximity with pace/HR metrics
- **Lightbox View**: Click any photo to view full size
- **Lazy Loading**: Photos load as you scroll for better performance

## ⚡ Download Optimization

The download scripts are optimized for efficiency:

- **Smart Skip Existing**: Checks if files already exist before downloading
  - Detects previously downloaded photos by filename
  - Skips re-downloading, displays "⊙ Skipped (exists): {filename}"
  - Significantly speeds up re-runs
  - Reduces unnecessary network requests
  - Safe to run multiple times
- **API Response Caching**: Falls back to cached data if API is unavailable
- **Resume Support**: Can resume interrupted downloads

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
