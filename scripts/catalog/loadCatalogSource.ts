import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { RawFeature, RawPhoto, RawPropertyRecord } from './sourceTypes';

export type SourceProperty =
  | { folderName: string; folderPath: string; record: RawPropertyRecord; parseError?: never }
  | { folderName: string; folderPath: string; record?: never; parseError: string };

const makeFeature = (featureId: string, label: string, value: unknown, measure: string | null = null): RawFeature => ({
  featureId,
  label,
  measure,
  value: value == null ? '0' : String(value),
});

const canonicalizeFeatures = (input: unknown): Record<string, RawFeature> => {
  if (!input || typeof input !== 'object') return {};
  const raw = input as Record<string, unknown>;
  const hasCanonicalFeatures = Object.values(raw).some(
    (value) => value !== null && typeof value === 'object' && 'value' in value,
  );
  if (hasCanonicalFeatures) return raw as Record<string, RawFeature>;

  const features: Record<string, RawFeature> = {
    CFT100: makeFeature('CFT100', 'tot.', raw.area_total_m2, 'm²'),
    CFT101: makeFeature('CFT101', 'útil', raw.area_util_m2, 'm²'),
    CFT2: makeFeature('CFT2', 'quartos', raw.quartos),
    CFT3: makeFeature('CFT3', 'banheiros', raw.banheiros),
    CFT4: makeFeature('CFT4', 'suítes', raw.suites),
    CFT7: makeFeature('CFT7', 'vagas', raw.vagas_garagem),
  };
  const coreKeys = new Set([
    'area_total_m2', 'area_util_m2', 'quartos', 'banheiros', 'suites', 'vagas_garagem', 'tipo',
  ]);
  for (const [key, value] of Object.entries(raw)) {
    if (!coreKeys.has(key) && value === true) {
      const label = key.replace(/_/g, ' ').replace(/^./, (character) => character.toUpperCase());
      features[`EXTRA_${key}`] = makeFeature(`EXTRA_${key}`, label, 'Sim');
    }
  }
  return features;
};

const canonicalizePhoto = (input: unknown, fallbackIndex: number): RawPhoto => {
  const raw = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const relativePath = String(raw.relative_path ?? raw.caminho_relativo ?? '');
  return {
    index: Number(raw.index ?? raw.indice ?? fallbackIndex),
    filename: String(raw.filename ?? raw.arquivo ?? basename(relativePath)),
    relative_path: relativePath,
    title: String(raw.title ?? raw.titulo ?? ''),
    size_bytes: typeof raw.size_bytes === 'number' ? raw.size_bytes : undefined,
    size_kb: typeof raw.size_kb === 'number' ? raw.size_kb : undefined,
    url: typeof raw.url === 'string' ? raw.url : typeof raw.url_original === 'string' ? raw.url_original : undefined,
  };
};

export const canonicalizeSourceRecord = (input: unknown): RawPropertyRecord => {
  if (!input || typeof input !== 'object') throw new Error('O JSON do imóvel deve ser um objeto.');
  const raw = input as Record<string, unknown>;
  const photos = Array.isArray(raw.fotos) ? raw.fotos : [];
  return {
    dados_gerais: raw.dados_gerais as RawPropertyRecord['dados_gerais'],
    caracteristicas_principais: canonicalizeFeatures(raw.caracteristicas_principais),
    descricao: String(raw.descricao ?? ''),
    total_fotos: Number(raw.total_fotos ?? photos.length),
    fotos: photos.map(canonicalizePhoto),
  };
};

export const loadCatalogSource = (contentRoot: string): SourceProperty[] => readdirSync(
  contentRoot,
  { withFileTypes: true },
)
  .filter((entry) => entry.isDirectory())
  .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))
  .map((entry): SourceProperty => {
    const folderPath = join(contentRoot, entry.name);
    const jsonPath = join(folderPath, 'dados_imovel.json');

    try {
      const record = canonicalizeSourceRecord(JSON.parse(readFileSync(jsonPath, 'utf8')));
      return { folderName: entry.name, folderPath, record };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { folderName: entry.name, folderPath, parseError: message };
    }
  });
