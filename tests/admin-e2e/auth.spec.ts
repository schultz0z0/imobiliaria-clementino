import { test, expect } from '@playwright/test';
test.skip(!process.env.E2E_BASE_URL, 'Defina E2E_BASE_URL para executar contra um ambiente iniciado.');

test('public site remains reachable without exposing admin session data', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Clementino/i);
  expect(await page.context().cookies()).not.toEqual(expect.arrayContaining([expect.objectContaining({ name: 'clementino_admin_session' })]));
});
