import assert from 'node:assert/strict';
import test from 'node:test';

import { publicPropertySchema, toPublicPropertyDto } from './apiContract.ts';
import { COMMON_FEATURES, PRIVATE_FEATURES } from './featureCatalog.ts';
import {
  propertyDraftSchema,
  publishablePropertySchema,
  type PropertyDraft,
} from './propertySchema.ts';

const validProperty = (): PropertyDraft => ({
  classification: {
    operations: ['sale', 'rent', 'seasonal', 'auction'],
    type: 'apartment',
    subtype: 'penthouse',
  },
  privateAddress: {
    postalCode: '01310-100',
    state: 'SP',
    city: 'São Paulo',
    district: 'Bela Vista',
    street: 'Avenida Paulista',
    number: '1000',
    complement: 'Apto 101',
    latitude: -23.5614,
    longitude: -46.6559,
  },
  publicLocation: {
    label: 'Bela Vista, São Paulo - SP',
    latitude: -23.56,
    longitude: -46.66,
    precision: 'approximate',
  },
  facts: {
    totalArea: 180,
    usableArea: 150,
    isNew: false,
    ageYears: 8,
    bedrooms: 4,
    bathrooms: 5,
    suites: 3,
    parkingSpaces: 3,
    floors: 20,
    position: 'front',
  },
  features: {
    acceptsFgts: true,
    acceptsExchange: false,
    common: COMMON_FEATURES.map(({ id }) => id),
    private: PRIVATE_FEATURES.map(({ id }) => id),
  },
  editorial: {
    title: 'Cobertura com quatro suítes na Bela Vista',
    description:
      'Cobertura ampla, iluminada e bem distribuída, com ambientes integrados, varanda e localização conveniente para a rotina da família.',
    reference: 'CLI-0001',
    featured: true,
  },
  pricing: {
    sale: 2_500_000,
    rent: 12_000,
    seasonal: 1_500,
    auction: 1_800_000,
    condominium: 2_300,
    iptu: 950,
  },
  media: {
    orderedPhotoIds: ['photo-front', 'photo-living-room'],
    coverPhotoId: 'photo-front',
  },
  seo: {
    title: 'Cobertura à venda na Bela Vista | Clementino Imóveis',
    description: 'Conheça esta cobertura com quatro suítes, varanda e três vagas na Bela Vista.',
    imagePhotoId: 'photo-front',
  },
});

test('accepts every operation, canonical field, approved feature and SEO override', () => {
  const parsed = propertyDraftSchema.parse(validProperty());

  assert.deepEqual(parsed.classification.operations, ['sale', 'rent', 'seasonal', 'auction']);
  assert.equal(parsed.facts.position, 'front');
  assert.deepEqual(parsed.features.common, COMMON_FEATURES.map(({ id }) => id));
  assert.deepEqual(parsed.features.private, PRIVATE_FEATURES.map(({ id }) => id));
  assert.equal(parsed.media.coverPhotoId, 'photo-front');
  assert.equal(parsed.seo.imagePhotoId, 'photo-front');
});

test('accepts each approved property type, subtype and position', () => {
  for (const type of ['apartment', 'house', 'commercial', 'rural', 'land'] as const) {
    const property = validProperty();
    property.classification.type = type;
    property.classification.subtype = 'standard';
    assert.equal(propertyDraftSchema.safeParse(property).success, true, type);
  }

  for (const subtype of [
    'penthouse',
    'duplex',
    'flat',
    'garden',
    'studio',
    'loft',
    'standard',
    'room',
    'triplex',
  ] as const) {
    const property = validProperty();
    property.classification.type = 'apartment';
    property.classification.subtype = subtype;
    assert.equal(propertyDraftSchema.safeParse(property).success, true, subtype);
  }

  for (const position of ['front', 'back', 'side', 'middle'] as const) {
    const property = validProperty();
    property.facts.position = position;
    assert.equal(propertyDraftSchema.safeParse(property).success, true, position);
  }
});

test('rejects subtype combinations outside the conservative type matrix', () => {
  for (const [type, subtype] of [
    ['house', 'penthouse'],
    ['commercial', 'duplex'],
    ['rural', 'loft'],
    ['land', 'room'],
  ] as const) {
    const property = validProperty();
    property.classification.type = type;
    property.classification.subtype = subtype;
    assert.equal(propertyDraftSchema.safeParse(property).success, false, `${type}/${subtype}`);
  }

  const publicProperty = toPublicPropertyDto(validProperty());
  publicProperty.classification.type = 'land';
  publicProperty.classification.subtype = 'penthouse';
  assert.equal(publicPropertySchema.safeParse(publicProperty).success, false);
});

test('requires at least one operation and the corresponding operation prices', () => {
  const withoutOperation = validProperty();
  withoutOperation.classification.operations = [];
  assert.equal(propertyDraftSchema.safeParse(withoutOperation).success, false);

  for (const operation of ['sale', 'rent', 'seasonal', 'auction'] as const) {
    const property = validProperty();
    property.classification.operations = [operation];
    delete property.pricing[operation];
    assert.equal(propertyDraftSchema.safeParse(property).success, false, operation);
  }
});

test('rejects age for a new property and invalid counters or areas', () => {
  const newWithAge = validProperty();
  newWithAge.facts.isNew = true;
  assert.equal(propertyDraftSchema.safeParse(newWithAge).success, false);

  for (const field of ['bedrooms', 'bathrooms', 'suites', 'parkingSpaces'] as const) {
    const property = validProperty();
    property.facts[field] = -1;
    assert.equal(propertyDraftSchema.safeParse(property).success, false, field);
  }

  const tooManySuites = validProperty();
  tooManySuites.facts.suites = tooManySuites.facts.bedrooms + 1;
  assert.equal(propertyDraftSchema.safeParse(tooManySuites).success, false);

  const usableExceedsTotal = validProperty();
  usableExceedsTotal.facts.usableArea = usableExceedsTotal.facts.totalArea! + 1;
  assert.equal(propertyDraftSchema.safeParse(usableExceedsTotal).success, false);
});

test('enforces editorial quality and non-negative monetary values', () => {
  const weakDescription = validProperty();
  weakDescription.editorial.description = 'Imóvel bom.';
  assert.equal(propertyDraftSchema.safeParse(weakDescription).success, false);

  const negativeIptu = validProperty();
  negativeIptu.pricing.iptu = -1;
  assert.equal(propertyDraftSchema.safeParse(negativeIptu).success, false);
});

test('requires unique ordered photos and exactly one valid cover when photos exist', () => {
  const missingCover = validProperty();
  delete missingCover.media.coverPhotoId;
  assert.equal(propertyDraftSchema.safeParse(missingCover).success, false);

  const duplicatePhoto = validProperty();
  duplicatePhoto.media.orderedPhotoIds = ['photo-front', 'photo-front'];
  assert.equal(propertyDraftSchema.safeParse(duplicatePhoto).success, false);

  const foreignCover = validProperty();
  foreignCover.media.coverPhotoId = 'not-in-gallery';
  assert.equal(propertyDraftSchema.safeParse(foreignCover).success, false);

  const noPhotos = validProperty();
  noPhotos.media = { orderedPhotoIds: [] };
  noPhotos.seo = {};
  assert.equal(propertyDraftSchema.safeParse(noPhotos).success, true);
});

test('requires the SEO image to belong to the ordered photo set', () => {
  const property = validProperty();
  property.seo.imagePhotoId = 'not-in-gallery';
  assert.equal(propertyDraftSchema.safeParse(property).success, false);
});

test('rejects duplicate or unknown feature ids', () => {
  const duplicate = validProperty();
  duplicate.features.common = ['barbecue', 'barbecue'];
  assert.equal(propertyDraftSchema.safeParse(duplicate).success, false);

  const unknown = validProperty();
  (unknown.features.private as string[]).splice(0, Infinity, 'external-platform-feature');
  assert.equal(propertyDraftSchema.safeParse(unknown).success, false);
});

test('rejects Imovelweb keys and URLs anywhere in the canonical payload', () => {
  const forbiddenKey = {
    ...validProperty(),
    id_imovelweb: '123456',
  };
  assert.equal(propertyDraftSchema.safeParse(forbiddenKey).success, false);

  const forbiddenUrl = validProperty();
  forbiddenUrl.editorial.description =
    'Cobertura ampla e bem distribuída. Veja informações adicionais em https://www.imovelweb.com.br/propriedades/exemplo-123.html antes de visitar.';
  assert.equal(propertyDraftSchema.safeParse(forbiddenUrl).success, false);
});

test('uses the same complete domain rules for publishable properties', () => {
  assert.equal(publishablePropertySchema.safeParse(validProperty()).success, true);

  const invalid = validProperty();
  invalid.editorial.description = 'Curta demais.';
  assert.equal(publishablePropertySchema.safeParse(invalid).success, false);
});

test('creates a public DTO without any exact address block or private coordinates', () => {
  const dto = toPublicPropertyDto(validProperty());
  const serialized = JSON.stringify(dto);

  assert.equal('privateAddress' in dto, false);
  assert.equal(serialized.includes('Avenida Paulista'), false);
  assert.equal(serialized.includes('Apto 101'), false);
  assert.equal(serialized.includes('-23.5614'), false);
  assert.equal(dto.publicLocation.precision, 'approximate');
});

test('rejects Imovelweb URLs at the public API contract boundary', () => {
  const dto = toPublicPropertyDto(validProperty());
  dto.editorial.description =
    'Cobertura ampla e bem distribuída. Consulte https://www.imovelweb.com.br/propriedades/exemplo-123.html para detalhes antes da visita.';

  assert.equal(publicPropertySchema.safeParse(dto).success, false);
});

test('rejects public coordinates that reproduce the private exact position', () => {
  const property = validProperty();
  property.publicLocation.latitude = property.privateAddress.latitude;
  property.publicLocation.longitude = property.privateAddress.longitude;

  assert.equal(propertyDraftSchema.safeParse(property).success, false);
});

test('rejects public labels containing private street, number or complement', () => {
  for (const label of [
    'Avenida Paulista, 1000 - Apto 101',
    'Bela Vista, São Paulo - SP, Avenida Paulista',
    'Bela Vista, São Paulo - SP, número 1000',
    'Bela Vista, São Paulo - SP, Apto 101',
  ]) {
    const property = validProperty();
    property.publicLocation.label = label;
    assert.equal(propertyDraftSchema.safeParse(property).success, false, label);
  }
});

test('rejects incomplete coordinate pairs and positions that remain almost exact', () => {
  const incompletePrivate = validProperty();
  delete incompletePrivate.privateAddress.longitude;
  assert.equal(propertyDraftSchema.safeParse(incompletePrivate).success, false);

  const incompletePublic = validProperty();
  delete incompletePublic.publicLocation.longitude;
  assert.equal(propertyDraftSchema.safeParse(incompletePublic).success, false);

  const almostExact = validProperty();
  almostExact.publicLocation.latitude = almostExact.privateAddress.latitude! + 0.0009;
  almostExact.publicLocation.longitude = almostExact.privateAddress.longitude! - 0.0009;
  assert.equal(propertyDraftSchema.safeParse(almostExact).success, false);
});

test('public schema rejects incomplete coordinate pairs directly', () => {
  const latitudeOnly = toPublicPropertyDto(validProperty());
  delete latitudeOnly.publicLocation.longitude;
  assert.equal(publicPropertySchema.safeParse(latitudeOnly).success, false);

  const longitudeOnly = toPublicPropertyDto(validProperty());
  delete longitudeOnly.publicLocation.latitude;
  assert.equal(publicPropertySchema.safeParse(longitudeOnly).success, false);
});

test('allows a complement that coincides with the district and parses its DTO', () => {
  const property = validProperty();
  property.privateAddress.complement = property.privateAddress.district;

  assert.equal(propertyDraftSchema.safeParse(property).success, true);
  const dto = toPublicPropertyDto(property);
  assert.equal(dto.publicLocation.label, 'Bela Vista, São Paulo - SP');
});

test('forces the public DTO label from district, city and state', () => {
  const property = validProperty();
  property.publicLocation.label = 'Avenida Paulista, 1000, Apto 101';

  const dto = toPublicPropertyDto(property);

  assert.equal(dto.publicLocation.label, 'Bela Vista, São Paulo - SP');
  assert.equal(JSON.stringify(dto).includes('Avenida Paulista'), false);
  assert.equal(JSON.stringify(dto).includes('1000'), false);
  assert.equal(JSON.stringify(dto).includes('Apto 101'), false);
});

test('public schema rejects missing operation price, incoherent suites and photos without cover', () => {
  const saleWithoutPrice = toPublicPropertyDto(validProperty());
  delete saleWithoutPrice.pricing.sale;
  assert.equal(publicPropertySchema.safeParse(saleWithoutPrice).success, false);

  const tooManySuites = toPublicPropertyDto(validProperty());
  tooManySuites.facts.suites = tooManySuites.facts.bedrooms + 1;
  assert.equal(publicPropertySchema.safeParse(tooManySuites).success, false);

  const photosWithoutCover = toPublicPropertyDto(validProperty());
  delete photosWithoutCover.media.coverPhotoId;
  assert.equal(publicPropertySchema.safeParse(photosWithoutCover).success, false);
});

test('public schema retains the remaining canonical cross-field refinements', () => {
  const duplicateOperation = toPublicPropertyDto(validProperty());
  duplicateOperation.classification.operations = ['sale', 'sale'];
  assert.equal(publicPropertySchema.safeParse(duplicateOperation).success, false);

  const newWithAge = toPublicPropertyDto(validProperty());
  newWithAge.facts.isNew = true;
  assert.equal(publicPropertySchema.safeParse(newWithAge).success, false);

  const invalidAreas = toPublicPropertyDto(validProperty());
  invalidAreas.facts.usableArea = invalidAreas.facts.totalArea! + 1;
  assert.equal(publicPropertySchema.safeParse(invalidAreas).success, false);

  const duplicateFeature = toPublicPropertyDto(validProperty());
  duplicateFeature.features.common = ['barbecue', 'barbecue'];
  assert.equal(publicPropertySchema.safeParse(duplicateFeature).success, false);

  const duplicatePhoto = toPublicPropertyDto(validProperty());
  duplicatePhoto.media.orderedPhotoIds = ['photo-front', 'photo-front'];
  assert.equal(publicPropertySchema.safeParse(duplicatePhoto).success, false);

  const foreignSeoImage = toPublicPropertyDto(validProperty());
  foreignSeoImage.seo.imagePhotoId = 'not-in-gallery';
  assert.equal(publicPropertySchema.safeParse(foreignSeoImage).success, false);
});
