import { test, expect } from '@playwright/test';
test.skip(!process.env.E2E_BASE_URL, 'Defina E2E_BASE_URL para executar contra um ambiente iniciado.');

test('catalog route exposes recovery navigation', async ({ page }) => {
  await page.goto('/imoveis');
  await expect(page.getByRole('heading', { name: /imóveis/i })).toBeVisible();
});
