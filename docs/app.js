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
     * Render the overview page with race cards and map
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
                        html: `<div class="cluster-count">${loc.races.length > 1 ? loc.races.length : totalPhotos}</div>`,
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
     * Render a race detail page with photos
     */
    renderRaceDetail(race) {
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

        // Sources with photos
        const sourcesContainer = document.createElement('div');
        sourcesContainer.className = 'sources-container';

        race.sources.forEach((source) => {
            sourcesContainer.appendChild(
                this.createSourceSection(source.name, source.photos)
            );
        });

        card.appendChild(raceHeader);
        card.appendChild(sourcesContainer);
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
