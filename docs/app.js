/**
 * Race Photos Gallery Application
 * Dynamically loads and displays photos organized by races and sources
 */

class RacePhotosGallery {
    constructor() {
        this.racesContainer = document.getElementById('races-container');
        this.lightbox = null;
        this.initLightbox();
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
            // Since we can't directly scan directories in a static site,
            // we'll need to maintain a manifest file or use GitHub API
            // For now, we'll try to load a manifest.json file
            const response = await fetch('images/manifest.json');
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
     * Create a race card
     */
    createRaceCard(race) {
        const card = document.createElement('div');
        card.className = 'race-card';

        // Race header
        const raceHeader = document.createElement('div');
        raceHeader.className = 'race-header';

        const title = document.createElement('h2');
        title.textContent = race.name;

        const info = document.createElement('div');
        info.className = 'race-info';
        const totalPhotos = race.sources.reduce((sum, src) => sum + src.photos.length, 0);
        info.textContent = `${race.sources.length} source${race.sources.length !== 1 ? 's' : ''} • ${totalPhotos} photo${totalPhotos !== 1 ? 's' : ''}`;

        raceHeader.appendChild(title);
        raceHeader.appendChild(info);

        // Sources container
        const sourcesContainer = document.createElement('div');
        sourcesContainer.className = 'sources-container';

        race.sources.forEach((source) => {
            sourcesContainer.appendChild(
                this.createSourceSection(source.name, source.photos)
            );
        });

        card.appendChild(raceHeader);
        card.appendChild(sourcesContainer);

        return card;
    }

    /**
     * Render the gallery
     */
    async render() {
        const data = await this.scanDirectory();

        // Clear loading message
        this.racesContainer.innerHTML = '';

        if (!data.races || data.races.length === 0) {
            // Show empty state
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

        // Render each race
        data.races.forEach((race) => {
            this.racesContainer.appendChild(this.createRaceCard(race));
        });
    }
}

// Initialize the gallery when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const gallery = new RacePhotosGallery();
    gallery.render();
});
