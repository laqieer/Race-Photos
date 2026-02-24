const { test, expect } = require('@playwright/test');

test.describe('Gallery Overview', () => {
    test('page loads with title and header', async ({ page }) => {
        await page.goto('./');
        await expect(page).toHaveTitle('Race Photos');
        await expect(page.locator('header h1')).toHaveText('🏃 Race Photos');
    });

    test('races are displayed', async ({ page }) => {
        await page.goto('./');
        const cards = page.locator('.race-card');
        await expect(cards.first()).toBeVisible({ timeout: 10000 });
        const count = await cards.count();
        expect(count).toBeGreaterThan(0);
    });

    test('stats bar shows race and photo counts', async ({ page }) => {
        await page.goto('./');
        const stats = page.locator('.stats-bar');
        await expect(stats).toBeVisible({ timeout: 10000 });
        await expect(stats).toContainText('Races');
        await expect(stats).toContainText('Photos');
    });

    test('links bar has race results and certificates links', async ({ page }) => {
        await page.goto('./');
        const linksBar = page.locator('.links-bar');
        await expect(linksBar).toBeVisible({ timeout: 10000 });
        const resultsLink = linksBar.locator('a', { hasText: 'Race Results' });
        await expect(resultsLink).toHaveAttribute('href', /laqieer\.github\.io\/running_race/);
        const certLink = linksBar.locator('a', { hasText: 'Race Certificates' });
        await expect(certLink).toHaveAttribute('href', /running_cert/);
    });

    test('overview map is rendered', async ({ page }) => {
        await page.goto('./');
        const map = page.locator('#races-map');
        await expect(map).toBeVisible({ timeout: 10000 });
    });

    test('overview map has city glow circles', async ({ page }) => {
        await page.goto('./');
        const map = page.locator('#races-map');
        await expect(map).toBeVisible({ timeout: 10000 });
        // Leaflet renders circles as SVG paths inside the map
        const circles = map.locator('path.leaflet-interactive');
        await expect(circles.first()).toBeVisible({ timeout: 10000 });
        const count = await circles.count();
        expect(count).toBeGreaterThan(0);
    });

    test('footer has GitHub link', async ({ page }) => {
        await page.goto('./');
        const githubLink = page.locator('footer a[href*="github.com"]');
        await expect(githubLink).toBeVisible();
    });
});

test.describe('Race Detail', () => {
    test('clicking a race card navigates to detail', async ({ page }) => {
        await page.goto('./');
        const firstCard = page.locator('.race-card').first();
        await expect(firstCard).toBeVisible({ timeout: 10000 });
        await firstCard.click();
        await expect(page.locator('.back-link')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('.race-header h2')).toBeVisible();
    });

    test('race detail shows photos', async ({ page }) => {
        await page.goto('./');
        const firstCard = page.locator('.race-card').first();
        await expect(firstCard).toBeVisible({ timeout: 10000 });
        await firstCard.click();
        const photos = page.locator('.photo-grid img, .photo-grid video');
        await expect(photos.first()).toBeVisible({ timeout: 10000 });
    });

    test('back link returns to overview', async ({ page }) => {
        await page.goto('./');
        const firstCard = page.locator('.race-card').first();
        await expect(firstCard).toBeVisible({ timeout: 10000 });
        await firstCard.click();
        await expect(page.locator('.back-link')).toBeVisible({ timeout: 10000 });
        await page.locator('.back-link').click();
        await expect(page.locator('.race-card').first()).toBeVisible({ timeout: 10000 });
    });

    test('Strava link is shown for races with GPX', async ({ page }) => {
        await page.goto('./');
        const firstCard = page.locator('.race-card').first();
        await expect(firstCard).toBeVisible({ timeout: 10000 });
        await firstCard.click();
        await expect(page.locator('.back-link')).toBeVisible({ timeout: 10000 });
        const stravaLink = page.locator('.strava-link').first();
        if (await stravaLink.isVisible()) {
            await expect(stravaLink).toHaveAttribute('href', /strava\.com/);
        }
    });

    test('GPX download link is present for races with route', async ({ page }) => {
        await page.goto('./');
        const firstCard = page.locator('.race-card').first();
        await expect(firstCard).toBeVisible({ timeout: 10000 });
        await firstCard.click();
        await expect(page.locator('.back-link')).toBeVisible({ timeout: 10000 });
        const gpxLink = page.locator('.gpx-download');
        if (await gpxLink.isVisible()) {
            await expect(gpxLink).toContainText('Download GPX');
        }
    });
});

test.describe('Lightbox', () => {
    test('clicking a photo opens lightbox', async ({ page }) => {
        await page.goto('./');
        const firstCard = page.locator('.race-card').first();
        await expect(firstCard).toBeVisible({ timeout: 10000 });
        await firstCard.click();
        const firstPhoto = page.locator('.photo-grid img').first();
        await expect(firstPhoto).toBeVisible({ timeout: 10000 });
        await firstPhoto.click();
        await expect(page.locator('.lightbox')).toBeVisible();
    });

    test('closing lightbox with close button', async ({ page }) => {
        await page.goto('./');
        const firstCard = page.locator('.race-card').first();
        await expect(firstCard).toBeVisible({ timeout: 10000 });
        await firstCard.click();
        const firstPhoto = page.locator('.photo-grid img').first();
        await expect(firstPhoto).toBeVisible({ timeout: 10000 });
        await firstPhoto.click();
        await expect(page.locator('.lightbox')).toBeVisible();
        await page.locator('.lightbox-close').click();
        await expect(page.locator('.lightbox')).not.toBeVisible();
    });

    test('closing lightbox with Escape key', async ({ page }) => {
        await page.goto('./');
        const firstCard = page.locator('.race-card').first();
        await expect(firstCard).toBeVisible({ timeout: 10000 });
        await firstCard.click();
        const firstPhoto = page.locator('.photo-grid img').first();
        await expect(firstPhoto).toBeVisible({ timeout: 10000 });
        await firstPhoto.click();
        await expect(page.locator('.lightbox')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.locator('.lightbox')).not.toBeVisible();
    });
});

test.describe('Route Map', () => {
    test('race detail map is rendered for race with GPX', async ({ page }) => {
        await page.goto('./');
        const firstCard = page.locator('.race-card').first();
        await expect(firstCard).toBeVisible({ timeout: 10000 });
        await firstCard.click();
        // Map may take time to render
        const map = page.locator('#race-detail-map');
        if (await map.isVisible({ timeout: 5000 }).catch(() => false)) {
            await expect(map).toBeVisible();
            // Check that Leaflet tiles loaded
            const tiles = map.locator('.leaflet-tile-loaded');
            await expect(tiles.first()).toBeVisible({ timeout: 10000 });
        }
    });
});
