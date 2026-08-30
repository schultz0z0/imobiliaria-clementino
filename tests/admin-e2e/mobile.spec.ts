import { test, expect } from '@playwright/test';
test.skip(!process.env.E2E_BASE_URL, 'Defina E2E_BASE_URL para executar contra um ambiente iniciado.');

test('mobile public layout has no horizontal overflow', async ({ page }) => {
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
