import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/public-e2e',
  timeout: 30_000,
  expect: { timeout: 12_000 },
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: 'npm run dev', url: 'http://127.0.0.1:4174', reuseExistingServer: true },
});
