import { test, expect } from '@playwright/test';

test('property page does not render private address fields', async ({ page }) => {
  await page.goto('/imoveis');
  await expect(page.locator('body')).not.toContainText(/Imovelweb|complemento|número exato/i);
});

