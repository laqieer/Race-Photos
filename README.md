# Race-Photos

[![Deploy to GitHub Pages](https://github.com/laqieer/Race-Photos/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/laqieer/Race-Photos/actions/workflows/deploy-pages.yml)
[![Tests](https://github.com/laqieer/Race-Photos/actions/workflows/test.yml/badge.svg)](https://github.com/laqieer/Race-Photos/actions/workflows/test.yml)
[![E2E](https://github.com/laqieer/Race-Photos/actions/workflows/e2e.yml/badge.svg)](https://github.com/laqieer/Race-Photos/actions/workflows/e2e.yml)
[![Coverage](https://img.shields.io/endpoint?url=https://laqieer.github.io/Race-Photos/coverage.json)](https://github.com/laqieer/Race-Photos/actions/workflows/test.yml)
[![Vibe Coded](https://img.shields.io/badge/vibe-coded-%23ff69b4?style=flat)](https://github.com/topics/vibe-coding)
[![Mirror](https://img.shields.io/badge/mirror-Gitee-red)](https://gitee.com/laqieer/Race-Photos)

My photos and videos from various races and platforms, organized and displayed in a beautiful web gallery.

🔗 **Live site**: https://laqieer.github.io/Race-Photos/

## 📁 Project Structure

```
Race-Photos/
├── scripts/              # Private submodule (Race-Photos-Scripts)
├── docs/                 # GitHub Pages site
│   ├── index.html             # Main gallery page
│   ├── styles.css             # Gallery styles
│   ├── app.js                 # Gallery JavaScript
│   ├── routes/                # GPX route files
│   │   └── {race}.gpx         # GPS route data (with Strava metadata)
│   └── images/                # Race media metadata + optional local media cache
│       ├── {race}/            # Race directories (sanitized race titles)
│       │   └── {source}/      # Source directories
│       │       ├── *.jpg      # Optional local photo/video files before migration
│       │       ├── *.mp4      # Optional local photo/video files before migration
│       │       ├── race_info.json    # Race metadata (committed)
│       │       ├── photos_list.json  # Photo metadata (git-ignored local cache)
│       │       └── external_media.json # Externally hosted media mapping
│       └── manifest.json      # Gallery manifest
├── .github/workflows/    # CI/CD
│   ├── deploy-pages.yml       # Deploy to GitHub Pages + coverage
│   ├── test.yml               # Run unit tests + upload report artifact
│   ├── e2e.yml                # Run E2E tests after deployment
│   └── update-wiki.yml        # Regenerate wiki pages from manifest
├── .github/scripts/      # CI helper scripts (not the private submodule)
│   ├── generate_wiki.py       # Wiki page generator (reads manifest.json)
│   └── test_generate_wiki.py  # Unit tests for the wiki generator
├── tests/                # Tests
│   ├── app.test.js            # Unit tests (Jest + jsdom)
│   └── e2e/                   # E2E tests (Playwright)
│       └── gallery.spec.js    # Gallery E2E tests
├── serve.py             # Local dev server (no cache)
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

See the [scripts README](https://github.com/laqieer/Race-Photos-Scripts/blob/main/README.md) for platform-specific download commands and the release-upload workflow.

```bash
# Download photos/videos (see scripts README for platform-specific commands)
python scripts/download_<platform>.py [options]

# Update gallery
python scripts/generate_manifest.py
```

The gallery now supports committing only metadata while serving photos/videos from stable external URLs (for example GitHub release asset URLs) via per-source `external_media.json` files, using a shared post-download release-upload workflow from the scripts submodule.

### 4. View Gallery

Start a local development server (with cache disabled) and open in browser:

```bash
python serve.py       # Serve repo-local docs/ on port 8080
python serve.py 8081  # Serve repo-local docs/ on a custom port
```

Then visit http://localhost:8080, or enable GitHub Pages to view online.

## 🌐 GitHub Pages

The site is deployed automatically via GitHub Actions (see `.github/workflows/deploy-pages.yml`). It also runs tests with coverage and publishes a test report artifact.

Your gallery is available at: `https://<username>.github.io/Race-Photos/`

## 🎨 Gallery Features

- **Responsive Design**: Works on desktop, tablet, and mobile
- **Organized by Races**: Photos grouped by race events, sorted by date
- **Multiple Sources**: Support for photos from different race photo platforms
- **Interactive Map**: Overview map with clustered race markers and highlighted city/admin boundaries, using province-aware place lookup, broader name search, reverse-geocode GPS fallback, and city mapping tables when source metadata is sparse, plus detail maps with GPX routes and photo markers
- **GPX Route Display**: Race route with km distance markers and photo positions along the route
- **Performance Chart**: Elevation, pace, and heart rate chart from GPX data
- **Photo Grouping**: Photos grouped by time proximity with pace/HR metrics
- **Strava Integration**: Link to Strava activity and GPX download on race detail pages
- **External Links**: Quick access to race results and certificates from overview page
- **Lightbox View**: Click any photo or video to view full size
- **Video Support**: Videos displayed with play icon overlay, hover-to-preview, and full playback in lightbox
- **Lazy Loading**: Photos load as you scroll for better performance

## 🧪 Testing

```bash
npm test                                            # Run unit tests
npm run test:report                                 # Run unit tests with coverage report
npx playwright test                                 # Run E2E tests against live site
BASE_URL=http://127.0.0.1:8081 npx playwright test  # Run E2E tests locally after `python serve.py 8081`
python -m unittest discover -s .github/scripts -p 'test_*.py'  # Run CI helper script tests
```

Unit tests use Jest with jsdom. E2E tests use Playwright against the deployed GitHub Pages site. Test reports are uploaded as CI artifacts on every push.

## 📖 Wiki

The [GitHub wiki](https://github.com/laqieer/Race-Photos/wiki) is generated automatically from `docs/images/manifest.json` by [`.github/scripts/generate_wiki.py`](./.github/scripts/generate_wiki.py). The [`update-wiki`](./.github/workflows/update-wiki.yml) workflow re-runs the generator whenever the manifest changes on `main` and pushes a `Sync wiki with manifest` commit to the wiki repo.

- One `{race}.md` page per race plus `Home.md` (index table) and `_Footer.md`.
- Generated pages start with `<!-- generated-by: generate_wiki.py; do not edit manually -->`. Manual edits to these pages are overwritten on the next sync; pages without that marker are preserved.
- To regenerate locally: `git clone https://github.com/laqieer/Race-Photos.wiki.git && python .github/scripts/generate_wiki.py --manifest docs/images/manifest.json --output Race-Photos.wiki`.
- The workflow uses `secrets.GITHUB_TOKEN` to push to the wiki by default. If pushes are blocked by repo policy, set an optional `WIKI_TOKEN` secret (classic PAT with `repo` scope) and the workflow will use it instead.

## 🤖 Built with GitHub Copilot

This project was entirely coded by [GitHub Copilot](https://github.com/features/copilot) powered by Claude Opus 4.6 (Anthropic) — including the gallery frontend, download scripts, manifest generator, GPX processing, and CI/CD workflow.

## 📝 License

All photos are property of their respective owners.
