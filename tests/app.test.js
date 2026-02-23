/**
 * @jest-environment jsdom
 */

const { RacePhotosGallery } = require('../docs/app');

let gallery;

beforeEach(() => {
    document.body.innerHTML = '<div id="races-container"></div>';
    gallery = new RacePhotosGallery();
});

describe('formatMediaCount', () => {
    test('returns "0 photos" for empty array', () => {
        expect(gallery.formatMediaCount([])).toBe('0 photos');
    });

    test('counts photos only', () => {
        const items = [
            { url: 'a.jpg' },
            { url: 'b.png' },
        ];
        expect(gallery.formatMediaCount(items)).toBe('2 photos');
    });

    test('counts videos only', () => {
        const items = [
            { url: 'a.mp4' },
            { url: 'b.mov' },
        ];
        expect(gallery.formatMediaCount(items)).toBe('2 videos');
    });

    test('counts mixed photos and videos', () => {
        const items = [
            { url: 'a.jpg' },
            { url: 'b.mp4' },
            { url: 'c.webm' },
        ];
        expect(gallery.formatMediaCount(items)).toBe('1 photo, 2 videos');
    });

    test('singular photo', () => {
        expect(gallery.formatMediaCount([{ url: 'a.jpg' }])).toBe('1 photo');
    });

    test('singular video', () => {
        expect(gallery.formatMediaCount([{ url: 'a.mp4' }])).toBe('1 video');
    });

    test('case insensitive video extensions', () => {
        const items = [{ url: 'a.MP4' }, { url: 'b.MOV' }, { url: 'c.WebM' }];
        expect(gallery.formatMediaCount(items)).toBe('3 videos');
    });

    test('uses name field when url is missing', () => {
        const items = [{ name: 'video.mp4' }, { name: 'photo.jpg' }];
        expect(gallery.formatMediaCount(items)).toBe('1 photo, 1 video');
    });
});

describe('haversine', () => {
    test('same point returns 0', () => {
        expect(gallery.haversine(0, 0, 0, 0)).toBe(0);
    });

    test('known distance: ~111 km for 1 degree latitude', () => {
        const dist = gallery.haversine(0, 0, 1, 0);
        expect(dist).toBeGreaterThan(110000);
        expect(dist).toBeLessThan(112000);
    });

    test('symmetry', () => {
        const d1 = gallery.haversine(30, 120, 31, 121);
        const d2 = gallery.haversine(31, 121, 30, 120);
        expect(d1).toBeCloseTo(d2, 5);
    });
});

describe('photoTimestampToUtc', () => {
    test('converts UTC+8 timestamp to UTC ms', () => {
        const utcMs = gallery.photoTimestampToUtc('2024-01-21 08:00:00');
        const expected = new Date('2024-01-21T08:00:00+08:00').getTime();
        expect(utcMs).toBe(expected);
    });

    test('midnight UTC+8', () => {
        const utcMs = gallery.photoTimestampToUtc('2024-01-21 00:00:00');
        const expected = new Date('2024-01-20T16:00:00Z').getTime();
        expect(utcMs).toBe(expected);
    });
});

describe('formatPace', () => {
    test('null returns empty string', () => {
        expect(gallery.formatPace(null)).toBe('');
    });

    test('formats whole minutes', () => {
        expect(gallery.formatPace(5.0)).toBe("5'00\"");
    });

    test('formats minutes and seconds', () => {
        expect(gallery.formatPace(5.5)).toBe("5'30\"");
    });

    test('formats with leading zero seconds', () => {
        expect(gallery.formatPace(6.05)).toBe("6'03\"");
    });
});

describe('interpolatePosition', () => {
    const trackpoints = [
        { lat: 0, lon: 0, time: 1000, dist: 0 },
        { lat: 1, lon: 1, time: 2000, dist: 100 },
        { lat: 2, lon: 2, time: 3000, dist: 200 },
        { lat: 3, lon: 3, time: 4000, dist: 300 },
    ];

    test('returns null for empty trackpoints', () => {
        expect(gallery.interpolatePosition([], 1500)).toBeNull();
    });

    test('returns null for time way before range', () => {
        expect(gallery.interpolatePosition(trackpoints, -60000)).toBeNull();
    });

    test('returns null for time way after range', () => {
        expect(gallery.interpolatePosition(trackpoints, 100000)).toBeNull();
    });

    test('returns first point for time at start', () => {
        const pos = gallery.interpolatePosition(trackpoints, 1000);
        expect(pos.lat).toBe(0);
        expect(pos.dist).toBe(0);
    });

    test('returns last point for time at end', () => {
        const pos = gallery.interpolatePosition(trackpoints, 4000);
        expect(pos.lat).toBe(3);
        expect(pos.dist).toBe(300);
    });

    test('interpolates midpoint', () => {
        const pos = gallery.interpolatePosition(trackpoints, 1500);
        expect(pos.lat).toBeCloseTo(0.5, 5);
        expect(pos.lon).toBeCloseTo(0.5, 5);
        expect(pos.dist).toBeCloseTo(50, 5);
    });

    test('interpolates at 75%', () => {
        const pos = gallery.interpolatePosition(trackpoints, 1750);
        expect(pos.lat).toBeCloseTo(0.75, 5);
        expect(pos.dist).toBeCloseTo(75, 5);
    });

    test('within tolerance before start returns first point', () => {
        const pos = gallery.interpolatePosition(trackpoints, 980);
        expect(pos.lat).toBe(0);
    });

    test('within tolerance after end returns last point', () => {
        const pos = gallery.interpolatePosition(trackpoints, 4020);
        expect(pos.lat).toBe(3);
    });
});

describe('getMetricsAtTime', () => {
    const trackpoints = [
        { lat: 0, lon: 0, time: 0, dist: 0, hr: 120 },
        { lat: 0.001, lon: 0, time: 60000, dist: 111, hr: 130 },
        { lat: 0.002, lon: 0, time: 120000, dist: 222, hr: 140 },
        { lat: 0.003, lon: 0, time: 180000, dist: 333, hr: 150 },
    ];

    test('returns hr from closest point', () => {
        const metrics = gallery.getMetricsAtTime(trackpoints, 60000);
        expect(metrics.hr).toBe(130);
    });

    test('returns pace when sufficient distance', () => {
        const metrics = gallery.getMetricsAtTime(trackpoints, 120000);
        expect(metrics.pace).not.toBeNull();
        expect(metrics.pace).toBeGreaterThan(0);
    });
});

describe('parseGpx', () => {
    test('parses basic GPX', () => {
        const xml = `<?xml version="1.0"?>
        <gpx>
          <trk><trkseg>
            <trkpt lat="30.0" lon="120.0">
              <ele>10</ele>
              <time>2024-01-01T00:00:00Z</time>
            </trkpt>
            <trkpt lat="30.001" lon="120.001">
              <ele>15</ele>
              <time>2024-01-01T00:01:00Z</time>
            </trkpt>
          </trkseg></trk>
        </gpx>`;

        const points = gallery.parseGpx(xml);
        expect(points).toHaveLength(2);
        expect(points[0].lat).toBe(30.0);
        expect(points[0].lon).toBe(120.0);
        expect(points[0].ele).toBe(10);
        expect(points[0].dist).toBe(0);
        expect(points[1].dist).toBeGreaterThan(0);
    });

    test('parses GPX with heart rate', () => {
        const xml = `<?xml version="1.0"?>
        <gpx>
          <trk><trkseg>
            <trkpt lat="30.0" lon="120.0">
              <time>2024-01-01T00:00:00Z</time>
              <hr>145</hr>
            </trkpt>
          </trkseg></trk>
        </gpx>`;

        const points = gallery.parseGpx(xml);
        expect(points[0].hr).toBe(145);
    });

    test('skips points without time', () => {
        const xml = `<?xml version="1.0"?>
        <gpx>
          <trk><trkseg>
            <trkpt lat="30.0" lon="120.0">
              <time>2024-01-01T00:00:00Z</time>
            </trkpt>
            <trkpt lat="30.001" lon="120.001">
            </trkpt>
          </trkseg></trk>
        </gpx>`;

        const points = gallery.parseGpx(xml);
        expect(points).toHaveLength(1);
    });

    test('returns empty array for empty GPX', () => {
        const xml = `<?xml version="1.0"?><gpx><trk><trkseg></trkseg></trk></gpx>`;
        expect(gallery.parseGpx(xml)).toHaveLength(0);
    });

    test('cumulative distance increases', () => {
        const xml = `<?xml version="1.0"?>
        <gpx>
          <trk><trkseg>
            <trkpt lat="30.0" lon="120.0"><time>2024-01-01T00:00:00Z</time></trkpt>
            <trkpt lat="30.001" lon="120.001"><time>2024-01-01T00:01:00Z</time></trkpt>
            <trkpt lat="30.002" lon="120.002"><time>2024-01-01T00:02:00Z</time></trkpt>
          </trkseg></trk>
        </gpx>`;

        const points = gallery.parseGpx(xml);
        expect(points[1].dist).toBeGreaterThan(points[0].dist);
        expect(points[2].dist).toBeGreaterThan(points[1].dist);
    });
});

describe('createPhotoGrid', () => {
    test('creates grid with photos', () => {
        const photos = [
            { url: 'images/test/a.jpg', name: 'a.jpg' },
            { url: 'images/test/b.jpg', name: 'b.jpg' },
        ];
        const grid = gallery.createPhotoGrid(photos, 'test');
        expect(grid.className).toBe('photo-grid');
        expect(grid.children).toHaveLength(2);
        expect(grid.querySelector('img')).not.toBeNull();
    });

    test('creates grid with video including poster', () => {
        const photos = [
            { url: 'images/test/v.mp4', name: 'v.mp4', poster: 'images/test/cover.jpg' },
        ];
        const grid = gallery.createPhotoGrid(photos, 'test');
        const video = grid.querySelector('video');
        expect(video).not.toBeNull();
        expect(video.poster).toContain('cover.jpg');
        expect(grid.querySelector('.video-item')).not.toBeNull();
    });
});

describe('lightbox', () => {
    test('opens and closes lightbox for image', () => {
        gallery.openLightbox('test.jpg');
        expect(gallery.lightbox.classList.contains('active')).toBe(true);
        expect(gallery.lightbox.querySelector('img')).not.toBeNull();

        gallery.closeLightbox();
        expect(gallery.lightbox.classList.contains('active')).toBe(false);
    });

    test('opens lightbox for video', () => {
        gallery.openLightbox('test.mp4');
        expect(gallery.lightbox.querySelector('video')).not.toBeNull();
    });
});

describe('createRaceCard', () => {
    test('creates race card with correct info', () => {
        const race = {
            name: 'Test Race',
            date: '2024-01-01',
            sources: [
                { name: 'src1', photos: [{ url: 'a.jpg' }, { url: 'b.mp4' }] },
            ],
        };
        const card = gallery.createRaceCard(race);
        expect(card.tagName).toBe('A');
        expect(card.href).toContain('Test%20Race');
        expect(card.textContent).toContain('Test Race');
        expect(card.textContent).toContain('1 photo, 1 video');
    });
});

describe('renderOverview', () => {
    test('shows empty state when no races', () => {
        gallery.manifest = { races: [] };
        gallery.renderOverview();
        expect(document.querySelector('.no-races')).not.toBeNull();
    });

    test('shows stats and race cards', () => {
        gallery.manifest = {
            races: [{
                name: 'Race 1',
                date: '2024-01-01',
                country: 'China',
                province: 'Guangdong',
                city: 'Guangzhou',
                sources: [{ name: 'src', photos: [{ url: 'a.jpg' }] }],
            }],
        };
        gallery.renderOverview();
        expect(document.querySelector('.stats-bar')).not.toBeNull();
        expect(document.querySelector('.race-card')).not.toBeNull();
    });
});
