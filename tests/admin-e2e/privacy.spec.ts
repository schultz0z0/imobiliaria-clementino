import { test, expect } from '@playwright/test';
test.skip(!process.env.E2E_BASE_URL, 'Defina E2E_BASE_URL para executar contra um ambiente iniciado.');

test('property page does not render private address fields', async ({ page }) => {
  await page.goto('/imoveis');
  await expect(page.locator('body')).not.toContainText(/Imovelweb|complemento|número exato/i);
});
