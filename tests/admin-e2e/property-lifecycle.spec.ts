import { test, expect } from '@playwright/test';

test('catalog route exposes recovery navigation', async ({ page }) => {
  await page.goto('/imoveis');
  await expect(page.getByRole('heading', { name: /imóveis/i })).toBeVisible();
});

