import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/seo-e2e',
  timeout: 180_000,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4185', actionTimeout: 15000, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
});
