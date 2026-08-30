import { test, expect } from '@playwright/test';

test('unknown route is a safe noindex recovery page', async ({ page }) => {
  await page.goto('/rota-inexistente');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});

