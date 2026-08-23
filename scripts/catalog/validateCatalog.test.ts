import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import test, { afterEach } from 'node:test';
import { loadCatalogSource } from './loadCatalogSource';
import { makeRawRecord } from './testFixtures';
import { validateCatalog } from './validateCatalog';
import type { SourceProperty } from './loadCatalogSource';

const temporaryRoots: string[] = [];

const makeRoot = (): string => {
  const root = mkdtempSync(join(tmpdir(), 'catalog-'));
  temporaryRoots.push(root);
  return root;
};

const makeSourceEntry = (
  root: string,
  options: { id: string; photoPath: string; price: string },
): SourceProperty => {
  const folderPath = join(root, `${options.id}-${Math.random().toString(16).slice(2)}`);
  mkdirSync(join(folderPath, 'fotos'), { recursive: true });
  const record = makeRawRecord();
  record.dados_gerais.id_imovelweb = options.id;
  record.dados_gerais.preco = options.price;
  record.total_fotos = 1;
  record.fotos = [{
    index: 1,
    filename: basename(options.photoPath),
    relative_path: options.photoPath,
    title: 'Foto de teste',
  }];

  if (!options.photoPath.includes('ausente')) {
    writeFileSync(join(folderPath, options.photoPath), 'fixture');
  }

  return { folderName: basename(folderPath), folderPath, record };
};

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

test('reports duplicate ids, missing photos and suspicious prices together', () => {
  const fixtureRoot = makeRoot();
  const result = validateCatalog([
    makeSourceEntry(fixtureRoot, { id: 'REF-1', photoPath: 'fotos/foto_01.jpg', price: 'R$ 10' }),
    makeSourceEntry(fixtureRoot, { id: 'REF-1', photoPath: 'fotos/ausente.jpg', price: 'R$ 900' }),
  ], { purposeById: { 'REF-1': 'Venda' } }, 2);

  assert.ok(result.errors.some((issue) => issue.code === 'duplicate-id'));
  assert.ok(result.errors.some((issue) => issue.code === 'missing-photo'));
  assert.ok(result.warnings.some((issue) => issue.code === 'suspicious-price'));
});

test('does not treat a legitimate monthly rent as a suspicious sale price', () => {
  const fixtureRoot = makeRoot();
  const result = validateCatalog([
    makeSourceEntry(fixtureRoot, { id: 'REF-RENT', photoPath: 'fotos/foto_01.jpg', price: 'R$ 1.500' }),
  ], { purposeById: { 'REF-RENT': 'Aluguel' } }, 1);

  assert.equal(result.warnings.some((issue) => issue.code === 'suspicious-price'), false);
});

test('loads invalid JSON as a reportable source error', () => {
  const fixtureRoot = makeRoot();
  const folderPath = join(fixtureRoot, 'invalid-record');
  mkdirSync(folderPath, { recursive: true });
  writeFileSync(join(folderPath, 'dados_imovel.json'), '{invalid', 'utf8');

  const [entry] = loadCatalogSource(fixtureRoot);
  assert.ok(entry && 'parseError' in entry);
});

test('reports source photo count divergence', () => {
  const fixtureRoot = makeRoot();
  const entry = makeSourceEntry(fixtureRoot, {
    id: 'REF-2',
    photoPath: 'fotos/foto_01.jpg',
    price: 'R$ 250.000',
  });
  if ('record' in entry) entry.record.total_fotos = 2;

  const result = validateCatalog([entry], { purposeById: { 'REF-2': 'Venda' } }, 1);
  assert.ok(result.errors.some((issue) => issue.code === 'photo-count'));
});

test('supports the alternate Portuguese photo and feature schema', () => {
  const fixtureRoot = makeRoot();
  const folderPath = join(fixtureRoot, 'alternate-record');
  mkdirSync(join(folderPath, 'fotos'), { recursive: true });
  writeFileSync(join(folderPath, 'fotos', 'foto_01.jpg'), 'fixture');
  const record = makeRawRecord() as unknown as Record<string, unknown>;
  (record.dados_gerais as Record<string, unknown>).id_imovelweb = '3017305761';
  record.descricao = 'Apartamento disponível para venda.';
  record.fotos = [{
    indice: 1,
    arquivo: 'foto_01.jpg',
    caminho_relativo: 'fotos/foto_01.jpg',
    titulo: 'Apartamento à venda',
  }];
  record.caracteristicas_principais = {
    area_total_m2: 92,
    area_util_m2: 92,
    quartos: 2,
    banheiros: 1,
    vagas_garagem: 1,
    tipo: 'Apartamento Cobertura Duplex',
  };
  record.total_fotos = 1;
  writeFileSync(join(folderPath, 'dados_imovel.json'), JSON.stringify(record), 'utf8');

  const result = validateCatalog(loadCatalogSource(fixtureRoot), { purposeById: {} }, 1);
  assert.deepEqual(result.errors, []);
  assert.equal(result.properties[0]?.areaValue, 92);
  assert.equal(result.properties[0]?.beds, 2);
  assert.equal(result.properties[0]?.images[0], '/imoveis/3017305761/foto-01.webp');
});
