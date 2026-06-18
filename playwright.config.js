import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:8099',
    ...devices['Pixel 7'],
    // Pin the browser locale so the app's navigator.language auto-detect
    // deterministically lands on German (the app's primary/default market)
    // instead of Playwright's own en-US default.
    locale: 'de-DE',
  },
  webServer: {
    command: 'python3 -m http.server 8099',
    url: 'http://127.0.0.1:8099',
    reuseExistingServer: !process.env.CI,
  },
});
