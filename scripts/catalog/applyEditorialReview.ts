import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { RawPropertyRecord } from './sourceTypes';

export interface EditorialAuditEntry {
  id: string;
  title: string;
  description: string;
}

export interface EditorialAudit {
  generatedAt: string;
  properties: EditorialAuditEntry[];
}

interface CatalogSourceIdentity {
  id: string;
  title: string;
}

const titlePattern = /^[^—\n]{3,48} em [^—\n]{2,64} — [^—\n]{3,110}$/u;
const contaminatedMarkup = /<[^>]+>|descripcionDatosAnunciante|\bVer dados\b/i;
const contaminatedEncoding = /\uFFFD|Ã|Â|\p{L}\?+\p{L}/u;

export const validateEditorialText = (title: string, description: string): void => {
  if (!titlePattern.test(title.trim())) {
    throw new Error(`Título fora do padrão editorial aprovado: ${title}.`);
  }
  if (!description.trim() || contaminatedMarkup.test(description) || contaminatedEncoding.test(description)) {
    throw new Error(`Descrição vazia ou corrompida para o título: ${title}.`);
  }
};

export const applyEditorialEntry = (
  record: RawPropertyRecord,
  entry: EditorialAuditEntry,
): RawPropertyRecord => {
  if (record.dados_gerais.id_imovelweb !== entry.id) {
    throw new Error(`ID editorial ${entry.id} não corresponde ao imóvel ${record.dados_gerais.id_imovelweb}.`);
  }
  validateEditorialText(entry.title, entry.description);
  return {
    ...record,
    dados_gerais: {
      ...record.dados_gerais,
      titulo: entry.title.trim(),
    },
    descricao: entry.description.trim(),
  };
};

export const syncEditorialMarkdown = (
  markdown: string,
  entry: EditorialAuditEntry,
): string => {
  const withTitle = markdown.replace(/^# .+$/m, `# ${entry.title}`);
  const descriptionSection = /(^## (?:Descrição completa|📝 Descrição do Imóvel)\s*\r?\n\r?\n)[\s\S]*?(?=\r?\n## |(?![\s\S]))/m;
  if (!descriptionSection.test(withTitle)) {
    throw new Error(`Seção de descrição completa ausente no Markdown do imóvel ${entry.id}.`);
  }
  return withTitle.replace(
    descriptionSection,
    (_match, heading: string) => `${heading}${entry.description.trim()}\n`,
  );
};

export const validateEditorialAuditCoverage = (
  sources: CatalogSourceIdentity[],
  audit: EditorialAudit,
): void => {
  const ids = audit.properties.map((entry) => entry.id);
  const duplicateId = ids.find((id, index) => ids.indexOf(id) !== index);
  if (duplicateId) throw new Error(`ID duplicado na auditoria editorial: ${duplicateId}.`);

  if (audit.properties.length !== sources.length) {
    throw new Error(`Cobertura inválida: catálogo possui ${sources.length} imóveis, auditoria possui ${audit.properties.length}.`);
  }

  const sourceById = new Map(sources.map((source) => [source.id, source]));
  for (const entry of audit.properties) {
    if (!sourceById.has(entry.id)) {
      throw new Error(`ID editorial ${entry.id} não corresponde a nenhum imóvel do catálogo.`);
    }
    validateEditorialText(entry.title, entry.description);
  }
};

const run = (auditPath: string, write: boolean): void => {
  const contentRoot = resolve('content/imoveis');
  const files = readdirSync(contentRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(contentRoot, entry.name, 'dados_imovel.json'));
  const records = files.map((file) => ({
    file,
    record: JSON.parse(readFileSync(file, 'utf8')) as RawPropertyRecord,
  }));
  const sources = records.map(({ record }) => ({
    id: record.dados_gerais.id_imovelweb,
    title: record.dados_gerais.titulo,
  }));
  const audit = JSON.parse(readFileSync(resolve(auditPath), 'utf8')) as EditorialAudit;
  validateEditorialAuditCoverage(sources, audit);
  const auditById = new Map(audit.properties.map((entry) => [entry.id, entry]));

  for (const { file, record } of records) {
    const entry = auditById.get(record.dados_gerais.id_imovelweb)!;
    const updated = applyEditorialEntry(record, entry);
    if (write) {
      writeFileSync(file, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');
      for (const markdownName of ['imovel.md', 'README.md']) {
        const markdownPath = resolve(dirname(file), markdownName);
        if (!existsSync(markdownPath)) continue;
        const markdown = readFileSync(markdownPath, 'utf8');
        writeFileSync(markdownPath, syncEditorialMarkdown(markdown, entry), 'utf8');
      }
    }
  }

  console.log(`Revisão editorial validada: ${records.length} imóveis${write ? ' atualizados' : ''}.`);
};

const isMain = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false;

if (isMain) {
  const auditPath = process.argv.find((argument) => argument.endsWith('.json'));
  if (!auditPath) throw new Error('Uso: tsx scripts/catalog/applyEditorialReview.ts [--write] <auditoria.json>');
  run(auditPath, process.argv.includes('--write'));
}
