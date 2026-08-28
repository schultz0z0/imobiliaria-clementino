import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { makeRawRecord } from './testFixtures';
import {
  applyEditorialEntry,
  syncEditorialMarkdown,
  validateEditorialAuditCoverage,
  validateEditorialText,
  type EditorialAudit,
} from './applyEditorialReview';

const source = {
  id: '3043564937',
  title: 'Título antigo',
};

const validAudit: EditorialAudit = {
  generatedAt: '2026-08-27T00:00:00.000Z',
  properties: [{
    id: '3043564937',
    title: 'Apartamento em Parque Columbia — Rua Ruanda, térreo e de frente',
    description: 'Apartamento térreo e de frente, com ambientes bem distribuídos.\nA unidade possui as características descritas no anúncio original.',
  }],
};

test('changes only title and description while preserving the immutable identity and commercial data', () => {
  const record = makeRawRecord();
  record.dados_gerais.id_imovelweb = '3043564937';
  const original = structuredClone(record);

  const updated = applyEditorialEntry(record, validAudit.properties[0]);

  assert.equal(updated.dados_gerais.titulo, validAudit.properties[0].title);
  assert.equal(updated.descricao, validAudit.properties[0].description);

  const withoutEditorialFields = (value: typeof updated) => {
    const clone = structuredClone(value);
    clone.dados_gerais.titulo = '';
    clone.descricao = '';
    return clone;
  };

  assert.deepEqual(withoutEditorialFields(updated), withoutEditorialFields(original));
});

test('requires exact 1:1 coverage with unique matching property ids', () => {
  assert.doesNotThrow(() => validateEditorialAuditCoverage([source], validAudit));
  assert.throws(
    () => validateEditorialAuditCoverage([source, { id: '2', title: 'Outro' }], validAudit),
    /cobertura/i,
  );
  assert.throws(
    () => validateEditorialAuditCoverage([source], {
      ...validAudit,
      properties: [validAudit.properties[0], validAudit.properties[0]],
    }),
    /duplicado/i,
  );
  assert.throws(
    () => validateEditorialAuditCoverage([source], {
      ...validAudit,
      properties: [{ ...validAudit.properties[0], id: '999' }],
    }),
    /não corresponde/i,
  );
});

test('rejects titles outside the approved structure and contaminated descriptions', () => {
  assert.doesNotThrow(() => validateEditorialText(
    'Casa em Jardim América — Rua Mozart e quintal privativo',
    'Casa com distribuição funcional e informações verificadas na fonte.',
  ));
  assert.throws(
    () => validateEditorialText('Jardim América - Casa 3 Qtos', 'Descrição válida.'),
    /padrão/i,
  );
  assert.throws(
    () => validateEditorialText(
      'Casa em Jardim América — Rua Mozart',
      'Seguran?a com integra??o e <button>Ver dados</button>.',
    ),
    /corrompida/i,
  );
});

test('synchronizes only the Markdown title and complete-description section', () => {
  const markdown = [
    '# Título antigo',
    '',
    '> **Metadados preservados**',
    '',
    '## Descrição completa',
    '',
    'Descrição antiga.',
    '',
    '## Observações de validação',
    '',
    '- Manter esta observação.',
  ].join('\n');

  const updated = syncEditorialMarkdown(markdown, validAudit.properties[0]);

  assert.match(updated, /^# Apartamento em Parque Columbia — Rua Ruanda, térreo e de frente/m);
  assert.match(updated, /## Descrição completa\n\nApartamento térreo e de frente, com ambientes bem distribuídos\.\nA unidade possui as características descritas no anúncio original\./);
  assert.match(updated, /## Observações de validação\n\n- Manter esta observação\./);
});

test('preserves the input Markdown newline convention during synchronization', () => {
  for (const newline of ['\n', '\r\n']) {
    const markdown = [
      '# Título antigo',
      '',
      '## Descrição completa',
      '',
      'Descrição antiga.',
      '',
      '## Observações de validação',
      '',
      '- Manter esta observação.',
    ].join(newline);

    const updated = syncEditorialMarkdown(markdown, validAudit.properties[0]);

    assert.match(updated, new RegExp(`## Descrição completa${newline}${newline}Apartamento térreo`));
    assert.doesNotMatch(updated, newline === '\r\n' ? /(?<!\r)\n/u : /\r\n/u);
  }
});

test('supports the legacy Markdown description heading', () => {
  const markdown = [
    '# Título antigo',
    '',
    '## 📝 Descrição do Imóvel',
    '',
    'Descrição antiga.',
    '',
    '## 🏢 Contato',
    '',
    'Contato preservado.',
  ].join('\n');

  const updated = syncEditorialMarkdown(markdown, validAudit.properties[0]);

  assert.match(updated, /## 📝 Descrição do Imóvel\n\nApartamento térreo e de frente/);
  assert.match(updated, /## 🏢 Contato\n\nContato preservado\./);
});

test('replaces a description section that extends to the end of a legacy Markdown file', () => {
  const markdown = [
    '# Título antigo',
    '',
    '## 📝 Descrição do Imóvel',
    '',
    'Descrição antiga.',
    '',
    '### Distribuição por pavimento',
    '',
    'Conteúdo antigo.',
  ].join('\n');

  const updated = syncEditorialMarkdown(markdown, validAudit.properties[0]);

  assert.match(updated, /## 📝 Descrição do Imóvel\n\nApartamento térreo e de frente/);
  assert.doesNotMatch(updated, /Conteúdo antigo/);
});

test('keeps both Markdown records synchronized with the 53 approved editorial entries', () => {
  const contentRoot = resolve('content/imoveis');
  const audit = JSON.parse(readFileSync(
    resolve('docs/audits/2026-08-27-property-editorial-review.json'),
    'utf8',
  )) as EditorialAudit;
  const auditById = new Map(audit.properties.map((entry) => [entry.id, entry]));
  const directories = readdirSync(contentRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory());

  assert.equal(directories.length, 53);
  for (const directory of directories) {
    const propertyRoot = resolve(contentRoot, directory.name);
    const record = JSON.parse(readFileSync(resolve(propertyRoot, 'dados_imovel.json'), 'utf8'));
    const entry = auditById.get(record.dados_gerais.id_imovelweb);
    assert.ok(entry, `auditoria ausente para ${record.dados_gerais.id_imovelweb}`);

    for (const markdownName of ['README.md', 'imovel.md']) {
      const markdown = readFileSync(resolve(propertyRoot, markdownName), 'utf8');
      assert.equal(
        syncEditorialMarkdown(markdown, entry),
        markdown,
        `${markdownName} divergente para ${entry.id}`,
      );
    }
  }
});
