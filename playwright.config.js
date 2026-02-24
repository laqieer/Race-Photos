// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests/e2e',
    timeout: 30000,
    retries: 1,
    reporter: [['html', { outputFolder: 'test-report/e2e', open: 'never' }], ['list']],
    use: {
        baseURL: 'https://laqieer.github.io/Race-Photos/',
        screenshot: 'only-on-failure',
        trace: 'on-first-retry',
    },
    projects: [
        { name: 'chromium', use: { browserName: 'chromium' } },
    ],
});
