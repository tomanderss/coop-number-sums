import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: true,
  // CI: 4 Worker = alle Kerne der GitHub-Maschine (Standard waere die Haelfte).
  // Gemessen auf 4 Kernen: komplette Suite 5,8 statt 10,9 min, 0 wackelige
  // Tests. Ein Wiederholungsversuch faengt seltene Lastspitzen ab, statt den
  // ganzen Lauf rot zu machen (Playwright meldet solche Tests als „flaky").
  workers: process.env.CI ? 4 : undefined,
  retries: process.env.CI ? 1 : 0,
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
    // Node statt Python: im Playwright-Container des CI gibt es garantiert Node.
    command: 'node scripts/serve.mjs 8099',
    url: 'http://127.0.0.1:8099',
    reuseExistingServer: !process.env.CI,
  },
});
