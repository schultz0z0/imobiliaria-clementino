import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAuditEntry,
  splitFeatureText,
  summarizeAudit,
  toCharacteristicsExtras,
  validateAuditCoverage,
  type ImovelwebFeatureAudit,
} from './applyImovelwebFeatures';
import { makeRawRecord } from './testFixtures';

test('splits an Imovelweb item into label and value without rewriting the text', () => {
  assert.deepEqual(splitFeatureText('Andares : 4'), { label: 'Andares', value: '4' });
  assert.deepEqual(splitFeatureText('Posição do Apto : Frente'), { label: 'Posição do Apto', value: 'Frente' });
  assert.deepEqual(splitFeatureText('Aceita FGTS'), { label: 'Aceita FGTS' });
});

test('converts groups to ordered deterministic caracteristicas_extras', () => {
  const extras = toCharacteristicsExtras([
    { category: 'Áreas privativas', items: ['Ar condicionado', 'Área de serviço'] },
    { category: 'Outros', items: ['Andares : 1'] },
  ]);

  assert.deepEqual(extras, {
    'Áreas privativas': {
      IW_01_001: { featureId: 'IW_01_001', label: 'Ar condicionado', measure: null, value: null, icon: null },
      IW_01_002: { featureId: 'IW_01_002', label: 'Área de serviço', measure: null, value: null, icon: null },
    },
    Outros: {
      IW_02_001: { featureId: 'IW_02_001', label: 'Andares', measure: null, value: '1', icon: null },
    },
  });
});

test('applies only the audited characteristics and preserves all commercial content', () => {
  const record = makeRawRecord();
  record.caracteristicas_extras = {
    Aleatório: {
      old: { featureId: 'old', label: 'Dado antigo', measure: null, value: null },
    },
  };

  const updated = applyAuditEntry(record, {
    id: '3042851381',
    url: 'https://www.imovelweb.com.br/propriedades/exemplo-3042851381.html',
    status: 'captured',
    groups: [{ category: 'Outros', items: ['Aceita FGTS'] }],
  });

  assert.deepEqual(updated.dados_gerais, record.dados_gerais);
  assert.deepEqual(updated.fotos, record.fotos);
  assert.deepEqual(updated.caracteristicas_extras, {
    Outros: {
      IW_01_001: { featureId: 'IW_01_001', label: 'Aceita FGTS', measure: null, value: null, icon: null },
    },
  });
});

test('removes generic characteristics when the source has no Saiba mais section', () => {
  const record = makeRawRecord();
  record.caracteristicas_extras = {
    Outros: {
      old: { featureId: 'old', label: 'idade do imóvel', measure: null, value: '40' },
    },
  };

  const updated = applyAuditEntry(record, {
    id: '3042851381',
    url: 'https://www.imovelweb.com.br/propriedades/exemplo-3042851381.html',
    status: 'no-section',
    groups: [],
  });

  assert.deepEqual(updated.caracteristicas_extras, {});
});

test('preserves explicitly audited legacy characteristics for a finalized listing', () => {
  const record = makeRawRecord();
  const updated = applyAuditEntry(record, {
    id: '3042851381',
    url: 'https://www.imovelweb.com.br/propriedades/exemplo-3042851381.html',
    status: 'preserved',
    note: 'Anúncio finalizado; dados preservados do conteúdo anterior.',
    groups: [{ category: 'Áreas privativas', items: ['Quintal'] }],
  });

  assert.deepEqual(updated.caracteristicas_extras, {
    'Áreas privativas': {
      IW_01_001: { featureId: 'IW_01_001', label: 'Quintal', measure: null, value: null, icon: null },
    },
  });
});

test('requires exact 1:1 coverage, matching URLs and usable statuses', () => {
  const sources = [
    { id: '1', url: 'https://www.imovelweb.com.br/propriedades/um-1.html' },
    { id: '2', url: 'https://www.imovelweb.com.br/propriedades/dois-2.html' },
  ];
  const valid: ImovelwebFeatureAudit = {
    generatedAt: '2026-08-27T00:00:00.000Z',
    properties: [
      { id: '1', url: sources[0].url, status: 'captured', groups: [{ category: 'Outros', items: ['Aceita FGTS'] }] },
      { id: '2', url: sources[1].url, status: 'no-section', groups: [] },
    ],
  };

  assert.doesNotThrow(() => validateAuditCoverage(sources, valid));
  assert.throws(() => validateAuditCoverage(sources, {
    ...valid,
    properties: [valid.properties[0]],
  }), /cobertura.*2.*1/i);
  assert.throws(() => validateAuditCoverage(sources, {
    ...valid,
    properties: [valid.properties[0], { ...valid.properties[1], url: 'https://example.com/errada' }],
  }), /URL divergente/i);
  assert.throws(() => validateAuditCoverage(sources, {
    ...valid,
    properties: [valid.properties[0], { ...valid.properties[1], status: 'unavailable' }],
  }), /indisponível/i);
  assert.throws(() => validateAuditCoverage(sources, {
    ...valid,
    properties: [valid.properties[0], { ...valid.properties[0] }],
  }), /duplicado/i);

  assert.doesNotThrow(() => validateAuditCoverage(sources, {
    ...valid,
    properties: [
      valid.properties[0],
      { ...valid.properties[1], status: 'preserved', note: 'Anúncio finalizado.', groups: [] },
    ],
  }));
  assert.throws(() => validateAuditCoverage(sources, {
    ...valid,
    properties: [
      valid.properties[0],
      { ...valid.properties[1], status: 'preserved', groups: [] },
    ],
  }), /justificativa/i);
});

test('reports captured, empty and preserved listings separately', () => {
  const audit: ImovelwebFeatureAudit = {
    generatedAt: '2026-08-27T00:00:00.000Z',
    properties: [
      { id: '1', url: 'https://example.com/1', status: 'captured', groups: [{ category: 'Outros', items: ['Aceita FGTS'] }] },
      { id: '2', url: 'https://example.com/2', status: 'no-section', groups: [] },
      { id: '3', url: 'https://example.com/3', status: 'preserved', note: 'Finalizado.', groups: [] },
    ],
  };

  assert.deepEqual(summarizeAudit(audit), { total: 3, captured: 1, noSection: 1, preserved: 1 });
});
