# Copilot Instructions for Race-Photos

## Build & Test

```bash
npm test                          # Run all unit tests (Jest + jsdom)
npx jest --verbose -- -t "name"   # Run a single test by name
npx playwright test               # Run E2E tests (against live GitHub Pages site)
npx playwright test -g "pattern"  # Run a single E2E test by title
python serve.py                   # Local dev server at http://localhost:8080 (serves docs/, no-cache)
```

No build step — the frontend is vanilla HTML/CSS/JS served directly from `docs/`.

## Architecture

**Frontend (docs/):** A single-page gallery app. `app.js` contains a `RacePhotosGallery` class that loads `images/manifest.json`, uses hash-based routing (`#raceName`) for overview vs. detail views, and renders everything via DOM manipulation. External libs (Leaflet, Chart.js, MarkerCluster) are loaded from CDNs in `index.html`. The class is exported via `module.exports` for testing.

**Data pipeline (scripts/):** A private Git submodule ([Race-Photos-Scripts](https://github.com/laqieer/Race-Photos-Scripts)) containing Python scripts that download photos from various Chinese race photo platforms (RunnerBar, Pailixiang, PhotoPlus, Yipai360, RunFF, iHuiPao) and Strava GPX routes. `generate_manifest.py` scans `docs/images/` to produce `manifest.json`. Each race directory has cached `race_info.json` and `photos_list.json`.

**Data flow:** Download scripts → `docs/images/{race}/{source}/` photos + JSON caches → `generate_manifest.py` → `docs/images/manifest.json` → `app.js` renders gallery.

**Testing:** Unit tests (`tests/app.test.js`) run in jsdom with mocked Leaflet/DOM APIs. E2E tests (`tests/e2e/gallery.spec.js`) run Playwright against the deployed GitHub Pages site. Jest ignores the `tests/e2e/` directory; Playwright only runs from it.

## Key Conventions

- Photos are committed to Git in `docs/images/{race}/{source}/` — the `.gitignore` explicitly allows this
- Photo timestamps are UTC+8 (China Standard Time); `photoTimestampToUtc()` converts them
- Download scripts skip already-existing files and cache API responses (`race_info.json`, `photos_list.json`) for offline/incremental use
- `app.js` must work both in browsers (DOM + CDN libs) and in Node.js (Jest) — guard exports with `typeof module !== 'undefined'`
- GPX files are stored locally in `docs/routes/{race}.gpx` and cached in `localStorage` to avoid Strava rate limits
- Always update documentation (README, etc.) after making code changes
- Always add unit tests for new changes when possible
- Always check CI status after pushing — three workflows: Tests, Deploy to GitHub Pages, E2E Tests (triggered after deploy)
