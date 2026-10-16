import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { WebsiteProperty } from '../../src/types/property';
import { acceptAllConsent, CONSENT_STORAGE_KEY } from '../../src/privacy/consent';

const sample = (JSON.parse(readFileSync('src/data/properties.generated.json', 'utf8')) as WebsiteProperty[])[0]!;
const property = { ...sample, id: 'pixel-new-admin-property', slug: 'pixel-new-admin-property', reference: 'PIX-2026' };
const secondProperty = { ...property, id: 'pixel-second-property', slug: 'pixel-second-property', reference: 'AP 123/2026' };
type TestWindow = Window & { __metaCalls?: unknown[][] };
const events = (page: Page) => page.evaluate(() => ((window as TestWindow).__metaCalls ?? []).filter((c) => String(c[0]).startsWith('track')));
const eventsNamed = async (page: Page, name: string) => (await events(page)).filter((c) => c[2] === name);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { window.open = () => null; });
  await page.route('https://**/*', (route) => route.abort());
  await page.route('https://connect.facebook.net/en_US/fbevents.js', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `(() => {
      const fbq = window.fbq;
      window.__metaCalls = [...fbq.queue];
      fbq.queue = [];
      fbq.callMethod = (...args) => window.__metaCalls.push(args);
      if (!fbq.disablePushState) {
        const push = history.pushState.bind(history);
        history.pushState = (...args) => { push(...args); fbq('track', 'PageView'); };
      }
    })();`,
  }));
  await page.route('**/api/public/catalog', (route) => route.fulfill({ json: { properties: [property, secondProperty] } }));
  await page.route('**/api/public/properties/*', (route) => {
    const slug = new URL(route.request().url()).pathname.split('/').at(-1);
    const current = [property, secondProperty].find((p) => p.slug === slug);
    return route.fulfill({ status: current ? 200 : 404, json: current ? { property: current } : {} });
  });
  await page.route('**/api/property-previews?*', (route) => route.fulfill({ json: { property, expiresAt: '2026-10-16T12:00:00.000Z' } }));
});

test('new admin properties and their CTAs are measured once across SPA navigation and consent changes', async ({ page }) => {
  let scriptRequests = 0;
  page.on('request', (request) => { if (request.url().includes('fbevents.js')) scriptRequests++; });
  await page.goto('/');
  await page.getByRole('button', { name: 'Preferências', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Cookies de análise e desempenho' }).press('Space');
  await page.getByRole('button', { name: 'Salvar preferências', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(scriptRequests).toBe(0);
  expect(await events(page)).toEqual([]);
  await page.getByRole('button', { name: 'Preferências de cookies', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Cookies de publicidade' }).press('Space');
  await page.getByRole('button', { name: 'Salvar preferências', exact: true }).click();
  await expect.poll(() => eventsNamed(page, 'PageView').then((x) => x.length)).toBe(1);
  await page.locator('a[href="/imoveis"]').first().click();
  await expect.poll(() => eventsNamed(page, 'PageView').then((x) => x.length)).toBe(2);
  await page.locator(`a[href="/imoveis/${property.slug}"]`).first().click();
  await expect.poll(() => eventsNamed(page, 'ViewContent').then((x) => x.length)).toBe(1);
  expect((await eventsNamed(page, 'ViewContent'))[0][3]).toMatchObject({ content_ids: [property.id], content_name: property.reference });
  expect((await eventsNamed(page, 'PageView')).length).toBe(3);
  await page.getByRole('link', { name: 'Falar sobre este imóvel', exact: true }).click();
  expect((await eventsNamed(page, 'Contact'))[0][3]).toMatchObject({ content_ids: [property.id], content_type: 'product', content_name: property.reference, cta_type: 'whatsapp', cta_location: 'property_sidebar' });
  await page.getByRole('button', { name: 'Agendar visita', exact: true }).click();
  expect((await eventsNamed(page, 'VisitFormOpen')).length).toBe(1);
  await page.getByRole('button', { name: 'Preparar mensagem no WhatsApp', exact: true }).click();
  expect(await eventsNamed(page, 'VisitRequest')).toHaveLength(0);
  await page.locator('input[name="name"]').fill('Pessoa Teste Privado');
  await page.locator('input[name="phone"]').fill('21912345678');
  await page.locator('input[name="email"]').fill('privado@example.test');
  await page.locator('input[name="date"]').fill('2026-11-20');
  await page.locator('select[name="period"]').selectOption('tarde');
  await page.getByRole('button', { name: 'Preparar mensagem no WhatsApp', exact: true }).click();
  expect((await eventsNamed(page, 'VisitRequest'))[0][3]).toMatchObject({ content_ids: [property.id], cta_type: 'visit_request' });
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.getByRole('button', { name: 'Preferências de cookies', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Cookies de publicidade' }).press('Space');
  await page.getByRole('button', { name: 'Salvar preferências', exact: true }).click();
  const count = (await events(page)).length;
  await page.locator('a[href="/imoveis"]').first().click();
  await expect(page.locator(`a[href="/imoveis/${secondProperty.slug}"]`).first()).toBeVisible();
  expect(await events(page)).toHaveLength(count);
  await page.getByRole('button', { name: 'Preferências de cookies', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Cookies de publicidade' }).press('Space');
  await page.getByRole('button', { name: 'Salvar preferências', exact: true }).click();
  await page.locator(`a[href="/imoveis/${secondProperty.slug}"]`).first().click();
  await expect.poll(() => eventsNamed(page, 'ViewContent').then((x) => x.length)).toBe(2);
  await page.getByRole('link', { name: 'Falar sobre este imóvel', exact: true }).click();
  expect((await eventsNamed(page, 'Contact')).at(-1)?.[3]).toMatchObject({ content_ids: [secondProperty.id], content_name: secondProperty.reference });
  expect(scriptRequests).toBe(1);
  const calls = JSON.stringify(await events(page));
  expect(calls).not.toMatch(/Pessoa Teste|21912345678|privado@example|Lead|Schedule/);
});

for (const path of ['/imoveis/preview/private-test-token', '/contato/mensagem-preparada', '/nao-existe', '/imoveis/nao-existe']) {
  test(`does not load Meta on technical or unavailable route ${path}`, async ({ page }) => {
    await page.addInitScript(({ key, consent }) => localStorage.setItem(key, JSON.stringify(consent)), { key: CONSENT_STORAGE_KEY, consent: acceptAllConsent() });
    await page.goto(path);
    await expect(page.locator('main h1').first()).toBeVisible();
    expect(await page.locator('#clementino-meta-pixel').count()).toBe(0);
    expect(await events(page)).toEqual([]);
  });
}

test('direct property visits wait for consent and a resolved public record', async ({ page }) => {
  await page.goto(`/imoveis/${property.slug}/`);
  await expect(page.locator('h1')).toContainText(property.title);
  expect(await events(page)).toEqual([]);
  await page.getByRole('button', { name: 'Aceitar todos', exact: true }).click();
  await expect.poll(() => eventsNamed(page, 'ViewContent').then((x) => x.length)).toBe(1);
  expect(await eventsNamed(page, 'PageView')).toHaveLength(1);
});

test('contact forms report prepared intent without personal values or a confirmed lead', async ({ page }) => {
  await page.goto('/contato');
  await page.getByRole('button', { name: 'Aceitar todos', exact: true }).click();
  await expect.poll(() => eventsNamed(page, 'PageView').then((x) => x.length)).toBe(1);
  await page.getByRole('button', { name: 'Preparar mensagem no WhatsApp', exact: true }).click();
  expect(await eventsNamed(page, 'ContactRequest')).toHaveLength(0);
  await page.locator('input[name="name"]').fill('Pessoa Teste Privado');
  await page.locator('input[name="phone"]').fill('21912345678');
  await page.locator('input[name="email"]').fill('privado@example.test');
  await page.locator('select[name="subject"]').selectOption({ label: 'Outro assunto' });
  await page.locator('textarea[name="message"]').fill('Mensagem privada para atendimento');
  await page.getByRole('button', { name: 'Preparar mensagem no WhatsApp', exact: true }).click();
  await expect(page).toHaveURL(/mensagem-preparada$/);
  expect(await eventsNamed(page, 'ContactRequest')).toHaveLength(1);
  expect(await eventsNamed(page, 'PageView')).toHaveLength(1);
  expect(JSON.stringify(await events(page))).not.toMatch(/Pessoa Teste|21912345678|privado@example|Mensagem privada|Lead|Schedule/);
});

test('consent from the disclosure before Meta was installed must be renewed', async ({ page }) => {
  await page.addInitScript(({ key, consent }) => localStorage.setItem(key, JSON.stringify(consent)), { key: CONSENT_STORAGE_KEY, consent: { ...acceptAllConsent(), version: 1 } });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Aceitar todos', exact: true })).toBeVisible();
  expect(await page.locator('#clementino-meta-pixel').count()).toBe(0);
});

test('the mobile property bar measures WhatsApp and visit CTAs with the listing reference', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/imoveis/${property.slug}`);
  await page.getByRole('button', { name: 'Aceitar todos', exact: true }).click();
  await expect.poll(() => eventsNamed(page, 'ViewContent').then((x) => x.length)).toBe(1);
  await page.getByRole('link', { name: 'WhatsApp', exact: true }).click();
  expect((await eventsNamed(page, 'Contact'))[0][3]).toMatchObject({ content_ids: [property.id], cta_type: 'whatsapp' });
  await page.getByRole('button', { name: 'Agendar', exact: true }).click();
  expect((await eventsNamed(page, 'VisitFormOpen'))[0][3]).toMatchObject({ content_ids: [property.id], cta_type: 'visit_form' });
});

for (const path of ['/', '/imoveis', '/servicos', '/sobre', '/contato', '/aviso-de-privacidade', '/politica-de-cookies']) {
  test(`every public page measures its header and footer contact CTA with the source ${path}`, async ({ page }) => {
    await page.addInitScript(({ key, consent }) => localStorage.setItem(key, JSON.stringify(consent)), { key: CONSENT_STORAGE_KEY, consent: acceptAllConsent() });
    await page.goto(path);
    await expect.poll(() => eventsNamed(page, 'PageView').then(x => x.length)).toBe(1);
    await page.locator('[data-meta-location="navbar"] a[href^="https://wa.me/"]').first().click();
    await page.locator('footer a[href^="https://wa.me/"]').click();
    const contacts = await eventsNamed(page, 'Contact');
    expect(contacts).toHaveLength(2);
    expect(contacts.map(c => c[3])).toMatchObject([{ page_path: path, cta_location: 'navbar', cta_type: 'whatsapp' }, { page_path: path, cta_location: 'footer', cta_type: 'whatsapp' }]);
    expect(await eventsNamed(page, 'CtaClick')).toHaveLength(2);
    await page.locator('footer').getByRole('button', { name: 'Preferências de cookies', exact: true }).click();
    expect(await eventsNamed(page, 'CtaClick')).toHaveLength(2);
    await page.getByRole('button', { name: 'Fechar preferências', exact: true }).click();
    expect(await eventsNamed(page, 'CtaClick')).toHaveLength(2);
  });
}

test('searches by keyboard and button send Search once, without collecting the query', async ({ page }) => {
  await page.addInitScript(({ key, consent }) => localStorage.setItem(key, JSON.stringify(consent)), { key: CONSENT_STORAGE_KEY, consent: acceptAllConsent() });
  await page.goto('/');
  await expect.poll(() => eventsNamed(page, 'PageView').then(x => x.length)).toBe(1);
  const query = page.getByPlaceholder('Busque por bairro, cidade ou referência');
  await query.fill('privado@example.test');
  expect(await eventsNamed(page, 'CtaClick')).toHaveLength(0);
  await query.press('Enter');
  await expect(page).toHaveURL(/\/imoveis\?q=/);
  expect(await eventsNamed(page, 'Search')).toHaveLength(1);
  expect((await eventsNamed(page, 'Search'))[0][3]).toMatchObject({ page_path: '/', cta_location: 'home_hero', cta_id: 'property_search' });
  const search = page.locator('[data-meta-location="catalog_hero"] form');
  await search.locator('input').fill('outro-privado@example.test');
  await search.getByRole('button', { name: /Buscar/ }).click();
  expect(await eventsNamed(page, 'Search')).toHaveLength(2);
  expect(JSON.stringify(await events(page))).not.toMatch(/privado@example|search_string|\?q=/);
});

test('new listing cards use the destination id and gallery clicks use the resolved current id', async ({ page }) => {
  await page.addInitScript(({ key, consent }) => localStorage.setItem(key, JSON.stringify(consent)), { key: CONSENT_STORAGE_KEY, consent: acceptAllConsent() });
  await page.goto('/imoveis');
  const card = page.locator(`a[data-meta-property-id="${property.id}"]`).first();
  await card.click();
  await expect.poll(() => eventsNamed(page, 'ViewContent').then(x => x.length)).toBe(1);
  expect((await eventsNamed(page, 'CtaClick'))[0][3]).toMatchObject({ cta_type: 'property_open', content_ids: [property.id], target_path: '/imoveis/' + property.slug, page_path: '/imoveis' });
  await page.getByRole('button', { name: 'Próxima foto', exact: true }).click();
  expect((await eventsNamed(page, 'CtaClick')).at(-1)?.[3]).toMatchObject({ cta_location: 'property_gallery', content_ids: [property.id] });
  const related = page.locator(`[data-meta-location="related_properties"] a[data-meta-property-id="${secondProperty.id}"]`);
  await related.click();
  await expect.poll(() => eventsNamed(page, 'ViewContent').then(x => x.length)).toBe(2);
  const click = (await eventsNamed(page, 'CtaClick')).at(-1)![3];
  expect(click).toMatchObject({ content_ids: [secondProperty.id], cta_location: 'related_properties', page_path: '/imoveis/' + property.slug, target_path: '/imoveis/' + secondProperty.slug });
  await page.getByRole('link', { name: 'Falar sobre este imóvel', exact: true }).click();
  expect((await eventsNamed(page, 'Contact')).at(-1)?.[3]).toMatchObject({ content_ids: [secondProperty.id], cta_location: 'property_sidebar', page_path: '/imoveis/' + secondProperty.slug });
});
