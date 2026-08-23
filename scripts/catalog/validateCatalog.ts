import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WebsiteProperty } from '../../src/types/property';
import { loadCatalogSource, type SourceProperty } from './loadCatalogSource';
import { normalizeProperty, parseBrl } from './normalizeProperty';
import type { CatalogOverrides } from './sourceTypes';

export type CatalogIssueCode =
  | 'count'
  | 'invalid-json'
  | 'duplicate-id'
  | 'duplicate-slug'
  | 'missing-field'
  | 'missing-state'
  | 'invalid-purpose'
  | 'missing-photo'
  | 'photo-count'
  | 'negative-value'
  | 'suspicious-price';

export interface CatalogIssue {
  severity: 'error' | 'warning';
  code: CatalogIssueCode;
  propertyId?: string;
  message: string;
}

export interface CatalogValidation {
  properties: WebsiteProperty[];
  errors: CatalogIssue[];
  warnings: CatalogIssue[];
}

const issue = (
  severity: CatalogIssue['severity'],
  code: CatalogIssueCode,
  message: string,
  propertyId?: string,
): CatalogIssue => ({ severity, code, message, propertyId });

const isInside = (parent: string, candidate: string): boolean => {
  const relativePath = relative(resolve(parent), resolve(candidate));
  return relativePath !== '..' && !relativePath.startsWith('..\\') && !relativePath.startsWith('../');
};

export const validateCatalog = (
  entries: SourceProperty[],
  overrides: CatalogOverrides,
  expectedCount = 49,
): CatalogValidation => {
  const errors: CatalogIssue[] = [];
  const warnings: CatalogIssue[] = [];
  const properties: WebsiteProperty[] = [];
  const seenIds = new Set<string>();
  const seenSlugs = new Set<string>();

  if (entries.length !== expectedCount) {
    errors.push(issue('error', 'count', `Esperados ${expectedCount} imóveis; encontrados ${entries.length}.`));
  }

  for (const entry of entries) {
    if ('parseError' in entry) {
      errors.push(issue('error', 'invalid-json', `${entry.folderName}: ${entry.parseError}`));
      continue;
    }

    const { record } = entry;
    const general = record.dados_gerais;
    const id = general?.id_imovelweb?.trim() || entry.folderName;
    let entryHasBlockingError = false;

    if (seenIds.has(id)) {
      errors.push(issue('error', 'duplicate-id', `Identificador duplicado: ${id}.`, id));
      entryHasBlockingError = true;
    }
    seenIds.add(id);

    const requiredFields: Array<[string, unknown]> = [
      ['id_imovelweb', general?.id_imovelweb],
      ['titulo', general?.titulo],
      ['preco', general?.preco],
      ['endereco_completo', general?.endereco_completo],
      ['bairro', general?.bairro],
      ['cidade', general?.cidade],
      ['descricao', record.descricao],
    ];
    for (const [field, value] of requiredFields) {
      if (typeof value !== 'string' || !value.trim()) {
        errors.push(issue('error', 'missing-field', `Campo obrigatório ausente: ${field}.`, id));
        entryHasBlockingError = true;
      }
    }

    if (!general?.estado?.trim()) {
      warnings.push(issue('warning', 'missing-state', 'UF ausente no dado de origem.', id));
    }

    if (!Array.isArray(record.fotos) || record.fotos.length === 0) {
      errors.push(issue('error', 'missing-photo', 'O imóvel não possui fotos.', id));
      entryHasBlockingError = true;
    } else {
      if (record.total_fotos !== record.fotos.length) {
        errors.push(issue(
          'error',
          'photo-count',
          `total_fotos=${record.total_fotos}, mas a lista possui ${record.fotos.length}.`,
          id,
        ));
        entryHasBlockingError = true;
      }

      for (const photo of record.fotos) {
        const photoPath = resolve(entry.folderPath, photo.relative_path);
        if (!isInside(entry.folderPath, photoPath) || !existsSync(photoPath)) {
          errors.push(issue('error', 'missing-photo', `Foto ausente: ${photo.relative_path}.`, id));
          entryHasBlockingError = true;
        }
      }
    }

    for (const feature of Object.values(record.caracteristicas_principais ?? {})) {
      const value = Number(feature.value.replace(',', '.'));
      if (Number.isFinite(value) && value < 0) {
        errors.push(issue('error', 'negative-value', `Característica negativa: ${feature.label}.`, id));
        entryHasBlockingError = true;
      }
    }

    const price = parseBrl(general?.preco ?? '');
    if (price !== null && price > 0 && price < 50_000) {
      warnings.push(issue('warning', 'suspicious-price', `Preço requer revisão: ${general.preco}.`, id));
    }

    try {
      const property = normalizeProperty(record, entry.folderName, overrides);
      if (seenSlugs.has(property.slug ?? '')) {
        errors.push(issue('error', 'duplicate-slug', `Slug duplicado: ${property.slug}.`, id));
        entryHasBlockingError = true;
      }
      seenSlugs.add(property.slug ?? '');
      if (!entryHasBlockingError) properties.push(property);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(issue('error', 'invalid-purpose', message, id));
    }
  }

  return { properties, errors, warnings };
};

const run = (): void => {
  const scriptDirectory = dirname(fileURLToPath(import.meta.url));
  const siteRoot = resolve(scriptDirectory, '..', '..');
  const contentRoot = join(siteRoot, 'content', 'imoveis');
  const overrides = JSON.parse(
    readFileSync(join(siteRoot, 'content', 'catalog-overrides.json'), 'utf8'),
  ) as CatalogOverrides;
  const result = validateCatalog(loadCatalogSource(contentRoot), overrides, 49);

  for (const current of [...result.errors, ...result.warnings]) {
    const prefix = current.severity === 'error' ? 'ERRO' : 'AVISO';
    console.log(`${prefix} [${current.code}]${current.propertyId ? ` ${current.propertyId}` : ''}: ${current.message}`);
  }
  console.log(`Catálogo: ${result.properties.length} válidos, ${result.errors.length} erros, ${result.warnings.length} avisos.`);
  if (result.errors.length > 0) process.exitCode = 1;
};

const entrypoint = process.argv[1] ? resolve(process.argv[1]) : '';
if (entrypoint === fileURLToPath(import.meta.url)) run();
