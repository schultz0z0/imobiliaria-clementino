import { test, expect, type Page } from '@playwright/test';

const measure = async (page: Page, action: () => Promise<void>) => {
  const started = Date.now();
  await action();
  return Date.now() - started;
};

test('catálogo, transição para listagem e detalhe aparecem dentro do orçamento', async ({ page }) => {
  const listingMs = await measure(page, async () => {
    await page.goto('/imoveis', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Encontre seu lugar no Rio.', exact: true })).toBeVisible();
    await expect(page.locator('a[data-analytics-event="property_open"]').first()).toBeVisible();
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('a[href="/imoveis"]').first()).toBeVisible();
  const transitionMs = await measure(page, async () => {
    await page.locator('a[href="/imoveis"]').first().click();
    await page.waitForURL('**/imoveis');
    await expect(page.locator('a[data-analytics-event="property_open"]').first()).toBeVisible();
  });

  const detailHref = await page.locator('a[data-analytics-event="property_open"]').first().getAttribute('href');
  expect(detailHref).toMatch(/^\/imoveis\/.+/u);
  const detailMs = await measure(page, async () => {
    const propertyResponse = page.waitForResponse(
      (response) => response.url().includes('/api/public/properties/') && response.request().method() === 'GET',
      { timeout: 15_000 },
    );
    await page.goto(detailHref!, { waitUntil: 'domcontentloaded' });
    await propertyResponse;
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 12_000 });
  });

  test.info().annotations.push({ type: 'performance', description: JSON.stringify({ listingMs, transitionMs, detailMs }) });
  expect(listingMs, `listagem levou ${listingMs}ms`).toBeLessThan(8_000);
  expect(transitionMs, `transição levou ${transitionMs}ms`).toBeLessThan(8_000);
  expect(detailMs, `detalhe levou ${detailMs}ms`).toBeLessThan(8_000);
});
