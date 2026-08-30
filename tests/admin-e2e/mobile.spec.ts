import { test, expect } from '@playwright/test';

test('mobile public layout has no horizontal overflow', async ({ page }) => {
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

