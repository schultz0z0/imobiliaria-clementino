import { test, expect } from '@playwright/test';
test.skip(!process.env.E2E_BASE_URL, 'Defina E2E_BASE_URL para executar contra um ambiente iniciado.');

test('unknown route is a safe noindex recovery page', async ({ page }) => {
  await page.goto('/rota-inexistente');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});
