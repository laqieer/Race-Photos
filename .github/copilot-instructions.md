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

**Data flow:** Download scripts → local media staging + `docs/images/{race}/{source}/` JSON caches → shared release-asset upload workflow → `external_media.json` / metadata in `docs/images/{race}/{source}/` → `generate_manifest.py` → `docs/images/manifest.json` → `app.js` renders gallery.

**Testing:** Unit tests (`tests/app.test.js`) run in jsdom with mocked Leaflet/DOM APIs. E2E tests (`tests/e2e/gallery.spec.js`) run Playwright against the deployed GitHub Pages site. Jest ignores the `tests/e2e/` directory; Playwright only runs from it.

## Key Conventions

- Never commit media binaries to Git; always upload photos/videos to release assets and keep only metadata (`race_info.json`, `photos_list.json`, `external_media.json`, manifest data) in the repo
- Photo timestamps are UTC+8 (China Standard Time); `photoTimestampToUtc()` converts them
- Download scripts skip already-existing files and cache API responses (`race_info.json`, `photos_list.json`) for offline/incremental use
- `app.js` must work both in browsers (DOM + CDN libs) and in Node.js (Jest) — guard exports with `typeof module !== 'undefined'`
- GPX files are stored locally in `docs/routes/{race}.gpx` and cached in `localStorage` to avoid Strava rate limits
- Always update documentation (README, etc.) after making code changes
- Always add unit tests and E2E tests for new changes when possible

## Workflow for New Race

When adding a new race (downloading photos from a platform + Strava activity):

1. Download photos with the platform-specific script (e.g. `download_runnerbar.py`, `download_alltuu.py`, `download_runff.py`, etc.) into `docs/images/{race}/{source}/`
2. **Pause for explicit user review** of the downloaded files — face/bib search may include false positives
3. For RunFF races: after review, request originals by email using the dedicated helper (NEVER re-run `download_runff.py` without `--metadata-only`, or it will re-download deleted false positives and pollute the curated set):
   - Preflight: `python scripts/request_runff_original_emails.py --race-name "{race}" --dry-run`
   - Send: `python scripts/request_runff_original_emails.py --race-name "{race}" -y`
   - If `photos_list.json` is missing for the race, regenerate it safely first with `python scripts/download_runff.py --race-id {id} --fid {fid} --bib {bib} --race-name "{race}" --metadata-only`
4. When the RunFF email zip arrives (contains both `*.jpg` originals and `sy_*.jpg` watermarked variants), DO NOT extract manually or overwrite the root low-res files. Use the dedicated helper, which extracts to `runff/original/` and `runff/original-watermark/`, uploads to deterministic release tags (`media-{year}-runff-original-*` and `media-{year}-runff-original-watermark-*`), and re-routes gallery URLs:
   - Dry-run: `python scripts/publish_runff_originals.py --race-name "{race}" --zip-path "{path/to/file.zip}" --dry-run`
   - Publish: `python scripts/publish_runff_originals.py --race-name "{race}" --zip-path "{path/to/file.zip}"`
   - The 3-tier RunFF layout per race is: `runff/` (low-res face-search, root release) + `runff/original/` (high-res, `original` release) + `runff/original-watermark/` (`sy_*.jpg` watermarked, `original-watermark` release). All three tiers must be preserved.
5. Upload kept media to release assets (run from repo root, not from `scripts/`): `python scripts/migrate_media_to_release_assets.py --race-name "{race}"`
6. Download the Strava route GPX: `python scripts/download_strava_gpx.py {activity_id} -o "docs/routes/{race}.gpx"` (Strava export often returns 429; the script falls back to opening the browser at `…/export_gpx` and moving the downloaded file into place)
7. **Skip the Strava photo upload by default — the user uploads photos to Strava manually.** Only run `python scripts/upload_strava_photos.py --race-name "{race}" --activity-ids {id1} [{id2} ...]` if the user explicitly asks for it; it requires Edge running with `--remote-debugging-port=9222` and a logged-in Strava session, and `--activity-ids` must always be passed explicitly when the race has multiple recordings (auto date matching is unreliable).
8. Regenerate the manifest: `python scripts/generate_manifest.py` (already invoked by step 5, but rerun if step 7 updated `external_media.json`)
9. Run unit tests: `npm test`
10. Commit and push the metadata changes — `scripts/` is a Git submodule, so any script edits need a commit there first, then a parent-repo commit to bump the submodule pointer. Never commit binaries (release assets are already published in step 5)

## Workflow for New Changes

1. Make code changes
2. Run unit tests locally: `npm test` — fix until all pass
3. Start local server: `python -m http.server 8081 --directory docs`
4. Run E2E tests locally: `BASE_URL=http://localhost:8081 npx playwright test` — fix until all pass
5. Update README and other docs to reflect the changes
6. Commit and push
7. Check all three CI workflows pass (Tests → Deploy → E2E)
8. If CI fails, fix, and repeat from step 2
