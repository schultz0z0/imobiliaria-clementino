import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/pixel-e2e',
  timeout: 35_000,
  expect: { timeout: 10_000 },
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4188', trace: 'retain-on-failure' },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4188 --strictPort',
    url: 'http://127.0.0.1:4188',
    reuseExistingServer: false,
    env: { VITE_META_PIXEL_ID: '1324132266370583', VITE_GA_MEASUREMENT_ID: '', VITE_GOOGLE_ADS_ID: '' },
  },
});
