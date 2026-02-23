# Race-Photos

My photos from various races, organized and displayed in a beautiful web gallery.

## 📁 Project Structure

```
Race-Photos/
├── scripts/              # Private submodule (Race-Photos-Scripts)
│   ├── download_photos.py      # Download photos from API responses
│   ├── download_runnerbar.py   # Download photos from RunnerBar API
│   ├── download_yipai360.py    # Download photos from Yipai360 API
│   ├── download_photoplus.py   # Download photos from PhotoPlus API
│   ├── download_pailixiang.py  # Download photos from Pailixiang API
│   ├── download_runff.py      # Download photos from RunFF API
│   ├── download_ihuipao.py    # Download photos from iHuiPao API
│   ├── download_strava_gpx.py  # Download GPX routes from Strava API
│   ├── fix_gpx_elevation.py    # Fix barometric altimeter errors in GPX
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
│   └── images/                # Downloaded photos & videos
│       ├── {race}/            # Race directories
│       │   └── {source}/      # Source directories
│       │       ├── *.jpg      # Photo files
│       │       ├── *.mp4      # Video files
│       │       ├── race_info.json    # Race metadata (committed)
│       │       └── photos_list.json  # Photo metadata (committed)
│       └── manifest.json      # Gallery manifest
└── README.md            # This file
```

## 🚀 Quick Start

### 1. Clone with Submodule

The download scripts are stored in a private submodule. Clone with:

```bash
git clone --recurse-submodules https://github.com/laqieer/Race-Photos.git

# Or if already cloned:
git submodule update --init --recursive
```

> **Note:** The `scripts/` submodule points to a private repo ([Race-Photos-Scripts](https://github.com/laqieer/Race-Photos-Scripts)). You need access to clone it. The gallery itself works without the submodule — only the download/management scripts require it.

### 2. Install Dependencies

```bash
cd scripts
pip install -r requirements.txt
```

### 3. Download Photos & Generate Manifest

See the [scripts README](scripts/README.md) for detailed usage of each download script.

```bash
# Example: download from RunnerBar API
python scripts/download_runnerbar.py --url "https://..."

# Update gallery
python scripts/generate_manifest.py
```

### 4. View Gallery

Start a local development server (with cache disabled) and open in browser:

```bash
python scripts/serve.py
```

Then visit http://localhost:8080, or enable GitHub Pages to view online.

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
- **Multiple Sources**: Support for photos from different platforms (RunnerBar, Yipai360, PhotoPlus, Pailixiang, RunFF, iHuiPao)
- **Interactive Map**: Overview map with clustered race markers, detail map with GPX route and photo markers
- **GPX Route Display**: Race route with km distance markers and photo positions along the route
- **Performance Chart**: Elevation, pace, and heart rate chart from GPX data
- **Photo Grouping**: Photos grouped by time proximity with pace/HR metrics
- **Lightbox View**: Click any photo or video to view full size
- **Video Support**: Videos displayed with play icon overlay, hover-to-preview, and full playback in lightbox
- **Lazy Loading**: Photos load as you scroll for better performance

## 📝 License

All photos are property of their respective owners.
