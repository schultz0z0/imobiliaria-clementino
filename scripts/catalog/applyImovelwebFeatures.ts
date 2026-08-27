import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { RawFeature, RawPropertyRecord } from './sourceTypes';

export interface ImovelwebFeatureGroup {
  category: string;
  items: string[];
}

export interface ImovelwebFeatureAuditEntry {
  id: string;
  url: string;
  status: 'captured' | 'no-section' | 'preserved' | 'unavailable';
  groups: ImovelwebFeatureGroup[];
  primaryFacts?: string[];
  note?: string;
}

export interface ImovelwebFeatureAudit {
  generatedAt: string;
  selectors?: {
    primaryFacts: string;
    extraFeatures: string;
  };
  properties: ImovelwebFeatureAuditEntry[];
}

interface CatalogSourceIdentity {
  id: string;
  url: string;
}

type CharacteristicsExtras = Record<string, Record<string, RawFeature>>;

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

export const splitFeatureText = (text: string): { label: string; value?: string } => {
  const normalized = normalizeWhitespace(text);
  const separator = normalized.match(/^(.+?)\s*:\s*(.+)$/);
  if (!separator) return { label: normalized };
  return { label: separator[1].trim(), value: separator[2].trim() };
};

export const toCharacteristicsExtras = (groups: ImovelwebFeatureGroup[]): CharacteristicsExtras =>
  Object.fromEntries(groups.map((group, groupIndex) => [
    normalizeWhitespace(group.category),
    Object.fromEntries(group.items.map((item, itemIndex) => {
      const { label, value } = splitFeatureText(item);
      const featureId = `IW_${String(groupIndex + 1).padStart(2, '0')}_${String(itemIndex + 1).padStart(3, '0')}`;
      return [featureId, {
        featureId,
        label,
        measure: null,
        value: value ?? null,
        icon: null,
      }];
    })),
  ]));

export const applyAuditEntry = (
  record: RawPropertyRecord,
  entry: ImovelwebFeatureAuditEntry,
): RawPropertyRecord => entry.status === 'unavailable'
  ? record
  : {
      ...record,
      caracteristicas_extras: entry.status === 'captured' || entry.status === 'preserved'
        ? toCharacteristicsExtras(entry.groups)
        : {},
    };

export const validateAuditCoverage = (
  sources: CatalogSourceIdentity[],
  audit: ImovelwebFeatureAudit,
): void => {
  if (audit.properties.length !== sources.length) {
    throw new Error(`Cobertura inválida: catálogo possui ${sources.length} imóveis, auditoria possui ${audit.properties.length}.`);
  }

  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const seen = new Set<string>();
  for (const entry of audit.properties) {
    if (seen.has(entry.id)) throw new Error(`ID duplicado na auditoria: ${entry.id}.`);
    seen.add(entry.id);

    const source = sourceById.get(entry.id);
    if (!source) throw new Error(`Imóvel desconhecido na auditoria: ${entry.id}.`);
    if (source.url !== entry.url) throw new Error(`URL divergente para o imóvel ${entry.id}.`);
    if ((entry.status === 'preserved' || entry.status === 'unavailable') && !entry.note?.trim()) {
      throw new Error(`Imóvel ${entry.id} ${entry.status} sem justificativa.`);
    }
    if (entry.status === 'captured' && entry.groups.length === 0) {
      throw new Error(`Imóvel ${entry.id} marcado como capturado sem grupos.`);
    }
    if (entry.status === 'no-section' && entry.groups.length > 0) {
      throw new Error(`Imóvel ${entry.id} marcado sem seção, mas contém grupos.`);
    }
    for (const group of entry.groups) {
      if (!normalizeWhitespace(group.category) || group.items.length === 0) {
        throw new Error(`Grupo vazio no imóvel ${entry.id}.`);
      }
      if (group.items.some((item) => !normalizeWhitespace(item))) {
        throw new Error(`Item vazio no imóvel ${entry.id}.`);
      }
    }
  }
};

export const summarizeAudit = (audit: ImovelwebFeatureAudit) => ({
  total: audit.properties.length,
  captured: audit.properties.filter((entry) => entry.status === 'captured').length,
  noSection: audit.properties.filter((entry) => entry.status === 'no-section').length,
  preserved: audit.properties.filter((entry) => entry.status === 'preserved').length,
  unavailable: audit.properties.filter((entry) => entry.status === 'unavailable').length,
});

const run = (auditPath: string): void => {
  const contentRoot = resolve('content/imoveis');
  const files = readdirSync(contentRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(contentRoot, entry.name, 'dados_imovel.json'));
  const records = files.map((file) => {
    const record = JSON.parse(readFileSync(file, 'utf8')) as RawPropertyRecord & { url: string };
    return { file, record };
  });
  const sources = records.map(({ record }) => ({
    id: record.dados_gerais.id_imovelweb,
    url: record.url,
  }));
  const audit = JSON.parse(readFileSync(resolve(auditPath), 'utf8')) as ImovelwebFeatureAudit;
  validateAuditCoverage(sources, audit);
  const auditById = new Map(audit.properties.map((entry) => [entry.id, entry]));

  for (const { file, record } of records) {
    const entry = auditById.get(record.dados_gerais.id_imovelweb)!;
    const updated = applyAuditEntry(record, entry);
    writeFileSync(file, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');
  }

  const summary = summarizeAudit(audit);
  console.log(`Características aplicadas: ${summary.total} imóveis (${summary.captured} com seção; ${summary.noSection} sem seção; ${summary.preserved} preservados; ${summary.unavailable} indisponíveis).`);
};

const isMain = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false;

if (isMain) {
  const auditPath = process.argv.find((argument) => argument.endsWith('.json'));
  if (!process.argv.includes('--write') || !auditPath) {
    throw new Error('Uso: tsx scripts/catalog/applyImovelwebFeatures.ts --write <auditoria.json>');
  }
  run(auditPath);
}
