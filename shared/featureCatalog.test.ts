import assert from 'node:assert/strict';
import test from 'node:test';

import {
  COMMON_FEATURES,
  PRIVATE_FEATURES,
  PROPERTY_SUBTYPES,
  PROPERTY_TYPES,
} from './featureCatalog.ts';

const expectedCommonFeatures = [
  ['barbecue', 'Churrasqueira'],
  ['elevator', 'Elevador'],
  ['gym', 'Academia/Sala de ginástica'],
  ['pool', 'Piscina'],
  ['playground', 'Playground'],
  ['party-room', 'Salão de festas'],
  ['accessible', 'Acesso para pessoas com deficiência'],
  ['leisure-area', 'Área de lazer'],
  ['green-area', 'Área verde'],
  ['library', 'Biblioteca'],
  ['bike-rack', 'Bicicletário'],
  ['playroom', 'Brinquedoteca'],
  ['soccer-field', 'Campo de futebol'],
  ['golf-course', 'Campo de golfe'],
  ['security-cameras', 'Câmeras de segurança'],
  ['gourmet-space', 'Espaço gourmet'],
  ['visitor-parking', 'Estacionamento para visitantes'],
  ['oceanfront', 'Frente para o mar'],
  ['guardhouse', 'Guarita'],
  ['laundry', 'Lavanderia'],
  ['concierge-24h', 'Portaria 24 horas'],
  ['near-subway', 'Próximo ao metrô'],
  ['tennis-court', 'Quadra de tênis'],
  ['multisport-court', 'Quadra poliesportiva'],
  ['game-room', 'Salão de jogos'],
  ['sauna', 'Sauna'],
  ['alarm-system', 'Sistema de alarme'],
  ['solarium', 'Solarium'],
  ['spa', 'SPA'],
  ['changing-room', 'Vestiário'],
  ['security-24h', 'Vigilância 24 horas'],
] as const;

const expectedPrivateFeatures = [
  ['air-conditioning', 'Ar-condicionado'],
  ['service-area', 'Área de serviço'],
  ['barbecue', 'Churrasqueira'],
  ['pool', 'Piscina'],
  ['playground', 'Playground'],
  ['balcony', 'Varanda'],
  ['water-heater', 'Aquecedor'],
  ['central-heating', 'Aquecimento central'],
  ['library', 'Biblioteca'],
  ['closet', 'Closet'],
  ['american-kitchen', 'Cozinha americana'],
  ['gourmet-kitchen', 'Cozinha gourmet'],
  ['independent-kitchen', 'Cozinha independente'],
  ['staff-quarters', 'Dependência de empregados'],
  ['pantry', 'Despensa'],
  ['service-entrance', 'Entrada de serviço'],
  ['office', 'Escritório'],
  ['gourmet-space', 'Espaço gourmet'],
  ['freezer', 'Freezer'],
  ['refrigerator', 'Geladeira'],
  ['hot-tub', 'Hidromassagem'],
  ['wi-fi', 'Internet sem fio'],
  ['fireplace', 'Lareira'],
  ['dishwasher', 'Lava-louças'],
  ['laundry', 'Lavanderia'],
  ['mezzanine', 'Mezanino'],
  ['microwave', 'Micro-ondas'],
  ['furnished', 'Mobiliado'],
  ['pets-allowed', 'Permite animais'],
  ['bed-linen', 'Roupa de cama'],
  ['dining-room', 'Sala de jantar'],
  ['alarm-system', 'Sistema de alarme'],
  ['suites', 'Suítes'],
  ['telephone', 'Telefone'],
  ['tv', 'TV'],
] as const;

const pairs = (catalog: ReadonlyArray<{ id: string; label: string }>) =>
  catalog.map(({ id, label }) => [id, label]);

test('publishes the exact approved common-area catalog once and in reference order', () => {
  assert.deepEqual(pairs(COMMON_FEATURES), expectedCommonFeatures);
  assert.equal(new Set(COMMON_FEATURES.map(({ id }) => id)).size, COMMON_FEATURES.length);
  assert.equal(new Set(COMMON_FEATURES.map(({ label }) => label)).size, COMMON_FEATURES.length);
});

test('publishes the exact approved private-area catalog once and in reference order', () => {
  assert.deepEqual(pairs(PRIVATE_FEATURES), expectedPrivateFeatures);
  assert.equal(new Set(PRIVATE_FEATURES.map(({ id }) => id)).size, PRIVATE_FEATURES.length);
  assert.equal(new Set(PRIVATE_FEATURES.map(({ label }) => label)).size, PRIVATE_FEATURES.length);
});

test('publishes only approved property types and subtypes with stable ids and pt-BR labels', () => {
  assert.deepEqual(pairs(PROPERTY_TYPES), [
    ['apartment', 'Apartamento'],
    ['house', 'Casa'],
    ['commercial', 'Comercial'],
    ['rural', 'Rural'],
    ['land', 'Terreno'],
  ]);
  assert.deepEqual(pairs(PROPERTY_SUBTYPES), [
    ['penthouse', 'Cobertura'],
    ['duplex', 'Duplex'],
    ['flat', 'Flat'],
    ['garden', 'Garden'],
    ['studio', 'Kitnet/Studio'],
    ['loft', 'Loft'],
    ['standard', 'Padrão'],
    ['room', 'Quarto'],
    ['triplex', 'Triplex'],
  ]);
});

test('freezes catalog arrays and entries against accidental runtime mutation', () => {
  for (const catalog of [COMMON_FEATURES, PRIVATE_FEATURES, PROPERTY_TYPES, PROPERTY_SUBTYPES]) {
    assert.equal(Object.isFrozen(catalog), true);
    assert.equal(catalog.every(Object.isFrozen), true);
  }
});
