/**
 * @jest-environment jsdom
 */

// Mock Leaflet
const mockMarker = {
    bindPopup: jest.fn().mockReturnThis(),
    addTo: jest.fn().mockReturnThis(),
    _photoCount: 0,
};
const mockPolyline = {
    addTo: jest.fn().mockReturnThis(),
    getBounds: jest.fn().mockReturnValue([[0, 0], [1, 1]]),
};
const mockLayerGroup = { addTo: jest.fn().mockReturnThis() };
const mockClusterGroup = {
    addLayer: jest.fn(),
};
const mockMap = {
    addLayer: jest.fn(),
    fitBounds: jest.fn(),
    invalidateSize: jest.fn(),
};
const mockControl = { addTo: jest.fn(), onAdd: null };

const mockControlFn = jest.fn().mockReturnValue(mockControl);
mockControlFn.layers = jest.fn().mockReturnValue(mockControl);

global.L = {
    map: jest.fn().mockReturnValue(mockMap),
    tileLayer: jest.fn().mockReturnValue({ addTo: jest.fn() }),
    marker: jest.fn().mockReturnValue(mockMarker),
    polyline: jest.fn().mockReturnValue(mockPolyline),
    layerGroup: jest.fn().mockReturnValue(mockLayerGroup),
    latLngBounds: jest.fn().mockReturnValue({ extend: jest.fn() }),
    circle: jest.fn().mockReturnValue({ addTo: jest.fn() }),
    geoJSON: jest.fn().mockReturnValue({ addTo: jest.fn() }),
    divIcon: jest.fn().mockReturnValue({}),
    markerClusterGroup: jest.fn().mockReturnValue(mockClusterGroup),
    control: mockControlFn,
    DomUtil: { create: jest.fn().mockReturnValue(document.createElement('div')) },
};

// Stub HTMLMediaElement methods not implemented in jsdom
window.HTMLMediaElement.prototype.pause = jest.fn();
window.HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined);

const { RacePhotosGallery } = require('../docs/app');

let gallery;

beforeEach(() => {
    document.body.innerHTML = '<div id="races-container"></div>';
    window.location.hash = '';
    jest.clearAllMocks();
    gallery = new RacePhotosGallery();
    gallery.manifest = { races: [] };
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

    test('returns null pace when no distance', () => {
        const pts = [
            { lat: 0, lon: 0, time: 0, dist: 0 },
            { lat: 0, lon: 0, time: 1000, dist: 0 },
        ];
        const metrics = gallery.getMetricsAtTime(pts, 1000);
        expect(metrics.pace).toBeNull();
    });

    test('returns null hr when no hr data', () => {
        const pts = [
            { lat: 0, lon: 0, time: 0, dist: 0 },
            { lat: 0, lon: 0, time: 1000, dist: 100 },
        ];
        const metrics = gallery.getMetricsAtTime(pts, 0);
        expect(metrics.hr).toBeNull();
    });

    test('caps pace at 15 min/km', () => {
        const pts = [
            { lat: 0, lon: 0, time: 0, dist: 0, hr: 100 },
            { lat: 0, lon: 0, time: 60000, dist: 1, hr: 100 },
        ];
        const metrics = gallery.getMetricsAtTime(pts, 60000);
        expect(metrics.pace).toBeNull();
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

    test('omits ele/hr when not present', () => {
        const xml = `<?xml version="1.0"?>
        <gpx><trk><trkseg>
            <trkpt lat="30.0" lon="120.0"><time>2024-01-01T00:00:00Z</time></trkpt>
        </trkseg></trk></gpx>`;
        const points = gallery.parseGpx(xml);
        expect(points[0].ele).toBeUndefined();
        expect(points[0].hr).toBeUndefined();
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

    test('video without poster has no poster attribute', () => {
        const photos = [{ url: 'test.mp4', name: 'test.mp4' }];
        const grid = gallery.createPhotoGrid(photos, 'test');
        const video = grid.querySelector('video');
        expect(video.poster).toBe('');
    });

    test('photo click triggers lightbox', () => {
        const photos = [{ url: 'test.jpg', name: 'test.jpg' }];
        const grid = gallery.createPhotoGrid(photos, 'test');
        const item = grid.querySelector('.photo-item');
        item.click();
        expect(gallery.lightbox.classList.contains('active')).toBe(true);
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

    test('close button closes lightbox', () => {
        gallery.openLightbox('test.jpg');
        gallery.lightbox.querySelector('.lightbox-close').click();
        expect(gallery.lightbox.classList.contains('active')).toBe(false);
    });

    test('clicking lightbox backdrop closes it', () => {
        gallery.openLightbox('test.jpg');
        gallery.lightbox.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(gallery.lightbox.classList.contains('active')).toBe(false);
    });

    test('clicking lightbox content does not close it', () => {
        gallery.openLightbox('test.jpg');
        const content = gallery.lightbox.querySelector('.lightbox-content');
        content.dispatchEvent(new MouseEvent('click', { bubbles: false }));
        expect(gallery.lightbox.classList.contains('active')).toBe(true);
    });

    test('Escape key closes lightbox', () => {
        gallery.openLightbox('test.jpg');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(gallery.lightbox.classList.contains('active')).toBe(false);
    });

    test('Escape key does nothing when lightbox is not active', () => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        expect(gallery.lightbox.classList.contains('active')).toBe(false);
    });

    test('other keys do not close lightbox', () => {
        gallery.openLightbox('test.jpg');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(gallery.lightbox.classList.contains('active')).toBe(true);
    });
});

describe('createSourceSection', () => {
    test('creates section with header and grid', () => {
        const photos = [{ url: 'a.jpg', name: 'a.jpg' }, { url: 'b.jpg', name: 'b.jpg' }];
        const section = gallery.createSourceSection('TestSource', photos);
        expect(section.className).toBe('source-section');
        expect(section.querySelector('h3').textContent).toBe('TestSource');
        expect(section.querySelector('.photo-count').textContent).toBe('2 photos');
        expect(section.querySelector('.photo-grid')).not.toBeNull();
    });

    test('shows mixed media count', () => {
        const photos = [{ url: 'a.jpg', name: 'a.jpg' }, { url: 'v.mp4', name: 'v.mp4' }];
        const section = gallery.createSourceSection('Mix', photos);
        expect(section.querySelector('.photo-count').textContent).toBe('1 photo, 1 video');
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

    test('handles race without date', () => {
        const race = {
            name: 'No Date Race',
            sources: [{ name: 'src', photos: [{ url: 'a.jpg' }] }],
        };
        const card = gallery.createRaceCard(race);
        expect(card.textContent).toContain('No Date Race');
        expect(card.textContent).not.toContain('2024');
    });

    test('handles multiple sources', () => {
        const race = {
            name: 'Multi',
            date: '2024-01-01',
            sources: [
                { name: 's1', photos: [{ url: 'a.jpg' }] },
                { name: 's2', photos: [{ url: 'b.jpg' }] },
            ],
        };
        const card = gallery.createRaceCard(race);
        expect(card.textContent).toContain('2 sources');
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

    test('stats include video count when videos exist', () => {
        gallery.manifest = {
            races: [{
                name: 'R',
                country: 'China',
                province: 'P',
                city: 'C',
                sources: [{ name: 's', photos: [{ url: 'a.jpg' }, { url: 'v.mp4' }] }],
            }],
        };
        gallery.renderOverview();
        const stats = document.querySelector('.stats-bar');
        expect(stats.textContent).toContain('Videos');
    });

    test('stats omit video count when no videos', () => {
        gallery.manifest = {
            races: [{
                name: 'R',
                country: 'China',
                province: 'P',
                city: 'C',
                sources: [{ name: 's', photos: [{ url: 'a.jpg' }] }],
            }],
        };
        gallery.renderOverview();
        const stats = document.querySelector('.stats-bar');
        expect(stats.textContent).not.toContain('Videos');
    });

    test('renders multiple race cards', () => {
        gallery.manifest = {
            races: [
                { name: 'R1', sources: [{ name: 's', photos: [{ url: 'a.jpg' }] }] },
                { name: 'R2', sources: [{ name: 's', photos: [{ url: 'b.jpg' }] }] },
            ],
        };
        gallery.renderOverview();
        expect(document.querySelectorAll('.race-card')).toHaveLength(2);
    });

    test('shows links bar with race results and certificates', () => {
        gallery.manifest = {
            races: [{ name: 'R', sources: [{ name: 's', photos: [{ url: 'a.jpg' }] }] }],
        };
        gallery.renderOverview();
        const linksBar = document.querySelector('.links-bar');
        expect(linksBar).not.toBeNull();
        const links = linksBar.querySelectorAll('a');
        expect(links).toHaveLength(2);
        expect(links[0].href).toContain('running_race');
        expect(links[0].textContent).toContain('Race Results');
        expect(links[1].href).toContain('running_cert');
        expect(links[1].textContent).toContain('Race Certificates');
        expect(links[0].target).toBe('_blank');
        expect(links[1].target).toBe('_blank');
    });

    test('creates map when races have locations', () => {
        jest.useFakeTimers();
        gallery.manifest = {
            races: [{
                name: 'MapRace',
                date: '2024-01-01',
                city: 'TestCity',
                sources: [{
                    name: 's',
                    photos: [{ url: 'a.jpg', lat: 30, lon: 120 }],
                }],
            }],
        };
        gallery.renderOverview();
        expect(document.querySelector('#races-map')).not.toBeNull();
        jest.advanceTimersByTime(200);
        expect(L.map).toHaveBeenCalledWith('races-map');
        expect(L.markerClusterGroup).toHaveBeenCalled();
        jest.useRealTimers();
    });

    test('map uses race lat/lon when available', () => {
        jest.useFakeTimers();
        gallery.manifest = {
            races: [{
                name: 'R',
                lat: 25,
                lon: 110,
                sources: [{ name: 's', photos: [{ url: 'a.jpg' }] }],
            }],
        };
        gallery.renderOverview();
        jest.advanceTimersByTime(200);
        expect(L.marker).toHaveBeenCalled();
        jest.useRealTimers();
    });

    test('map uses city coords fallback', () => {
        jest.useFakeTimers();
        gallery.manifest = {
            races: [
                {
                    name: 'R1',
                    city: 'SharedCity',
                    sources: [{ name: 's', photos: [{ url: 'a.jpg', lat: 30, lon: 120 }] }],
                },
                {
                    name: 'R2',
                    city: 'SharedCity',
                    sources: [{ name: 's', photos: [{ url: 'b.jpg' }] }],
                },
            ],
        };
        gallery.renderOverview();
        jest.advanceTimersByTime(200);
        expect(L.marker).toHaveBeenCalledTimes(2);
        jest.useRealTimers();
    });

    test('skips races without any location info', () => {
        jest.useFakeTimers();
        gallery.manifest = {
            races: [
                {
                    name: 'WithLoc',
                    sources: [{ name: 's', photos: [{ url: 'a.jpg', lat: 30, lon: 120 }] }],
                },
                {
                    name: 'NoLoc',
                    sources: [{ name: 's', photos: [{ url: 'b.jpg' }] }],
                },
            ],
        };
        gallery.renderOverview();
        jest.advanceTimersByTime(200);
        expect(L.marker).toHaveBeenCalledTimes(1);
        jest.useRealTimers();
    });

    test('race without date omits date in popup', () => {
        jest.useFakeTimers();
        gallery.manifest = {
            races: [{
                name: 'NoDate',
                sources: [{ name: 's', photos: [{ url: 'a.jpg', lat: 30, lon: 120 }] }],
            }],
        };
        gallery.renderOverview();
        jest.advanceTimersByTime(200);
        const popupCall = mockMarker.bindPopup.mock.calls[0][0];
        expect(popupCall).not.toContain('<small>');
        jest.useRealTimers();
    });
});

describe('scanDirectory', () => {
    test('returns manifest on successful fetch', async () => {
        const mockManifest = { races: [{ name: 'Test' }] };
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockManifest),
        });
        const result = await gallery.scanDirectory();
        expect(result).toEqual(mockManifest);
    });

    test('returns empty races on fetch failure', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
        const result = await gallery.scanDirectory();
        expect(result).toEqual({ races: [] });
    });

    test('returns empty races on non-ok response', async () => {
        global.fetch = jest.fn().mockResolvedValue({ ok: false });
        const result = await gallery.scanDirectory();
        expect(result).toEqual({ races: [] });
    });
});

describe('handleRoute', () => {
    test('renders overview when no hash', () => {
        gallery.manifest = { races: [] };
        window.location.hash = '';
        gallery.handleRoute();
        expect(document.querySelector('.no-races')).not.toBeNull();
    });

    test('renders overview when hash does not match any race', () => {
        gallery.manifest = {
            races: [{
                name: 'Existing Race',
                sources: [{ name: 's', photos: [{ url: 'a.jpg' }] }],
            }],
        };
        window.location.hash = '#NonExistent';
        gallery.handleRoute();
        expect(document.querySelector('.stats-bar')).not.toBeNull();
    });

    test('renders race detail when hash matches', async () => {
        const race = {
            name: 'My Race',
            sources: [{ name: 's', photos: [{ url: 'a.jpg', name: 'a' }] }],
        };
        gallery.manifest = { races: [race] };
        window.location.hash = '#My Race';
        gallery.handleRoute();
        // renderRaceDetail is async, wait
        await new Promise(r => setTimeout(r, 0));
        expect(document.querySelector('.back-link')).not.toBeNull();
        expect(document.querySelector('h2').textContent).toBe('My Race');
    });
});

describe('renderRaceDetail', () => {
    beforeEach(() => { localStorage.clear(); });
    test('renders race detail without route (fallback by source)', async () => {
        const race = {
            name: 'Test Race',
            date: '2024-01-01',
            sources: [
                { name: 'src1', photos: [{ url: 'a.jpg', name: 'a.jpg' }] },
                { name: 'src2', photos: [{ url: 'b.jpg', name: 'b.jpg' }] },
            ],
        };
        await gallery.renderRaceDetail(race);
        expect(document.querySelector('.back-link')).not.toBeNull();
        expect(document.querySelector('.race-header h2').textContent).toBe('Test Race');
        expect(document.querySelectorAll('.source-section')).toHaveLength(2);
    });

    test('shows Strava link when strava_url is present', async () => {
        const race = {
            name: 'Strava Race',
            strava_url: 'https://www.strava.com/activities/12345',
            sources: [{ name: 'src', photos: [{ url: 'a.jpg', name: 'a.jpg' }] }],
        };
        await gallery.renderRaceDetail(race);
        const stravaLink = document.querySelector('.strava-link');
        expect(stravaLink).not.toBeNull();
        expect(stravaLink.href).toBe('https://www.strava.com/activities/12345');
        expect(stravaLink.target).toBe('_blank');
        expect(stravaLink.textContent).toContain('Strava');
    });

    test('does not show Strava link when strava_url is absent', async () => {
        const race = {
            name: 'No Strava',
            sources: [{ name: 'src', photos: [{ url: 'a.jpg', name: 'a.jpg' }] }],
        };
        await gallery.renderRaceDetail(race);
        expect(document.querySelector('.strava-link')).toBeNull();
        expect(document.querySelector('.gpx-download')).toBeNull();
    });

    test('shows GPX download link when strava_url is present', async () => {
        const race = {
            name: 'GPX Race',
            strava_url: 'https://www.strava.com/activities/12345',
            sources: [{ name: 'src', photos: [{ url: 'a.jpg', name: 'a.jpg' }] }],
        };
        await gallery.renderRaceDetail(race);
        const gpxLink = document.querySelector('.gpx-download');
        expect(gpxLink).not.toBeNull();
        expect(gpxLink.href).toBe('https://www.strava.com/activities/12345/export_gpx');
        expect(gpxLink.textContent).toContain('Download GPX');
    });

    test('GPX download prefers local route over strava export', async () => {
        const race = {
            name: 'Local GPX',
            route: 'routes/test.gpx',
            strava_url: 'https://www.strava.com/activities/12345',
            sources: [{ name: 'src', photos: [{ url: 'a.jpg', name: 'a.jpg' }] }],
        };
        await gallery.renderRaceDetail(race);
        const gpxLink = document.querySelector('.gpx-download');
        expect(gpxLink.getAttribute('href')).toBe('routes/test.gpx');
        expect(gpxLink.download).toBeDefined();
    });

    test('renders race detail with timestamps grouped by time', async () => {
        const race = {
            name: 'Timed Race',
            date: '2024-01-01',
            sources: [{
                name: 'src',
                photos: [
                    { url: 'a.jpg', name: 'a.jpg', timestamp: '2024-01-01 08:00:00' },
                    { url: 'b.jpg', name: 'b.jpg', timestamp: '2024-01-01 08:00:05' },
                    { url: 'c.jpg', name: 'c.jpg', timestamp: '2024-01-01 09:00:00' },
                ],
            }],
        };
        await gallery.renderRaceDetail(race);
        // Two time groups: 08:00:xx and 09:00:00
        const sections = document.querySelectorAll('.source-section');
        expect(sections.length).toBe(2);
    });

    test('renders "Other" section for photos without timestamps', async () => {
        const race = {
            name: 'Mixed Race',
            sources: [{
                name: 'src',
                photos: [
                    { url: 'a.jpg', name: 'a.jpg', timestamp: '2024-01-01 08:00:00' },
                    { url: 'b.jpg', name: 'b.jpg' },
                ],
            }],
        };
        await gallery.renderRaceDetail(race);
        const sections = document.querySelectorAll('.source-section');
        const lastSection = sections[sections.length - 1];
        expect(lastSection.querySelector('h3').textContent).toBe('Other');
    });

    test('renders race detail without date', async () => {
        const race = {
            name: 'No Date',
            sources: [{ name: 'src', photos: [{ url: 'a.jpg', name: 'a.jpg' }] }],
        };
        await gallery.renderRaceDetail(race);
        const info = document.querySelector('.race-info');
        expect(info.textContent).toBe('1 photo');
    });

    test('renders back link with correct href', async () => {
        const race = {
            name: 'R',
            sources: [{ name: 's', photos: [{ url: 'a.jpg', name: 'a' }] }],
        };
        await gallery.renderRaceDetail(race);
        expect(document.querySelector('.back-link').href).toContain('#');
    });

    test('renders race detail with GPX route', async () => {
        jest.useFakeTimers();
        const gpxXml = `<?xml version="1.0"?>
        <gpx><trk><trkseg>
            <trkpt lat="30.0" lon="120.0"><ele>10</ele><time>2024-01-01T00:00:00Z</time></trkpt>
            <trkpt lat="30.01" lon="120.01"><ele>15</ele><time>2024-01-01T00:05:00Z</time></trkpt>
            <trkpt lat="30.02" lon="120.02"><ele>20</ele><time>2024-01-01T00:10:00Z</time></trkpt>
        </trkseg></trk></gpx>`;

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            text: () => Promise.resolve(gpxXml),
        });
        global.Chart = jest.fn();

        const race = {
            name: 'GPX Race',
            date: '2024-01-01',
            route: 'routes/test.gpx',
            sources: [{
                name: 'src',
                photos: [
                    { url: 'a.jpg', name: 'a.jpg', timestamp: '2024-01-01 08:02:00' },
                    { url: 'b.jpg', name: 'b.jpg', timestamp: '2024-01-01 08:08:00' },
                    { url: 'c.jpg', name: 'c.jpg' },
                ],
            }],
        };
        await gallery.renderRaceDetail(race);
        jest.advanceTimersByTime(200);

        expect(document.querySelector('#race-detail-map')).not.toBeNull();
        expect(L.map).toHaveBeenCalledWith('race-detail-map');
        expect(L.polyline).toHaveBeenCalled();

        delete global.Chart;
        jest.useRealTimers();
    });

    test('handles GPX fetch failure gracefully', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

        const race = {
            name: 'Fail Route',
            route: 'routes/fail.gpx',
            sources: [{ name: 's', photos: [{ url: 'a.jpg', name: 'a' }] }],
        };
        await gallery.renderRaceDetail(race);
        // Should not crash, card still rendered
        expect(document.querySelector('.race-card')).not.toBeNull();
    });

    test('fetches GPX from strava_url/export_gpx when no local route', async () => {
        jest.useFakeTimers();
        const gpxXml = `<?xml version="1.0"?>
        <gpx><trk><trkseg>
            <trkpt lat="30.0" lon="120.0"><ele>10</ele><time>2024-01-01T00:00:00Z</time></trkpt>
            <trkpt lat="30.01" lon="120.01"><ele>15</ele><time>2024-01-01T00:05:00Z</time></trkpt>
        </trkseg></trk></gpx>`;
        localStorage.clear();
        global.fetch = jest.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(gpxXml) });
        global.Chart = jest.fn();

        const race = {
            name: 'Strava GPX',
            strava_url: 'https://www.strava.com/activities/12345',
            sources: [{ name: 'src', photos: [{ url: 'a.jpg', name: 'a.jpg' }] }],
        };
        await gallery.renderRaceDetail(race);
        jest.advanceTimersByTime(200);
        const fetchUrl = global.fetch.mock.calls[0][0];
        expect(fetchUrl).toMatch(/^https:\/\/www\.strava\.com\/activities\/12345\/export_gpx/);
        jest.useRealTimers();
    });

    test('prefers local route over strava_url', async () => {
        jest.useFakeTimers();
        const gpxXml = `<?xml version="1.0"?>
        <gpx><trk><trkseg>
            <trkpt lat="30.0" lon="120.0"><ele>10</ele><time>2024-01-01T00:00:00Z</time></trkpt>
            <trkpt lat="30.01" lon="120.01"><ele>15</ele><time>2024-01-01T00:05:00Z</time></trkpt>
        </trkseg></trk></gpx>`;
        localStorage.clear();
        global.fetch = jest.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(gpxXml) });
        global.Chart = jest.fn();

        const race = {
            name: 'Both',
            route: 'routes/local.gpx',
            strava_url: 'https://www.strava.com/activities/12345',
            sources: [{ name: 'src', photos: [{ url: 'a.jpg', name: 'a.jpg' }] }],
        };
        await gallery.renderRaceDetail(race);
        jest.advanceTimersByTime(200);
        const fetchUrl = global.fetch.mock.calls[0][0];
        expect(fetchUrl).toMatch(/^routes\/local\.gpx/);
        jest.useRealTimers();
    });

    test('falls back to race.route when strava_url is absent', async () => {
        jest.useFakeTimers();
        localStorage.clear();
        const gpxXml = `<?xml version="1.0"?>
        <gpx><trk><trkseg>
            <trkpt lat="30.0" lon="120.0"><ele>10</ele><time>2024-01-01T00:00:00Z</time></trkpt>
            <trkpt lat="30.01" lon="120.01"><ele>15</ele><time>2024-01-01T00:05:00Z</time></trkpt>
        </trkseg></trk></gpx>`;
        global.fetch = jest.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(gpxXml) });
        global.Chart = jest.fn();

        const race = {
            name: 'Local GPX',
            route: 'routes/local.gpx',
            sources: [{ name: 'src', photos: [{ url: 'a.jpg', name: 'a.jpg' }] }],
        };
        await gallery.renderRaceDetail(race);
        jest.advanceTimersByTime(200);
        const fetchUrl = global.fetch.mock.calls[0][0];
        expect(fetchUrl).toMatch(/^routes\/local\.gpx/);
        jest.useRealTimers();
    });

    test('uses cached GPX from localStorage on second load', async () => {
        jest.useFakeTimers();
        const gpxXml = `<?xml version="1.0"?>
        <gpx><trk><trkseg>
            <trkpt lat="30.0" lon="120.0"><ele>10</ele><time>2024-01-01T00:00:00Z</time></trkpt>
            <trkpt lat="30.01" lon="120.01"><ele>15</ele><time>2024-01-01T00:05:00Z</time></trkpt>
        </trkseg></trk></gpx>`;
        const cacheKey = 'gpx_https://www.strava.com/activities/12345/export_gpx';
        localStorage.setItem(cacheKey, gpxXml);
        global.fetch = jest.fn();
        global.Chart = jest.fn();

        const race = {
            name: 'Cached GPX',
            strava_url: 'https://www.strava.com/activities/12345',
            sources: [{ name: 'src', photos: [{ url: 'a.jpg', name: 'a.jpg' }] }],
        };
        await gallery.renderRaceDetail(race);
        jest.advanceTimersByTime(200);
        expect(global.fetch).not.toHaveBeenCalled();
        expect(document.querySelector('#race-detail-map')).not.toBeNull();
        localStorage.removeItem(cacheKey);
        jest.useRealTimers();
    });

    test('groups out-of-range photos separately', async () => {
        jest.useFakeTimers();
        const gpxXml = `<?xml version="1.0"?>
        <gpx><trk><trkseg>
            <trkpt lat="30.0" lon="120.0"><ele>10</ele><time>2024-01-01T00:00:00Z</time></trkpt>
            <trkpt lat="30.01" lon="120.01"><ele>15</ele><time>2024-01-01T00:05:00Z</time></trkpt>
        </trkseg></trk></gpx>`;

        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            text: () => Promise.resolve(gpxXml),
        });
        global.Chart = jest.fn();

        const race = {
            name: 'OOR Race',
            route: 'routes/test.gpx',
            sources: [{
                name: 'src',
                photos: [
                    { url: 'a.jpg', name: 'a.jpg', timestamp: '2024-01-01 08:02:00' },
                    { url: 'b.jpg', name: 'b.jpg', timestamp: '2024-01-01 12:00:00' },
                ],
            }],
        };
        await gallery.renderRaceDetail(race);
        jest.advanceTimersByTime(200);

        // Photo b should be out of range
        expect(L.markerClusterGroup).toHaveBeenCalled();

        delete global.Chart;
        jest.useRealTimers();
    });
});

describe('renderGpxChart', () => {
    test('returns early when Chart is undefined', () => {
        delete global.Chart;
        const container = document.createElement('div');
        const trackpoints = [
            { lat: 0, lon: 0, time: 0, dist: 0, ele: 10 },
            { lat: 1, lon: 1, time: 60000, dist: 1000, ele: 20 },
        ];
        gallery.renderGpxChart(trackpoints, container);
        expect(container.querySelector('.gpx-chart-container')).toBeNull();
    });

    test('returns early when less than 2 trackpoints', () => {
        global.Chart = jest.fn();
        const container = document.createElement('div');
        gallery.renderGpxChart([{ lat: 0, lon: 0, time: 0, dist: 0 }], container);
        expect(container.querySelector('.gpx-chart-container')).toBeNull();
        delete global.Chart;
    });

    test('creates chart with elevation and pace', () => {
        global.Chart = jest.fn();
        const container = document.createElement('div');
        const trackpoints = [
            { lat: 0, lon: 0, time: 0, dist: 0, ele: 10 },
            { lat: 0.01, lon: 0, time: 60000, dist: 1000, ele: 20 },
            { lat: 0.02, lon: 0, time: 120000, dist: 2000, ele: 15 },
        ];
        gallery.renderGpxChart(trackpoints, container);
        expect(container.querySelector('.gpx-chart-container')).not.toBeNull();
        expect(container.querySelector('canvas')).not.toBeNull();
        expect(Chart).toHaveBeenCalledTimes(1);
        const chartCall = Chart.mock.calls[0];
        expect(chartCall[1].type).toBe('line');
        expect(chartCall[1].data.datasets.length).toBe(2); // elevation + pace
        delete global.Chart;
    });

    test('includes heart rate dataset when available', () => {
        global.Chart = jest.fn();
        const container = document.createElement('div');
        const trackpoints = [
            { lat: 0, lon: 0, time: 0, dist: 0, ele: 10, hr: 120 },
            { lat: 0.01, lon: 0, time: 60000, dist: 1000, ele: 20, hr: 140 },
            { lat: 0.02, lon: 0, time: 120000, dist: 2000, ele: 15, hr: 150 },
        ];
        gallery.renderGpxChart(trackpoints, container);
        const chartCall = Chart.mock.calls[0];
        expect(chartCall[1].data.datasets.length).toBe(3); // elevation + pace + hr
        expect(chartCall[1].options.scales.yHr).toBeDefined();
        delete global.Chart;
    });

    test('tooltip callbacks format correctly', () => {
        global.Chart = jest.fn();
        const container = document.createElement('div');
        const trackpoints = [
            { lat: 0, lon: 0, time: 0, dist: 0, ele: 10, hr: 120 },
            { lat: 0.01, lon: 0, time: 60000, dist: 1000, ele: 20, hr: 140 },
        ];
        gallery.renderGpxChart(trackpoints, container);
        const tooltipLabel = Chart.mock.calls[0][1].options.plugins.tooltip.callbacks.label;

        expect(tooltipLabel({ parsed: { y: null }, dataset: { yAxisID: 'yEle' } })).toBe('');
        expect(tooltipLabel({ parsed: { y: 100 }, dataset: { yAxisID: 'yEle' } })).toBe('Elevation: 100 m');
        expect(tooltipLabel({ parsed: { y: 5.5 }, dataset: { yAxisID: 'yPace' } })).toContain("5'30\"");
        expect(tooltipLabel({ parsed: { y: 145 }, dataset: { yAxisID: 'yHr' } })).toBe('HR: 145 bpm');
        delete global.Chart;
    });

    test('legend onClick toggles dataset visibility', () => {
        global.Chart = jest.fn();
        const container = document.createElement('div');
        const trackpoints = [
            { lat: 0, lon: 0, time: 0, dist: 0, ele: 10 },
            { lat: 0.01, lon: 0, time: 60000, dist: 1000, ele: 20 },
        ];
        gallery.renderGpxChart(trackpoints, container);
        const legendOnClick = Chart.mock.calls[0][1].options.plugins.legend.onClick;

        const mockMeta = { hidden: false };
        const mockLegend = {
            chart: {
                getDatasetMeta: jest.fn().mockReturnValue(mockMeta),
                update: jest.fn(),
            },
        };
        legendOnClick(null, { datasetIndex: 0 }, mockLegend);
        expect(mockMeta.hidden).toBe(true);
        expect(mockLegend.chart.update).toHaveBeenCalled();

        legendOnClick(null, { datasetIndex: 0 }, mockLegend);
        expect(mockMeta.hidden).toBe(false);
        delete global.Chart;
    });

    test('handles trackpoints without elevation', () => {
        global.Chart = jest.fn();
        const container = document.createElement('div');
        const trackpoints = [
            { lat: 0, lon: 0, time: 0, dist: 0 },
            { lat: 0.01, lon: 0, time: 60000, dist: 1000 },
        ];
        gallery.renderGpxChart(trackpoints, container);
        const chartData = Chart.mock.calls[0][1].data;
        expect(chartData.datasets[0].data).toEqual([null, null]);
        delete global.Chart;
    });

    test('caps pace at 15 min/km', () => {
        global.Chart = jest.fn();
        const container = document.createElement('div');
        // Very slow: 60 min for 1m distance = 60000 min/km
        const trackpoints = [
            { lat: 0, lon: 0, time: 0, dist: 0, ele: 10 },
            { lat: 0, lon: 0, time: 3600000, dist: 1, ele: 10 },
        ];
        gallery.renderGpxChart(trackpoints, container);
        const paceData = Chart.mock.calls[0][1].data.datasets[1].data;
        expect(paceData[1]).toBeNull();
        delete global.Chart;
    });
});

describe('render', () => {
    test('calls scanDirectory and handleRoute', async () => {
        const mockManifest = { races: [] };
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockManifest),
        });
        await gallery.render();
        expect(gallery.manifest).toEqual(mockManifest);
        expect(document.querySelector('.no-races')).not.toBeNull();
    });
});
