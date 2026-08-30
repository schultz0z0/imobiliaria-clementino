import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDefaultImport } from './buildPropertyImport.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const entries = loadDefaultImport(root);
const dryRun = process.argv.includes('--dry-run');
const report = { generatedAt: new Date().toISOString(), dryRun, total: entries.length, entries, redactedFields: ['imovelwebUrl', 'google_maps_url', 'originalMediaUrl'], warnings: [] as string[] };
const output = resolve(root, 'docs', 'audits', 'property-admin-migration.json');
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`${dryRun ? 'Auditoria' : 'Importação preparada'} gerada para ${entries.length} imóveis em ${output}`);

