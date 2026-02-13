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
     * Render the overview page with race cards only
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

        // Add map if any photos have GPS data
        const gpsPhotos = [];
        race.sources.forEach(source => {
            source.photos.forEach(photo => {
                if (photo.lat && photo.lon) {
                    gpsPhotos.push(photo);
                }
            });
        });

        if (gpsPhotos.length > 0 && typeof L !== 'undefined') {
            const mapContainer = document.createElement('div');
            mapContainer.id = 'race-map';
            mapContainer.className = 'race-map';
            // Insert map before the race card
            this.racesContainer.insertBefore(mapContainer, card);

            // Delay map init to ensure container is rendered with correct size
            setTimeout(() => {
                const map = L.map('race-map');
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; OpenStreetMap contributors'
                }).addTo(map);

                // Group photos by location
                const locationMap = {};
                gpsPhotos.forEach(photo => {
                    const key = `${photo.lat},${photo.lon}`;
                    if (!locationMap[key]) {
                        locationMap[key] = { lat: photo.lat, lon: photo.lon, photos: [] };
                    }
                    locationMap[key].photos.push(photo);
                });

                const bounds = L.latLngBounds();
                Object.values(locationMap).forEach(loc => {
                    const icon = L.divIcon({
                        className: 'photo-cluster-icon',
                        html: `<div class="cluster-count">${loc.photos.length}</div>`,
                        iconSize: [36, 36]
                    });
                    const marker = L.marker([loc.lat, loc.lon], { icon }).addTo(map);

                    const thumbsHtml = loc.photos.slice(0, 20).map(p =>
                        `<img src="${p.url}" style="width:80px;height:60px;object-fit:cover;cursor:pointer;border-radius:4px" onclick="window.galleryInstance.openLightbox('${p.url}')">`
                    ).join('');
                    const moreText = loc.photos.length > 20 ? `<p style="margin:4px 0 0;font-size:12px;color:#666">+${loc.photos.length - 20} more</p>` : '';
                    marker.bindPopup(
                        `<div style="max-width:300px;max-height:200px;overflow-y:auto;display:flex;flex-wrap:wrap;gap:4px">${thumbsHtml}</div>${moreText}`,
                        { maxWidth: 320 }
                    );
                    bounds.extend([loc.lat, loc.lon]);
                });

                map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
                map.invalidateSize();
            }, 100);
        }
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
