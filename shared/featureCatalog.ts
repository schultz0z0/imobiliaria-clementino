interface CatalogEntry<Id extends string = string> {
  readonly id: Id;
  readonly label: string;
}

const immutableCatalog = <const Catalog extends readonly CatalogEntry[]>(catalog: Catalog): Catalog => {
  catalog.forEach((entry) => Object.freeze(entry));
  return Object.freeze(catalog);
};

export const PROPERTY_TYPES = immutableCatalog([
  { id: 'apartment', label: 'Apartamento' },
  { id: 'house', label: 'Casa' },
  { id: 'commercial', label: 'Comercial' },
  { id: 'rural', label: 'Rural' },
  { id: 'land', label: 'Terreno' },
] as const);

export const PROPERTY_SUBTYPES = immutableCatalog([
  { id: 'penthouse', label: 'Cobertura' },
  { id: 'duplex', label: 'Duplex' },
  { id: 'flat', label: 'Flat' },
  { id: 'garden', label: 'Garden' },
  { id: 'studio', label: 'Kitnet/Studio' },
  { id: 'loft', label: 'Loft' },
  { id: 'standard', label: 'Padrão' },
  { id: 'room', label: 'Quarto' },
  { id: 'triplex', label: 'Triplex' },
] as const);

export type PropertyType = (typeof PROPERTY_TYPES)[number]['id'];
export type PropertySubtype = (typeof PROPERTY_SUBTYPES)[number]['id'];

const immutableSubtypeMatrix = <
  const Matrix extends Record<PropertyType, readonly PropertySubtype[]>,
>(matrix: Matrix): Matrix => {
  Object.values(matrix).forEach((subtypes) => Object.freeze(subtypes));
  return Object.freeze(matrix);
};

// The approved reference defines residential subtypes only. Keep non-residential
// compatibility conservative until the product design explicitly adds new options.
export const PROPERTY_SUBTYPES_BY_TYPE = immutableSubtypeMatrix({
  apartment: [
    'penthouse',
    'duplex',
    'flat',
    'garden',
    'studio',
    'loft',
    'standard',
    'room',
    'triplex',
  ],
  house: ['duplex', 'loft', 'standard', 'room', 'triplex'],
  commercial: ['loft', 'standard', 'room'],
  rural: ['standard'],
  land: ['standard'],
} as const satisfies Record<PropertyType, readonly PropertySubtype[]>);

export const COMMON_FEATURES = immutableCatalog([
  { id: 'barbecue', label: 'Churrasqueira' },
  { id: 'elevator', label: 'Elevador' },
  { id: 'gym', label: 'Academia/Sala de ginástica' },
  { id: 'pool', label: 'Piscina' },
  { id: 'playground', label: 'Playground' },
  { id: 'party-room', label: 'Salão de festas' },
  { id: 'accessible', label: 'Acesso para pessoas com deficiência' },
  { id: 'leisure-area', label: 'Área de lazer' },
  { id: 'green-area', label: 'Área verde' },
  { id: 'library', label: 'Biblioteca' },
  { id: 'bike-rack', label: 'Bicicletário' },
  { id: 'playroom', label: 'Brinquedoteca' },
  { id: 'soccer-field', label: 'Campo de futebol' },
  { id: 'golf-course', label: 'Campo de golfe' },
  { id: 'security-cameras', label: 'Câmeras de segurança' },
  { id: 'gourmet-space', label: 'Espaço gourmet' },
  { id: 'visitor-parking', label: 'Estacionamento para visitantes' },
  { id: 'oceanfront', label: 'Frente para o mar' },
  { id: 'guardhouse', label: 'Guarita' },
  { id: 'laundry', label: 'Lavanderia' },
  { id: 'concierge-24h', label: 'Portaria 24 horas' },
  { id: 'near-subway', label: 'Próximo ao metrô' },
  { id: 'tennis-court', label: 'Quadra de tênis' },
  { id: 'multisport-court', label: 'Quadra poliesportiva' },
  { id: 'game-room', label: 'Salão de jogos' },
  { id: 'sauna', label: 'Sauna' },
  { id: 'alarm-system', label: 'Sistema de alarme' },
  { id: 'solarium', label: 'Solarium' },
  { id: 'spa', label: 'SPA' },
  { id: 'changing-room', label: 'Vestiário' },
  { id: 'security-24h', label: 'Vigilância 24 horas' },
] as const);

export const PRIVATE_FEATURES = immutableCatalog([
  { id: 'air-conditioning', label: 'Ar-condicionado' },
  { id: 'service-area', label: 'Área de serviço' },
  { id: 'barbecue', label: 'Churrasqueira' },
  { id: 'pool', label: 'Piscina' },
  { id: 'playground', label: 'Playground' },
  { id: 'balcony', label: 'Varanda' },
  { id: 'water-heater', label: 'Aquecedor' },
  { id: 'central-heating', label: 'Aquecimento central' },
  { id: 'library', label: 'Biblioteca' },
  { id: 'closet', label: 'Closet' },
  { id: 'american-kitchen', label: 'Cozinha americana' },
  { id: 'gourmet-kitchen', label: 'Cozinha gourmet' },
  { id: 'independent-kitchen', label: 'Cozinha independente' },
  { id: 'staff-quarters', label: 'Dependência de empregados' },
  { id: 'pantry', label: 'Despensa' },
  { id: 'service-entrance', label: 'Entrada de serviço' },
  { id: 'office', label: 'Escritório' },
  { id: 'gourmet-space', label: 'Espaço gourmet' },
  { id: 'freezer', label: 'Freezer' },
  { id: 'refrigerator', label: 'Geladeira' },
  { id: 'hot-tub', label: 'Hidromassagem' },
  { id: 'wi-fi', label: 'Internet sem fio' },
  { id: 'fireplace', label: 'Lareira' },
  { id: 'dishwasher', label: 'Lava-louças' },
  { id: 'laundry', label: 'Lavanderia' },
  { id: 'mezzanine', label: 'Mezanino' },
  { id: 'microwave', label: 'Micro-ondas' },
  { id: 'furnished', label: 'Mobiliado' },
  { id: 'pets-allowed', label: 'Permite animais' },
  { id: 'bed-linen', label: 'Roupa de cama' },
  { id: 'dining-room', label: 'Sala de jantar' },
  { id: 'alarm-system', label: 'Sistema de alarme' },
  { id: 'suites', label: 'Suítes' },
  { id: 'telephone', label: 'Telefone' },
  { id: 'tv', label: 'TV' },
  { id: 'backyard', label: 'Quintal' },
  { id: 'garage', label: 'Garagem' },
] as const);

export type CommonFeatureId = (typeof COMMON_FEATURES)[number]['id'];
export type PrivateFeatureId = (typeof PRIVATE_FEATURES)[number]['id'];
