import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeProperty, parseBrl, slugify } from './normalizeProperty';
import { makeRawRecord } from './testFixtures';

test('parses Brazilian currency without changing the commercial value', () => {
  assert.equal(parseBrl('R$ 1.190.000'), 1_190_000);
  assert.equal(parseBrl('R$ 1.500'), 1_500);
  assert.equal(parseBrl('Não informado / Isento'), null);
});

test('creates stable ASCII slugs', () => {
  assert.equal(slugify('Jardim América - Apto 52m²'), 'jardim-america-apto-52m2');
});

test('maps source fields and honors an explicit rental override', () => {
  const property = normalizeProperty(makeRawRecord(), 'pasta-3042851381', {
    purposeById: { '3042851381': 'Aluguel' },
  });

  assert.equal(property.id, '3042851381');
  assert.equal(property.reference, '0085');
  assert.equal(property.type, 'Aluguel');
  assert.equal(property.priceValue, 1_500);
  assert.equal(property.beds, 2);
  assert.equal(property.images[0], '/imoveis/3042851381/foto-01.webp');
  assert.equal(property.image, '/imoveis/3042851381/capa.webp');
});

test('preserves multiple operations, IPTU, coordinates, total area and categorized details', () => {
  const record = makeRawRecord();
  record.caracteristicas_principais.CFT100 = {
    featureId: 'CFT100', label: 'tot.', measure: 'm²', value: '145', icon: 'stotal',
  };
  Object.assign(record.dados_gerais, {
    iptu: 'R$ 613',
    coordenadas: { latitude: '-22.90', longitude: '-43.20' },
  });
  Object.assign(record, {
    operacoes: [
      { finalidade: 'Venda', preco: 'R$ 420.000' },
      { finalidade: 'Aluguel', preco: 'R$ 5.000' },
    ],
    caracteristicas_extras: {
      Ambientes: {
        20228: { featureId: '20228', label: 'Entrada independente', measure: null, value: null },
      },
      Outros: {
        30001: { featureId: '30001', label: 'Andares', measure: null, value: '2' },
      },
    },
  });

  const property = normalizeProperty(record, 'pasta-3042851381', {
    purposeById: { '3042851381': 'Aluguel' },
  });

  assert.deepEqual(property.prices, [
    { type: 'Venda', price: 'R$\u00a0420.000', priceValue: 420_000 },
    { type: 'Aluguel', price: 'R$\u00a05.000 / mês', priceValue: 5_000 },
  ]);
  assert.equal(property.iptuPrice, 613);
  assert.equal(property.totalArea, '145m²');
  assert.equal(property.totalAreaValue, 145);
  assert.equal(property.latitude, -22.9);
  assert.equal(property.longitude, -43.2);
  assert.deepEqual(property.featureGroups, [
    {
      category: 'Ambientes',
      items: [{ label: 'Entrada independente' }],
    },
    {
      category: 'Outros',
      items: [{ label: 'Andares', value: '2' }],
    },
  ]);
  assert.deepEqual(property.features, ['Ambientes — Entrada independente', 'Outros — Andares: 2']);
});

test('does not invent Saiba mais items from primary characteristics', () => {
  const record = makeRawRecord();
  record.caracteristicas_principais.CFT5 = {
    featureId: 'CFT5', label: 'idade do imóvel', measure: null, value: '40', icon: 'antiguedad',
  };

  const property = normalizeProperty(record, 'pasta-3042851381', {
    purposeById: { '3042851381': 'Aluguel' },
  });

  assert.deepEqual(property.featureGroups, []);
  assert.deepEqual(property.features, []);
});

test('rejects invalid or commercially conflicting operations instead of choosing silently', () => {
  const invalidPrice = makeRawRecord();
  invalidPrice.operacoes = [{ finalidade: 'Aluguel', preco: 'a confirmar' }];
  assert.throws(
    () => normalizeProperty(invalidPrice, 'pasta-3042851381', {
      purposeById: { '3042851381': 'Aluguel' },
    }),
    /Preço inválido na operação Aluguel/,
  );

  const missingPurpose = makeRawRecord();
  missingPurpose.operacoes = [{ finalidade: 'Venda', preco: 'R$ 420.000' }];
  assert.throws(
    () => normalizeProperty(missingPurpose, 'pasta-3042851381', {
      purposeById: { '3042851381': 'Aluguel' },
    }),
    /não possui valor para a finalidade Aluguel/,
  );
});

test('converts source HTML line breaks into readable description lines', () => {
  const record = makeRawRecord();
  record.descricao = 'Primeiro parágrafo.<br>Segundo parágrafo.<br />Terceiro parágrafo.';

  const property = normalizeProperty(record, 'pasta-3042851381', {
    purposeById: { '3042851381': 'Aluguel' },
  });

  assert.equal(property.desc, 'Primeiro parágrafo.\nSegundo parágrafo.\nTerceiro parágrafo.');
});

test('removes Imovelweb interface markup and sentences whose values are hidden', () => {
  const record = makeRawRecord();
  record.descricao = [
    'Primeiro parágrafo com informação útil.<br>',
    'Segundo &amp; terceiro parágrafo.<br>',
    "Oportunidade: Valor reduzido de R$ <span class='descripcionDatosAnunciante'><button class='js-verDatos'>Ver dados</button></span> para R$ <span><button>Ver dados</button></span>.",
  ].join('');

  const property = normalizeProperty(record, 'pasta-3042851381', {
    purposeById: { '3042851381': 'Aluguel' },
  });

  assert.equal(
    property.desc,
    'Primeiro parágrafo com informação útil.\nSegundo & terceiro parágrafo.',
  );
  assert.doesNotMatch(property.desc, /<[^>]+>|Ver dados|descripcionDatosAnunciante/i);
});
