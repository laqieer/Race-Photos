/**
 * Guard against GPX files in docs/routes/ that lack a Strava activity link.
 *
 * `generate_manifest.py` derives each race's `strava_url` from
 * `<metadata><link href="https://www.strava.com/activities/<id>">` inside the
 * GPX file. The gallery's "View on Strava" button (`docs/app.js`) depends on
 * that field, so any GPX that ships without the link silently breaks the
 * button for that race.
 *
 * `scripts/download_strava_gpx.py` injects the link automatically, but a
 * hand-dropped GPX (e.g. a fresh export from the Strava website) does not.
 * This test fails loudly so the offending file is fixed before merge — run
 * `python scripts/backfill_gpx_strava_links.py --race-name "<race>"` to
 * inject the link, or re-download via `download_strava_gpx.py`.
 */

const fs = require('fs');
const path = require('path');

const ROUTES_DIR = path.join(__dirname, '..', 'docs', 'routes');
const STRAVA_LINK_RE = /href=["']https:\/\/www\.strava\.com\/activities\/\d+/;

describe('docs/routes GPX files', () => {
    const gpxFiles = fs.existsSync(ROUTES_DIR)
        ? fs.readdirSync(ROUTES_DIR).filter((f) => f.endsWith('.gpx'))
        : [];

    test('every GPX references a Strava activity', () => {
        const offenders = [];
        for (const name of gpxFiles) {
            const content = fs.readFileSync(path.join(ROUTES_DIR, name), 'utf8');
            if (!STRAVA_LINK_RE.test(content)) {
                offenders.push(name);
            }
        }
        if (offenders.length > 0) {
            const list = offenders.map((n) => `  - ${n}`).join('\n');
            throw new Error(
                `${offenders.length} GPX file(s) in docs/routes/ are missing a ` +
                `<metadata><link href="https://www.strava.com/activities/<id>"> ` +
                `element:\n${list}\n\n` +
                `Fix by running:\n` +
                `  python scripts/backfill_gpx_strava_links.py\n` +
                `or, if you can re-download from Strava:\n` +
                `  python scripts/download_strava_gpx.py <activity_id> -o "docs/routes/<race>.gpx"`
            );
        }
        expect(offenders).toEqual([]);
    });

    test('routes directory contains at least one GPX', () => {
        expect(gpxFiles.length).toBeGreaterThan(0);
    });
});
