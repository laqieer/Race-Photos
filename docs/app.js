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
            <div class="lightbox-content"></div>
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
    openLightbox(mediaSrc) {
        const content = this.lightbox.querySelector('.lightbox-content');
        const isVideo = /\.(mp4|mov|webm)$/i.test(mediaSrc);
        if (isVideo) {
            content.innerHTML = `<video src="${mediaSrc}" controls autoplay style="max-width:90vw;max-height:90vh"></video>`;
        } else {
            content.innerHTML = `<img src="${mediaSrc}" alt="Full size photo">`;
        }
        this.lightbox.classList.add('active');
    }

    /**
     * Close the lightbox
     */
    closeLightbox() {
        const video = this.lightbox.querySelector('video');
        if (video) video.pause();
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
     * Count photos and videos in an items array, return formatted string
     */
    formatMediaCount(items) {
        const videos = items.filter(p => /\.(mp4|mov|webm)$/i.test(p.url || p.name || '')).length;
        const photos = items.length - videos;
        const parts = [];
        if (photos) parts.push(`${photos} photo${photos !== 1 ? 's' : ''}`);
        if (videos) parts.push(`${videos} video${videos !== 1 ? 's' : ''}`);
        return parts.join(', ') || '0 photos';
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
            const isVideo = /\.(mp4|mov|webm)$/i.test(photo.url);

            if (isVideo) {
                photoItem.classList.add('video-item');
                const video = document.createElement('video');
                video.src = photo.url;
                video.muted = true;
                video.loop = true;
                video.playsInline = true;
                video.preload = 'metadata';
                if (photo.poster) video.poster = photo.poster;
                video.addEventListener('mouseenter', () => video.play());
                video.addEventListener('mouseleave', () => { video.pause(); video.currentTime = 0; });
                photoItem.appendChild(video);
            } else {
                const img = document.createElement('img');
                img.src = photo.url;
                img.alt = photo.name;
                img.loading = 'lazy';
                photoItem.appendChild(img);
            }

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
        count.textContent = this.formatMediaCount(photos);

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
        const allItems = race.sources.flatMap(s => s.photos);
        info.textContent = `${dateStr}${race.sources.length} source${race.sources.length !== 1 ? 's' : ''} • ${this.formatMediaCount(allItems)}`;

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
        const allMedia = races.flatMap(r => r.sources.flatMap(s => s.photos));
        const totalVideos = allMedia.filter(p => /\.(mp4|mov|webm)$/i.test(p.url || p.name || '')).length;
        const totalPhotos = allMedia.length - totalVideos;
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
            ${totalVideos ? `<div class="stat-item"><span class="stat-value">${totalVideos}</span><span class="stat-label">Videos</span></div>` : ''}
        `;
        this.racesContainer.appendChild(statsBar);

        // Add map showing all races
        const racesWithLocation = this.manifest.races.filter(race =>
            race.sources.some(s => s.photos.some(p => p.lat && p.lon)) || (race.lat && race.lon) || race.city
        );

        if (racesWithLocation.length > 0 && typeof L !== 'undefined') {
            const mapContainer = document.createElement('div');
            mapContainer.id = 'races-map';
            mapContainer.className = 'race-map';
            this.racesContainer.appendChild(mapContainer);

            setTimeout(() => {
                const map = L.map('races-map');
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; OpenStreetMap contributors'
                }).addTo(map);

                const cityCoords = {};
                racesWithLocation.forEach(race => {
                    let lat, lon;
                    for (const s of race.sources) {
                        for (const p of s.photos) {
                            if (p.lat && p.lon) { lat = p.lat; lon = p.lon; break; }
                        }
                        if (lat) break;
                    }
                    if (lat && race.city && !cityCoords[race.city]) {
                        cityCoords[race.city] = { lat, lon };
                    }
                });

                const clusterGroup = L.markerClusterGroup({
                    iconCreateFunction(cluster) {
                        const count = cluster.getAllChildMarkers()
                            .reduce((sum, m) => sum + (m.options.raceCount || 1), 0);
                        const size = count > 5 ? 44 : 36;
                        return L.divIcon({
                            className: 'photo-cluster-icon',
                            html: `<div class="cluster-count">${count}</div>`,
                            iconSize: [size, size]
                        });
                    },
                    maxClusterRadius: 40,
                    spiderfyOnMaxZoom: true,
                    showCoverageOnHover: false
                });

                const bounds = L.latLngBounds();
                racesWithLocation.forEach(race => {
                    let lat, lon;
                    if (race.lat && race.lon) { lat = race.lat; lon = race.lon; }
                    if (!lat) {
                        for (const s of race.sources) {
                            for (const p of s.photos) {
                                if (p.lat && p.lon) { lat = p.lat; lon = p.lon; break; }
                            }
                            if (lat) break;
                        }
                    }
                    if (!lat && race.city && cityCoords[race.city]) {
                        lat = cityCoords[race.city].lat;
                        lon = cityCoords[race.city].lon;
                    }
                    if (!lat) return;

                    const totalPhotos = race.sources.reduce((sum, s) => sum + s.photos.length, 0);
                    const mediaLabel = this.formatMediaCount(race.sources.flatMap(s => s.photos));
                    const icon = L.divIcon({
                        className: 'photo-cluster-icon',
                        html: `<div class="cluster-count">1</div>`,
                        iconSize: [36, 36]
                    });
                    const marker = L.marker([lat, lon], { icon, raceCount: 1 });
                    const dateStr = race.date ? ` <small>(${race.date})</small>` : '';
                    marker.bindPopup(
                        `<a href="#${encodeURIComponent(race.name)}" style="font-weight:bold">${race.name}</a>${dateStr} — ${mediaLabel}`,
                        { maxWidth: 350 }
                    );
                    clusterGroup.addLayer(marker);
                    bounds.extend([lat, lon]);
                });

                map.addLayer(clusterGroup);
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
                const eleEl = pt.querySelector('ele');
                const hrEl = pt.querySelector('hr');
                const entry = { lat, lon, time: new Date(timeEl.textContent).getTime(), dist: cumDist };
                if (eleEl) entry.ele = parseFloat(eleEl.textContent);
                if (hrEl) entry.hr = parseInt(hrEl.textContent);
                points.push(entry);
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
        const TOLERANCE = 30 * 1000; // 30 seconds
        // Return null for times outside GPX range (with tolerance)
        if (utcMs < trackpoints[0].time - TOLERANCE || utcMs > trackpoints[trackpoints.length - 1].time + TOLERANCE) return null;
        // Clamp to range
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
     * Render elevation, pace, and heart rate chart from GPX trackpoints
     */
    renderGpxChart(trackpoints, container) {
        if (typeof Chart === 'undefined' || trackpoints.length < 2) return;

        // Sample trackpoints to avoid too many data points (~500 max)
        const step = Math.max(1, Math.floor(trackpoints.length / 500));
        const sampled = trackpoints.filter((_, i) => i % step === 0 || i === trackpoints.length - 1);

        // Compute pace (min/km) using rolling window
        const PACE_WINDOW = 30; // seconds
        const timeLabels = [];
        const distLabels = [];
        const elevationData = [];
        const paceData = [];
        const hrData = [];
        let hasHr = false;

        sampled.forEach((pt, idx) => {
            // Time label in local time (UTC+8)
            const localTime = new Date(pt.time + 8 * 3600 * 1000);
            const hh = String(localTime.getUTCHours()).padStart(2, '0');
            const mm = String(localTime.getUTCMinutes()).padStart(2, '0');
            const ss = String(localTime.getUTCSeconds()).padStart(2, '0');
            timeLabels.push(`${hh}:${mm}:${ss}`);

            // Distance label in km
            distLabels.push((pt.dist / 1000).toFixed(2));

            // Elevation
            elevationData.push(pt.ele != null ? pt.ele : null);

            // Heart rate
            if (pt.hr != null) { hasHr = true; hrData.push(pt.hr); }
            else hrData.push(null);

            // Pace: find point ~PACE_WINDOW seconds ago
            if (idx === 0) { paceData.push(null); return; }
            let prev = sampled[idx - 1];
            for (let j = idx - 1; j >= 0; j--) {
                if (pt.time - sampled[j].time >= PACE_WINDOW * 1000) { prev = sampled[j]; break; }
            }
            const timeDiffMin = (pt.time - prev.time) / 60000;
            const distDiffKm = (pt.dist - prev.dist) / 1000;
            if (distDiffKm > 0.001 && timeDiffMin > 0) {
                const pace = timeDiffMin / distDiffKm;
                paceData.push(pace > 15 ? null : pace); // cap at 15 min/km
            } else {
                paceData.push(null);
            }
        });

        const chartContainer = document.createElement('div');
        chartContainer.className = 'gpx-chart-container';

        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'chart-axis-toggle';
        toggleBtn.textContent = 'X: Time';
        container.appendChild(toggleBtn);

        const canvas = document.createElement('canvas');
        canvas.id = 'gpx-chart';
        chartContainer.appendChild(canvas);
        container.appendChild(chartContainer);

        const datasets = [
            {
                label: 'Elevation (m)',
                data: elevationData,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                fill: true,
                yAxisID: 'yEle',
                pointRadius: 0,
                borderWidth: 1.5,
                tension: 0.3
            },
            {
                label: 'Pace (min/km)',
                data: paceData,
                borderColor: '#e74c3c',
                yAxisID: 'yPace',
                pointRadius: 0,
                borderWidth: 1.5,
                tension: 0.3
            }
        ];

        const scales = {
            x: { ticks: { maxTicksLimit: 10, font: { size: 10 } }, title: { display: true, text: 'Time', font: { size: 11 } } },
            yEle: {
                type: 'linear', position: 'left',
                title: { display: true, text: 'Elevation (m)', color: '#667eea' },
                ticks: { color: '#667eea' },
                grid: { drawOnChartArea: false }
            },
            yPace: {
                type: 'linear', position: 'right', reverse: true,
                title: { display: true, text: 'Pace (min/km)', color: '#e74c3c' },
                ticks: { color: '#e74c3c' },
                grid: { drawOnChartArea: false }
            }
        };

        if (hasHr) {
            datasets.push({
                label: 'Heart Rate (bpm)',
                data: hrData,
                borderColor: '#f39c12',
                yAxisID: 'yHr',
                pointRadius: 0,
                borderWidth: 1.5,
                tension: 0.3
            });
            scales.yHr = {
                type: 'linear', position: 'right',
                title: { display: true, text: 'HR (bpm)', color: '#f39c12' },
                ticks: { color: '#f39c12' },
                grid: { drawOnChartArea: false }
            };
        }

        const chart = new Chart(canvas, {
            type: 'line',
            data: { labels: timeLabels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        onClick: (e, legendItem, legend) => {
                            const idx = legendItem.datasetIndex;
                            const meta = legend.chart.getDatasetMeta(idx);
                            meta.hidden = !meta.hidden;
                            legend.chart.update();
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const v = ctx.parsed.y;
                                if (v == null) return '';
                                if (ctx.dataset.yAxisID === 'yPace') {
                                    const mins = Math.floor(v);
                                    const secs = Math.round((v - mins) * 60);
                                    return `Pace: ${mins}'${String(secs).padStart(2, '0')}"`;
                                }
                                if (ctx.dataset.yAxisID === 'yHr') return `HR: ${v} bpm`;
                                return `Elevation: ${v.toFixed(0)} m`;
                            }
                        }
                    }
                },
                scales
            }
        });

        let showDist = false;
        toggleBtn.addEventListener('click', () => {
            showDist = !showDist;
            toggleBtn.textContent = showDist ? 'X: Distance' : 'X: Time';
            chart.data.labels = showDist ? distLabels : timeLabels;
            chart.options.scales.x.title.text = showDist ? 'Distance (km)' : 'Time';
            chart.update('none');
        });
    }

    /**
     * Get pace (min/km) and heart rate at a given UTC time from trackpoints
     */
    getMetricsAtTime(trackpoints, utcMs) {
        const WINDOW = 30 * 1000; // 30 seconds window for pace
        // Find index via binary search
        let lo = 0, hi = trackpoints.length - 1;
        while (lo < hi - 1) {
            const mid = (lo + hi) >> 1;
            if (trackpoints[mid].time <= utcMs) lo = mid;
            else hi = mid;
        }
        const pt = trackpoints[lo];
        // Heart rate: interpolate from nearest point
        const hr = pt.hr != null ? pt.hr : (trackpoints[hi] && trackpoints[hi].hr != null ? trackpoints[hi].hr : null);
        // Pace: find point ~WINDOW ago
        let prev = pt;
        for (let j = lo; j >= 0; j--) {
            if (pt.time - trackpoints[j].time >= WINDOW) { prev = trackpoints[j]; break; }
        }
        let pace = null;
        const timeDiffMin = (pt.time - prev.time) / 60000;
        const distDiffKm = (pt.dist - prev.dist) / 1000;
        if (distDiffKm > 0.001 && timeDiffMin > 0) {
            pace = timeDiffMin / distDiffKm;
            if (pace > 15) pace = null;
        }
        return { pace, hr };
    }

    /**
     * Format pace as M'SS"
     */
    formatPace(pace) {
        if (pace == null) return '';
        const mins = Math.floor(pace);
        const secs = Math.round((pace - mins) * 60);
        return `${mins}'${String(secs).padStart(2, '0')}"`;
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
        const allItems = race.sources.flatMap(s => s.photos);
        info.textContent = `${dateStr}${this.formatMediaCount(allItems)}`;

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

                        // Add km distance markers along the route
                        const kmLayer = L.layerGroup().addTo(map);
                        const totalDist = trackpoints[trackpoints.length - 1].dist;
                        for (let km = 1; km * 1000 <= totalDist; km++) {
                            const targetDist = km * 1000;
                            let i = 0;
                            while (i < trackpoints.length - 1 && trackpoints[i + 1].dist < targetDist) i++;
                            const a = trackpoints[i], b = trackpoints[i + 1];
                            const ratio = (targetDist - a.dist) / (b.dist - a.dist);
                            const lat = a.lat + (b.lat - a.lat) * ratio;
                            const lon = a.lon + (b.lon - a.lon) * ratio;
                            const kmIcon = L.divIcon({
                                className: 'km-marker-icon',
                                html: `<div class="km-marker">${km}</div>`,
                                iconSize: [20, 20],
                                iconAnchor: [10, 10]
                            });
                            L.marker([lat, lon], { icon: kmIcon, interactive: false }).addTo(kmLayer);
                        }

                        // Group photos by time proximity (merge within 60s)
                        const allPhotos = race.sources.flatMap(s => s.photos);
                        const photoPositions = [];
                        const outOfRangePhotos = [];
                        const noTimestampPhotos = [];
                        allPhotos.forEach(photo => {
                            if (!photo.timestamp) {
                                noTimestampPhotos.push(photo);
                                return;
                            }
                            const utcMs = this.photoTimestampToUtc(photo.timestamp);
                            const pos = this.interpolatePosition(trackpoints, utcMs);
                            if (!pos) {
                                outOfRangePhotos.push({ photo, time: utcMs });
                                return;
                            }
                            photoPositions.push({ photo, lat: pos.lat, lon: pos.lon, dist: pos.dist, time: utcMs });
                        });
                        photoPositions.sort((a, b) => a.time - b.time);
                        outOfRangePhotos.sort((a, b) => a.time - b.time);

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
                                groupList.push({ lat: pp.lat, lon: pp.lon, dist: pp.dist, lastTime: pp.time, time: pp.time, photos: [pp.photo] });
                            }
                        });

                        const fmtDist = (m) => m >= 1000 ? (m / 1000).toFixed(1) + ' km' : Math.round(m) + ' m';

                        const clusterGroup = L.markerClusterGroup({
                            maxClusterRadius: 40,
                            iconCreateFunction: (cluster) => {
                                const childMarkers = cluster.getAllChildMarkers();
                                const total = childMarkers.reduce((sum, m) => sum + (m._photoCount || 0), 0);
                                return L.divIcon({
                                    className: 'photo-marker-icon',
                                    html: `<div class="photo-marker">${total}</div>`,
                                    iconSize: [28, 28],
                                    iconAnchor: [14, 14]
                                });
                            }
                        });

                        groupList.forEach(group => {
                            const distLabel = fmtDist(group.dist);
                            const metrics = this.getMetricsAtTime(trackpoints, group.time);
                            const metricsParts = [];
                            if (metrics.pace) metricsParts.push(`⏱ ${this.formatPace(metrics.pace)}/km`);
                            if (metrics.hr) metricsParts.push(`❤️ ${metrics.hr} bpm`);
                            const metricsLabel = metricsParts.length ? ' • ' + metricsParts.join(' • ') : '';
                            group.metricsLabel = metricsParts.join(' • ');

                            const count = group.photos.length;
                            const icon = L.divIcon({
                                className: 'photo-marker-icon',
                                html: `<div class="photo-marker">${count}</div>`,
                                iconSize: [28, 28],
                                iconAnchor: [14, 14]
                            });
                            const marker = L.marker([group.lat, group.lon], { icon });
                            marker._photoCount = count;
                            const thumbs = group.photos.map(p => {
                                const isVid = /\.(mp4|mov|webm)$/i.test(p.url);
                                if (isVid) {
                                    const posterAttr = p.poster ? ` poster="${p.poster}"` : '';
                                    return `<video src="${p.url}" muted loop playsinline preload="metadata"${posterAttr} style="cursor:pointer;max-height:120px" onclick="window.galleryInstance.openLightbox('${p.url}')" onmouseenter="this.play()" onmouseleave="this.pause();this.currentTime=0"></video>`;
                                }
                                return `<img src="${p.url}" alt="${p.name}" loading="lazy" style="cursor:pointer" onclick="window.galleryInstance.openLightbox('${p.url}')">`;
                            }).join('');
                            const timeLabel = (group.photos[0].timestamp || '').split(' ')[1] || group.photos[0].timestamp;
                            const countLabel = group.photos.length > 1 ? ` (${group.photos.length} photos)` : '';
                            marker.bindPopup(
                                `<div class="map-photo-popup">` +
                                `<div class="map-photo-scroll">${thumbs}</div>` +
                                `<div class="map-photo-time">${timeLabel} • ${distLabel}${metricsLabel}${countLabel}</div></div>`,
                                { maxWidth: 300, minWidth: 120 }
                            );
                            clusterGroup.addLayer(marker);
                        });
                        map.addLayer(clusterGroup);

                        map.fitBounds(polyline.getBounds(), { padding: [30, 30] });
                        map.invalidateSize();

                        // Add legend
                        const legend = L.control({ position: 'bottomright' });
                        legend.onAdd = () => {
                            const div = L.DomUtil.create('div', 'map-legend');
                            div.innerHTML =
                                '<div class="legend-item"><span class="legend-icon km-marker">1</span> Distance (km)</div>' +
                                '<div class="legend-item"><span class="legend-icon photo-marker">3</span> Photo count</div>';
                            return div;
                        };
                        legend.addTo(map);

                        L.control.layers(null, { 'Distance (km)': kmLayer }, { collapsed: false }).addTo(map);

                        // Render elevation/pace/heart rate chart
                        this.renderGpxChart(trackpoints, card);

                        // Render photo groups below map
                        const sourcesContainer = document.createElement('div');
                        sourcesContainer.className = 'sources-container';
                        groupList.forEach(group => {
                            const distLabel = fmtDist(group.dist);
                            const timeStr = (group.photos[0].timestamp || '').split(' ')[1] || group.photos[0].timestamp;
                            const metricsSuffix = group.metricsLabel ? ` • ${group.metricsLabel}` : '';
                            sourcesContainer.appendChild(
                                this.createSourceSection(
                                    `${timeStr} — ${distLabel}${metricsSuffix}`,
                                    group.photos
                                )
                            );
                        });
                        // Render out-of-range photos (time only, no map/distance/pace/HR)
                        if (outOfRangePhotos.length > 0) {
                            const oorGroups = [];
                            const OOR_MERGE = 10 * 1000;
                            outOfRangePhotos.forEach(pp => {
                                const last = oorGroups[oorGroups.length - 1];
                                if (last && (pp.time - last.lastTime) < OOR_MERGE) {
                                    last.photos.push(pp.photo);
                                    last.lastTime = pp.time;
                                } else {
                                    oorGroups.push({ lastTime: pp.time, time: pp.time, photos: [pp.photo] });
                                }
                            });
                            oorGroups.forEach(group => {
                                const timeStr = (group.photos[0].timestamp || '').split(' ')[1] || group.photos[0].timestamp;
                                sourcesContainer.appendChild(
                                    this.createSourceSection(timeStr, group.photos)
                                );
                            });
                        }
                        if (noTimestampPhotos.length > 0) {
                            sourcesContainer.appendChild(
                                this.createSourceSection('Other', noTimestampPhotos)
                            );
                        }
                        card.appendChild(sourcesContainer);
                    }, 100);
                }
            } catch (e) {
                console.log('Failed to load GPX route:', e);
            }
        }

        // Fallback: show photos grouped by time if no route map was rendered
        if (!race.route || typeof L === 'undefined') {
            const sourcesContainer = document.createElement('div');
            sourcesContainer.className = 'sources-container';
            const allPhotos = race.sources.flatMap(s => s.photos);
            const withTime = allPhotos.filter(p => p.timestamp);
            if (withTime.length > 0) {
                withTime.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
                const MERGE_TIME = 10 * 1000;
                const groups = [];
                withTime.forEach(photo => {
                    const utcMs = this.photoTimestampToUtc(photo.timestamp);
                    const last = groups[groups.length - 1];
                    if (last && (utcMs - last.lastTime) < MERGE_TIME) {
                        last.photos.push(photo);
                        last.lastTime = utcMs;
                    } else {
                        groups.push({ time: utcMs, lastTime: utcMs, photos: [photo] });
                    }
                });
                groups.forEach(group => {
                    const timeStr = (group.photos[0].timestamp || '').split(' ')[1] || group.photos[0].timestamp;
                    sourcesContainer.appendChild(
                        this.createSourceSection(timeStr, group.photos)
                    );
                });
                const noTime = allPhotos.filter(p => !p.timestamp);
                if (noTime.length > 0) {
                    sourcesContainer.appendChild(
                        this.createSourceSection('Other', noTime)
                    );
                }
            } else {
                race.sources.forEach((source) => {
                    sourcesContainer.appendChild(
                        this.createSourceSection(source.name, source.photos)
                    );
                });
            }
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
