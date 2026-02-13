/**
 * Race Photos Gallery Application
 * Dynamically loads and displays photos organized by races and sources
 */

class RacePhotosGallery {
    constructor() {
        this.racesContainer = document.getElementById('races-container');
        this.manifest = null;
        this.lightbox = null;
        this.initLightbox();
        window.addEventListener('hashchange', () => this.handleRoute());
    }

    /**
     * Initialize the lightbox for viewing full-size images
     */
    initLightbox() {
        this.lightbox = document.createElement('div');
        this.lightbox.className = 'lightbox';
        this.lightbox.innerHTML = `
            <span class="lightbox-close">&times;</span>
            <div class="lightbox-content">
                <img src="" alt="Full size photo">
            </div>
        `;
        document.body.appendChild(this.lightbox);

        // Close lightbox on click
        this.lightbox.querySelector('.lightbox-close').addEventListener('click', () => {
            this.closeLightbox();
        });

        this.lightbox.addEventListener('click', (e) => {
            if (e.target === this.lightbox) {
                this.closeLightbox();
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.lightbox.classList.contains('active')) {
                this.closeLightbox();
            }
        });
    }

    /**
     * Open lightbox with specified image
     */
    openLightbox(imageSrc) {
        const img = this.lightbox.querySelector('img');
        img.src = imageSrc;
        this.lightbox.classList.add('active');
    }

    /**
     * Close the lightbox
     */
    closeLightbox() {
        this.lightbox.classList.remove('active');
    }

    /**
     * Scan the images directory to find all races and sources
     */
    async scanDirectory() {
        try {
            const response = await fetch('images/manifest.json?t=' + Date.now());
            if (response.ok) {
                const manifest = await response.json();
                return manifest;
            }
        } catch (error) {
            console.log('No manifest found, will show empty state');
        }

        // Return empty structure if no manifest
        return { races: [] };
    }

    /**
     * Handle hash-based routing
     */
    handleRoute() {
        const hash = decodeURIComponent(window.location.hash.slice(1));
        if (hash) {
            const race = this.manifest.races.find(r => r.name === hash);
            if (race) {
                this.renderRaceDetail(race);
                return;
            }
        }
        this.renderOverview();
    }

    /**
     * Create a photo grid for a source
     */
    createPhotoGrid(photos, source) {
        const grid = document.createElement('div');
        grid.className = 'photo-grid';

        photos.forEach((photo) => {
            const photoItem = document.createElement('div');
            photoItem.className = 'photo-item';

            const img = document.createElement('img');
            img.src = photo.url;
            img.alt = photo.name;
            img.loading = 'lazy';

            photoItem.appendChild(img);

            // Add click handler for lightbox
            photoItem.addEventListener('click', () => {
                this.openLightbox(photo.url);
            });

            grid.appendChild(photoItem);
        });

        return grid;
    }

    /**
     * Create a source section with photos
     */
    createSourceSection(source, photos) {
        const section = document.createElement('div');
        section.className = 'source-section';

        const header = document.createElement('div');
        header.className = 'source-header';

        const title = document.createElement('h3');
        title.textContent = source;

        const count = document.createElement('span');
        count.className = 'photo-count';
        count.textContent = `${photos.length} photo${photos.length !== 1 ? 's' : ''}`;

        header.appendChild(title);
        header.appendChild(count);

        section.appendChild(header);
        section.appendChild(this.createPhotoGrid(photos, source));

        return section;
    }

    /**
     * Create a race card for the overview (no photos)
     */
    createRaceCard(race) {
        const card = document.createElement('a');
        card.className = 'race-card';
        card.href = '#' + encodeURIComponent(race.name);

        // Race header
        const raceHeader = document.createElement('div');
        raceHeader.className = 'race-header';

        const title = document.createElement('h2');
        title.textContent = race.name;

        const info = document.createElement('div');
        info.className = 'race-info';
        const totalPhotos = race.sources.reduce((sum, src) => sum + src.photos.length, 0);
        const dateStr = race.date ? `${race.date} • ` : '';
        info.textContent = `${dateStr}${race.sources.length} source${race.sources.length !== 1 ? 's' : ''} • ${totalPhotos} photo${totalPhotos !== 1 ? 's' : ''}`;

        raceHeader.appendChild(title);
        raceHeader.appendChild(info);
        card.appendChild(raceHeader);

        return card;
    }

    /**
     * Render the overview page with stats, race cards and map
     */
    renderOverview() {
        this.racesContainer.innerHTML = '';

        if (!this.manifest.races || this.manifest.races.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'no-races';
            emptyState.innerHTML = `
                <h2>No races yet</h2>
                <p>Photos will appear here once you start adding them.</p>
                <p style="margin-top: 1rem; color: #999;">
                    Use the <code>scripts/download_photos.py</code> script to download photos.
                </p>
            `;
            this.racesContainer.appendChild(emptyState);
            return;
        }

        // Compute stats
        const races = this.manifest.races;
        const totalRaces = races.length;
        const totalPhotos = races.reduce((sum, r) => sum + r.sources.reduce((s, src) => s + src.photos.length, 0), 0);
        const countries = new Set(races.map(r => r.country).filter(Boolean));
        const provinces = new Set(races.map(r => r.province).filter(Boolean));
        const cities = new Set(races.map(r => r.city).filter(Boolean));

        const statsBar = document.createElement('div');
        statsBar.className = 'stats-bar';
        statsBar.innerHTML = `
            <div class="stat-item"><span class="stat-value">${totalRaces}</span><span class="stat-label">Races</span></div>
            <div class="stat-item"><span class="stat-value">${countries.size}</span><span class="stat-label">Countries</span></div>
            <div class="stat-item"><span class="stat-value">${provinces.size}</span><span class="stat-label">Provinces</span></div>
            <div class="stat-item"><span class="stat-value">${cities.size}</span><span class="stat-label">Cities</span></div>
            <div class="stat-item"><span class="stat-value">${totalPhotos}</span><span class="stat-label">Photos</span></div>
        `;
        this.racesContainer.appendChild(statsBar);

        // Add map showing all races
        const racesWithGps = this.manifest.races.filter(race =>
            race.sources.some(s => s.photos.some(p => p.lat && p.lon))
        );

        if (racesWithGps.length > 0 && typeof L !== 'undefined') {
            const mapContainer = document.createElement('div');
            mapContainer.id = 'races-map';
            mapContainer.className = 'race-map';
            this.racesContainer.appendChild(mapContainer);

            setTimeout(() => {
                const map = L.map('races-map');
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; OpenStreetMap contributors'
                }).addTo(map);

                // Group races by location
                const locationMap = {};
                racesWithGps.forEach(race => {
                    let lat, lon;
                    for (const s of race.sources) {
                        for (const p of s.photos) {
                            if (p.lat && p.lon) { lat = p.lat; lon = p.lon; break; }
                        }
                        if (lat) break;
                    }
                    const key = `${lat},${lon}`;
                    if (!locationMap[key]) {
                        locationMap[key] = { lat, lon, races: [] };
                    }
                    const totalPhotos = race.sources.reduce((sum, s) => sum + s.photos.length, 0);
                    locationMap[key].races.push({ race, totalPhotos });
                });

                const bounds = L.latLngBounds();
                Object.values(locationMap).forEach(loc => {
                    const totalPhotos = loc.races.reduce((sum, r) => sum + r.totalPhotos, 0);
                    const icon = L.divIcon({
                        className: 'photo-cluster-icon',
                        html: `<div class="cluster-count">${loc.races.length}</div>`,
                        iconSize: [36, 36]
                    });
                    const marker = L.marker([loc.lat, loc.lon], { icon }).addTo(map);

                    const popupHtml = loc.races.map(r => {
                        const dateStr = r.race.date ? ` <small>(${r.race.date})</small>` : '';
                        return `<a href="#${encodeURIComponent(r.race.name)}" style="font-weight:bold">${r.race.name}</a>${dateStr} — ${r.totalPhotos} photos`;
                    }).join('<br>');
                    marker.bindPopup(popupHtml, { maxWidth: 350 });
                    bounds.extend([loc.lat, loc.lon]);
                });

                map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
                map.invalidateSize();
            }, 100);
        }

        this.manifest.races.forEach((race) => {
            this.racesContainer.appendChild(this.createRaceCard(race));
        });
    }

    /**
     * Haversine distance between two points in meters
     */
    haversine(lat1, lon1, lat2, lon2) {
        const R = 6371000;
        const toRad = d => d * Math.PI / 180;
        const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    /**
     * Parse GPX XML and return array of {lat, lon, time, dist} trackpoints
     */
    parseGpx(xmlText) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlText, 'text/xml');
        const trkpts = doc.querySelectorAll('trkpt');
        const points = [];
        let cumDist = 0;
        trkpts.forEach(pt => {
            const lat = parseFloat(pt.getAttribute('lat'));
            const lon = parseFloat(pt.getAttribute('lon'));
            const timeEl = pt.querySelector('time');
            if (timeEl && !isNaN(lat) && !isNaN(lon)) {
                if (points.length > 0) {
                    const prev = points[points.length - 1];
                    cumDist += this.haversine(prev.lat, prev.lon, lat, lon);
                }
                points.push({ lat, lon, time: new Date(timeEl.textContent).getTime(), dist: cumDist });
            }
        });
        return points;
    }

    /**
     * Convert photo local timestamp (UTC+8) to UTC milliseconds
     */
    photoTimestampToUtc(timestamp) {
        // timestamp format: "2024-01-21 07:33:44"
        return new Date(timestamp.replace(' ', 'T') + '+08:00').getTime();
    }

    /**
     * Interpolate lat/lon/dist from GPX trackpoints for a given UTC time
     */
    interpolatePosition(trackpoints, utcMs) {
        if (!trackpoints.length) return null;
        if (utcMs <= trackpoints[0].time) return trackpoints[0];
        if (utcMs >= trackpoints[trackpoints.length - 1].time) return trackpoints[trackpoints.length - 1];

        // Binary search for surrounding trackpoints
        let lo = 0, hi = trackpoints.length - 1;
        while (lo < hi - 1) {
            const mid = (lo + hi) >> 1;
            if (trackpoints[mid].time <= utcMs) lo = mid;
            else hi = mid;
        }

        const a = trackpoints[lo], b = trackpoints[hi];
        const ratio = (utcMs - a.time) / (b.time - a.time);
        return {
            lat: a.lat + (b.lat - a.lat) * ratio,
            lon: a.lon + (b.lon - a.lon) * ratio,
            dist: a.dist + (b.dist - a.dist) * ratio
        };
    }

    /**
     * Render a race detail page with photos
     */
    async renderRaceDetail(race) {
        this.racesContainer.innerHTML = '';

        // Back button
        const backLink = document.createElement('a');
        backLink.className = 'back-link';
        backLink.href = '#';
        backLink.textContent = '← Back to all races';
        this.racesContainer.appendChild(backLink);

        // Race header
        const card = document.createElement('div');
        card.className = 'race-card';

        const raceHeader = document.createElement('div');
        raceHeader.className = 'race-header';

        const title = document.createElement('h2');
        title.textContent = race.name;

        const info = document.createElement('div');
        info.className = 'race-info';
        const totalPhotos = race.sources.reduce((sum, src) => sum + src.photos.length, 0);
        const dateStr = race.date ? `${race.date} • ` : '';
        info.textContent = `${dateStr}${totalPhotos} photo${totalPhotos !== 1 ? 's' : ''}`;

        raceHeader.appendChild(title);
        raceHeader.appendChild(info);
        card.appendChild(raceHeader);

        // Route map
        if (race.route && typeof L !== 'undefined') {
            const mapContainer = document.createElement('div');
            mapContainer.id = 'race-detail-map';
            mapContainer.className = 'race-map';
            card.appendChild(mapContainer);

            try {
                const res = await fetch(race.route + '?t=' + Date.now());
                const gpxText = await res.text();
                const trackpoints = this.parseGpx(gpxText);

                if (trackpoints.length > 0) {
                    setTimeout(() => {
                        const map = L.map('race-detail-map');
                        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                            attribution: '&copy; OpenStreetMap contributors'
                        }).addTo(map);

                        // Draw route polyline
                        const routeCoords = trackpoints.map(p => [p.lat, p.lon]);
                        const polyline = L.polyline(routeCoords, {
                            color: '#667eea', weight: 4, opacity: 0.8
                        }).addTo(map);

                        // Group photos by time proximity (merge within 60s)
                        const allPhotos = race.sources.flatMap(s => s.photos);
                        const photoPositions = [];
                        allPhotos.forEach(photo => {
                            if (!photo.timestamp) return;
                            const utcMs = this.photoTimestampToUtc(photo.timestamp);
                            const pos = this.interpolatePosition(trackpoints, utcMs);
                            if (!pos) return;
                            photoPositions.push({ photo, lat: pos.lat, lon: pos.lon, dist: pos.dist, time: utcMs });
                        });
                        photoPositions.sort((a, b) => a.time - b.time);

                        const groupList = [];
                        const MERGE_TIME = 10 * 1000; // 10 seconds
                        photoPositions.forEach(pp => {
                            const last = groupList[groupList.length - 1];
                            if (last && (pp.time - last.lastTime) < MERGE_TIME) {
                                last.photos.push(pp.photo);
                                last.lastTime = pp.time;
                                const n = last.photos.length;
                                last.lat = last.lat + (pp.lat - last.lat) / n;
                                last.lon = last.lon + (pp.lon - last.lon) / n;
                                last.dist = last.dist + (pp.dist - last.dist) / n;
                            } else {
                                groupList.push({ lat: pp.lat, lon: pp.lon, dist: pp.dist, lastTime: pp.time, photos: [pp.photo] });
                            }
                        });

                        const fmtDist = (m) => m >= 1000 ? (m / 1000).toFixed(1) + ' km' : Math.round(m) + ' m';

                        groupList.forEach(group => {
                            const distLabel = fmtDist(group.dist);
                            const count = group.photos.length;
                            const size = Math.max(24, 16 + count * 4);
                            const icon = L.divIcon({
                                className: 'photo-marker-icon',
                                html: `<div class="photo-marker" style="width:${size}px;height:${size}px;font-size:${Math.max(11, size * 0.45)}px">${count}</div>`,
                                iconSize: [size, size],
                                iconAnchor: [size / 2, size / 2]
                            });
                            const marker = L.marker([group.lat, group.lon], { icon }).addTo(map);
                            const thumbs = group.photos.map(p =>
                                `<img src="${p.url}" alt="${p.name}" loading="lazy" style="cursor:pointer" onclick="window.galleryInstance.openLightbox('${p.url}')">`
                            ).join('');
                            const timeLabel = group.photos[0].timestamp;
                            const countLabel = group.photos.length > 1 ? ` (${group.photos.length} photos)` : '';
                            marker.bindPopup(
                                `<div class="map-photo-popup">` +
                                `<div class="map-photo-scroll">${thumbs}</div>` +
                                `<div class="map-photo-time">${distLabel} • ${timeLabel}${countLabel}</div></div>`,
                                { maxWidth: 300, minWidth: 120 }
                            );
                        });

                        map.fitBounds(polyline.getBounds(), { padding: [30, 30] });
                        map.invalidateSize();

                        // Render photo groups below map
                        const sourcesContainer = document.createElement('div');
                        sourcesContainer.className = 'sources-container';
                        groupList.forEach(group => {
                            const distLabel = fmtDist(group.dist);
                            sourcesContainer.appendChild(
                                this.createSourceSection(
                                    `${distLabel} — ${group.photos[0].timestamp}`,
                                    group.photos
                                )
                            );
                        });
                        card.appendChild(sourcesContainer);
                    }, 100);
                }
            } catch (e) {
                console.log('Failed to load GPX route:', e);
            }
        }

        // Fallback: show photos grouped by source if no route map was rendered
        if (!race.route || typeof L === 'undefined') {
            const sourcesContainer = document.createElement('div');
            sourcesContainer.className = 'sources-container';
            race.sources.forEach((source) => {
                const sortedPhotos = [...source.photos].sort((a, b) =>
                    (a.timestamp || '').localeCompare(b.timestamp || '')
                );
                sourcesContainer.appendChild(
                    this.createSourceSection(source.name, sortedPhotos)
                );
            });
            card.appendChild(sourcesContainer);
        }

        this.racesContainer.appendChild(card);
    }

    /**
     * Render the gallery
     */
    async render() {
        this.manifest = await this.scanDirectory();
        this.handleRoute();
    }
}

// Initialize the gallery when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const gallery = new RacePhotosGallery();
    window.galleryInstance = gallery;
    gallery.render();
});
