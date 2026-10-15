import { test, expect } from '@playwright/test';
import { JSDOM } from 'jsdom';
import sharp from 'sharp';

// Explicit opt-in and fixed loopback endpoints prevent accidental listings on
// the real VPS. The dedicated database/server are prepared separately.
test.skip(process.env.CLEMENTINO_ISOLATED_SEO_E2E !== '1', 'Requires the isolated local SEO test environment.');
const site = 'http://127.0.0.1:4184';

test('new admin property automatically gets HTML SEO, sitemap and LLM inventory, including updates and withdrawal', async ({ page, request }, testInfo) => {
  page.on('dialog', (dialog) => dialog.accept());
  const title = `Casa teste SEO automático ${Date.now()}`;
  const next = async (step: string) => {
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await expect(page.locator('#wizard-step-title')).toHaveText(step);
  };
  const description = 'Imóvel fictício criado exclusivamente no ambiente isolado para testar a publicação automática. Casa com dois quartos, sala, cozinha, dois banheiros, quintal e uma vaga, em Jardim América, Rio de Janeiro. Nenhum anúncio ou dado da VPS é alterado durante este teste.';
  await page.goto('/');
  await page.getByLabel('Usuário', { exact: true }).fill('seo-test@example.test');
  await page.getByLabel('Senha', { exact: true }).fill(process.env.SEO_E2E_PASSWORD ?? 'SeoTest!Temporary123');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Crie uma nova senha|Visão geral/ })).toBeVisible();
  if (await page.getByRole('heading', { name: 'Crie uma nova senha' }).isVisible()) {
    await page.getByLabel('Senha atual', { exact: true }).fill('SeoTest!Temporary123');
    await page.getByLabel('Nova senha', { exact: true }).fill('SeoTest!Changed123');
    await page.getByLabel('Confirmar nova senha', { exact: true }).fill('SeoTest!Changed123');
    await page.getByRole('button', { name: 'Salvar nova senha' }).click();
    await expect(page.getByRole('heading', { name: 'Visão geral', exact: true })).toBeVisible({ timeout: 15000 });
  }
  await page.goto('/imoveis/novo');
  await expect(page.getByRole('heading', { name: 'Cadastro de imóvel' })).toBeVisible();
  const sale = page.getByRole('button', { name: 'Venda', exact: true });
  if (await sale.getAttribute('aria-pressed') !== 'true') await sale.click();
  await expect(page).toHaveURL(/\/imoveis\/[^/]+\/editar/);
  await expect(page.getByRole('heading', { name: 'Cadastro de imóvel' })).toBeVisible();
  await page.getByRole('combobox', { name: /Tipo do imóvel/ }).selectOption('house');
  await next('Localização');
  await page.getByLabel('CEP', { exact: true }).fill('21240-010');
  await page.getByLabel('Logradouro', { exact: true }).fill('Rua Professor França Amaral');
  await page.getByLabel('Número (opcional)', { exact: true }).fill('987654');
  await page.getByLabel('Complemento (opcional)', { exact: true }).fill('COMPLEMENTO PRIVADO TESTE');
  await page.getByLabel('Bairro', { exact: true }).fill('Jardim América');
  await page.getByLabel('Cidade', { exact: true }).fill('Rio de Janeiro');
  await page.getByLabel('UF', { exact: true }).fill('RJ');
  await page.getByRole('button', { name: 'Salvar localização', exact: true }).click();
  await next('Fotos');
  const photo = await sharp({ create: { width: 1400, height: 1000, channels: 3, background: '#a4b7bf' } }).jpeg().toBuffer();
  await page.locator('input[type=file]').setInputFiles({ name: 'imovel-teste.jpg', mimeType: 'image/jpeg', buffer: photo });
  await expect(page.getByText('1 foto(s) adicionada(s).', { exact: true })).toBeVisible({ timeout: 30000 });
  await page.getByLabel('Texto alternativo', { exact: true }).fill('Foto do imóvel fictício para teste automático');
  await page.getByRole('heading', { name: 'Fotos do imóvel', exact: true }).click();
  await next('Dados principais');
  await page.getByLabel('Área total (m²)', { exact: true }).fill('120');
  await page.getByLabel('Área útil (m²)', { exact: true }).fill('90');
  await page.getByLabel('Quartos', { exact: true }).fill('2');
  await page.getByLabel('Banheiros', { exact: true }).fill('2');
  await page.getByLabel('Suítes', { exact: true }).fill('1');
  await page.getByLabel('Vagas', { exact: true }).fill('1');
  await next('Características');
  await next('Descrição e valores');
  await page.getByLabel('Título padronizado', { exact: true }).fill(title);
  await page.getByLabel('Descrição completa', { exact: true }).fill(description);
  await page.getByLabel('Preço de Venda (R$)', { exact: true }).fill('432100');
  await next('SEO e revisão');
  // Leave optional SEO fields empty to exercise the automatic structure.
  await page.getByRole('button', { name: 'Concluir rascunho', exact: true }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  const card = page.locator('article').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
  await card.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.getByText('Publicação solicitada.', { exact: false })).toBeVisible();

  let property: any;
  await expect.poll(async () => {
    const data = await (await request.get(site + '/api/public/catalog')).json();
    property = data.properties.find((item: any) => item.title === title);
    return Boolean(property);
  }, { timeout: 45000, intervals: [1000, 2000] }).toBe(true);
  const path = '/imoveis/' + property.slug;
  const canonical = 'https://clementinoimoveis.com.br' + path;
  const html = await request.get(site + path);
  expect(html.status()).toBe(200);
  const document = new JSDOM(await html.text()).window.document;
  expect(document.querySelector('link[rel=canonical]')?.getAttribute('href')).toBe(canonical);
  expect(document.querySelector('h1')?.textContent).toBe(title);
  expect(document.querySelector('#root')?.textContent).toContain(description);
  expect(document.querySelector('#root')?.textContent).toContain('987654');
  expect(document.querySelector('#root')?.textContent).not.toContain('COMPLEMENTO PRIVADO TESTE');
  const schema = JSON.parse(document.querySelector('#clementino-property-structured-data')!.textContent!);
  expect(schema.offers[0].price).toBe(432100);
  expect(schema.address.addressLocality).toBe('Rio de Janeiro');
  expect((await request.get(site + '/sitemap.xml')).status()).toBe(200);
  expect(await (await request.get(site + '/sitemap.xml')).text()).toContain(canonical);
  expect(await (await request.get(site + '/llms-full.txt')).text()).toContain(canonical);
  expect(await (await request.get(site + '/llms.txt')).text()).toContain('CRECI-RJ 22953');
  expect(await (await request.get(site + '/robots.txt')).text()).toContain('Allow: /api/public/media/');
  const image = await request.get(site + property.image);
  expect(image.status()).toBe(200);
  expect(image.headers()['content-type']).toContain('image/webp');
  const publicPage = await page.context().newPage();
  await publicPage.goto(site + path);
  await expect(publicPage.getByRole('heading', { name: title, exact: true })).toBeVisible();
  const rejectCookies = publicPage.getByRole('button', { name: 'Rejeitar não essenciais', exact: true });
  if (await rejectCookies.isVisible()) await rejectCookies.click();
  await publicPage.screenshot({ path: testInfo.outputPath('new-property-desktop.png'), fullPage: true });
  await publicPage.setViewportSize({ width: 390, height: 844 });
  await publicPage.screenshot({ path: testInfo.outputPath('new-property-mobile.png'), fullPage: true });

  await page.reload();
  await card.getByRole('link', { name: 'Editar', exact: true }).click();
  await page.getByRole('button', { name: /Descrição e valores/ }).click();
  await page.getByLabel('Preço de Venda (R$)', { exact: true }).fill('543200');
  await page.getByRole('button', { name: /SEO e revisão/ }).click();
  await page.getByRole('button', { name: 'Concluir rascunho', exact: true }).click();
  await card.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect.poll(async () => {
    const response = await request.get(site + path);
    return (await response.text()).includes('"price":543200');
  }, { timeout: 45000, intervals: [1000, 2000] }).toBe(true);
  expect(await (await request.get(site + '/llms-full.txt')).text()).toContain('543.200');
  await page.reload();
  await card.getByRole('button', { name: 'Inativar', exact: true }).click();
  await expect.poll(async () => (await request.get(site + path)).status(), { timeout: 45000, intervals: [1000, 2000] }).toBe(404);
  expect(await (await request.get(site + '/sitemap.xml')).text()).not.toContain(canonical);
  expect(await (await request.get(site + '/llms-full.txt')).text()).not.toContain(canonical);
  await testInfo.attach('publication-result', { body: JSON.stringify({ title, reference: property.reference, path, initialPrice: 432100, updatedPrice: 543200, withdrawalStatus: 404, productionChanged: false }, null, 2), contentType: 'application/json' });
});
