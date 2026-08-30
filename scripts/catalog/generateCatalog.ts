import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateAllImages } from './generateImages';
import { loadCatalogSource } from './loadCatalogSource';
import type { CatalogOverrides } from './sourceTypes';
import { matchesGeneratedCatalog } from './verifyGeneratedCatalog';
import { createLegacyContentSourceFromSiteRoot } from './legacyContentSource';

const run = async (): Promise<void> => {
  const mode = process.argv.includes('--write') ? 'write' : process.argv.includes('--verify') ? 'verify' : null;
  if (!mode) throw new Error('Use --write ou --verify.');

  const scriptDirectory = dirname(fileURLToPath(import.meta.url));
  const siteRoot = resolve(scriptDirectory, '..', '..');
  const overrides = JSON.parse(
    readFileSync(join(siteRoot, 'content', 'catalog-overrides.json'), 'utf8'),
  ) as CatalogOverrides;
  const source = createLegacyContentSourceFromSiteRoot(siteRoot, overrides, 53);
  const properties = await source.loadPublishedProperties();
  const entries = loadCatalogSource(join(siteRoot, 'content', 'imoveis'));
  /* validation is performed by the source adapter above. */
  /*
  const validation = validateCatalog(entries, overrides, 53);
  if (validation.errors.length > 0) {
    for (const current of validation.errors) console.error(`[${current.code}] ${current.message}`);
    throw new Error(`Catálogo inválido: ${validation.errors.length} erro(s).`);
  }

  const properties = [...validation.properties].sort((left, right) => left.id.localeCompare(right.id));
  */
  const serialized = `${JSON.stringify(properties, null, 2)}\n`;
  const catalogPath = join(siteRoot, 'src', 'data', 'properties.generated.json');

  if (mode === 'verify') {
    let current = '';
    try {
      current = readFileSync(catalogPath, 'utf8');
    } catch {
      // A mensagem única abaixo explica também o caso de arquivo ausente.
    }
    if (!matchesGeneratedCatalog(current, serialized)) {
      throw new Error('Catálogo gerado desatualizado; execute npm run catalog:generate.');
    }
    console.log(`Catálogo verificado: ${properties.length} imóveis.`);
    return;
  }

  mkdirSync(dirname(catalogPath), { recursive: true });
  writeFileSync(catalogPath, serialized, 'utf8');
  const imageStats = await generateAllImages(entries, join(siteRoot, 'public', 'imoveis'));
  const reduction = imageStats.sourceBytes > 0
    ? Math.round((1 - imageStats.outputBytes / imageStats.sourceBytes) * 10_000) / 100
    : 0;
  writeFileSync(join(siteRoot, 'catalog-report.json'), `${JSON.stringify({
    properties: properties.length,
    sourcePhotos: entries.reduce((sum, entry) => sum + (entry.record ? entry.record.fotos.length : 0), 0),
    warnings: [],
    ...imageStats,
    reductionPercent: reduction,
  }, null, 2)}\n`, 'utf8');
  console.log(`Catálogo gerado: ${properties.length} imóveis; redução de imagens: ${reduction}%.`);
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
