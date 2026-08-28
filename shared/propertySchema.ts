import { z } from 'zod';

import {
  COMMON_FEATURES,
  PRIVATE_FEATURES,
  PROPERTY_SUBTYPES,
  PROPERTY_TYPES,
  type CommonFeatureId,
  type PrivateFeatureId,
  type PropertySubtype,
  type PropertyType,
} from './featureCatalog.ts';

const PROPERTY_TYPE_IDS = PROPERTY_TYPES.map(({ id }) => id) as [PropertyType, ...PropertyType[]];
const PROPERTY_SUBTYPE_IDS = PROPERTY_SUBTYPES.map(({ id }) => id) as [
  PropertySubtype,
  ...PropertySubtype[],
];
const COMMON_FEATURE_IDS = COMMON_FEATURES.map(({ id }) => id) as [
  CommonFeatureId,
  ...CommonFeatureId[],
];
const PRIVATE_FEATURE_IDS = PRIVATE_FEATURES.map(({ id }) => id) as [
  PrivateFeatureId,
  ...PrivateFeatureId[],
];

const operationSchema = z.enum(['sale', 'rent', 'seasonal', 'auction']);
const propertyTypeSchema = z.enum(PROPERTY_TYPE_IDS);
const propertySubtypeSchema = z.enum(PROPERTY_SUBTYPE_IDS);
const commonFeatureSchema = z.enum(COMMON_FEATURE_IDS);
const privateFeatureSchema = z.enum(PRIVATE_FEATURE_IDS);
const positionSchema = z.enum(['front', 'back', 'side', 'middle']);

const conciseText = (minimum: number, maximum: number) => z.string().trim().min(minimum).max(maximum);
const optionalMoney = z.number().finite().nonnegative().optional();

const classificationSchema = z.strictObject({
  operations: z.array(operationSchema).min(1),
  type: propertyTypeSchema,
  subtype: propertySubtypeSchema,
});

const privateAddressSchema = z.strictObject({
  postalCode: z.string().trim().regex(/^\d{5}-?\d{3}$/),
  state: z.string().trim().regex(/^[A-Za-z]{2}$/),
  city: conciseText(2, 100),
  district: conciseText(2, 100),
  street: conciseText(2, 160),
  number: conciseText(1, 30),
  complement: conciseText(1, 100).optional(),
  latitude: z.number().finite().min(-90).max(90).optional(),
  longitude: z.number().finite().min(-180).max(180).optional(),
});

const publicLocationSchema = z.strictObject({
  label: conciseText(3, 160),
  latitude: z.number().finite().min(-90).max(90).optional(),
  longitude: z.number().finite().min(-180).max(180).optional(),
  precision: z.literal('approximate'),
});

const factsSchema = z.strictObject({
  totalArea: z.number().finite().positive().optional(),
  usableArea: z.number().finite().positive().optional(),
  isNew: z.boolean(),
  ageYears: z.number().int().nonnegative().optional(),
  bedrooms: z.number().int().nonnegative(),
  bathrooms: z.number().int().nonnegative(),
  suites: z.number().int().nonnegative(),
  parkingSpaces: z.number().int().nonnegative(),
  floors: z.number().int().positive().optional(),
  position: positionSchema.optional(),
});

const featuresSchema = z.strictObject({
  acceptsFgts: z.boolean(),
  acceptsExchange: z.boolean(),
  common: z.array(commonFeatureSchema),
  private: z.array(privateFeatureSchema),
});

const editorialSchema = z.strictObject({
  title: conciseText(10, 120),
  description: conciseText(80, 5_000),
  reference: conciseText(1, 50),
  featured: z.boolean(),
});

const pricingSchema = z.strictObject({
  sale: optionalMoney,
  rent: optionalMoney,
  seasonal: optionalMoney,
  auction: optionalMoney,
  condominium: optionalMoney,
  iptu: optionalMoney,
});

const mediaSchema = z.strictObject({
  orderedPhotoIds: z.array(conciseText(1, 200)),
  coverPhotoId: conciseText(1, 200).optional(),
});

const seoSchema = z.strictObject({
  title: conciseText(1, 120).optional(),
  description: conciseText(1, 320).optional(),
  imagePhotoId: conciseText(1, 200).optional(),
});

const propertyDraftBaseSchema = z.strictObject({
  classification: classificationSchema,
  privateAddress: privateAddressSchema,
  publicLocation: publicLocationSchema,
  facts: factsSchema,
  features: featuresSchema,
  editorial: editorialSchema,
  pricing: pricingSchema,
  media: mediaSchema,
  seo: seoSchema,
});

const imovelwebKeyPattern = /imovelweb/i;
const imovelwebDomainPattern = /\b(?:https?:\/\/)?(?:[a-z0-9-]+\.)*imovelweb\.(?:com\.)?[a-z]{2,}(?:[/:?#][^\s]*)?/i;

const addForbiddenImovelwebIssues = (
  value: unknown,
  context: z.RefinementCtx,
  path: PropertyKey[] = [],
): void => {
  if (typeof value === 'string') {
    if (imovelwebDomainPattern.test(value)) {
      context.addIssue({
        code: 'custom',
        path,
        message: 'URLs do Imovelweb não são permitidas.',
      });
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => addForbiddenImovelwebIssues(item, context, [...path, index]));
    return;
  }

  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (imovelwebKeyPattern.test(key)) {
        context.addIssue({
          code: 'custom',
          path: [...path, key],
          message: 'Campos do Imovelweb não são permitidos.',
        });
      }
      addForbiddenImovelwebIssues(item, context, [...path, key]);
    }
  }
};

export const rejectImovelwebReferences = (value: unknown, context: z.RefinementCtx): void => {
  addForbiddenImovelwebIssues(value, context);
};

const hasDuplicates = (values: readonly string[]) => new Set(values).size !== values.length;

export const propertyDraftSchema = propertyDraftBaseSchema.superRefine((property, context) => {
  rejectImovelwebReferences(property, context);

  if (hasDuplicates(property.classification.operations)) {
    context.addIssue({
      code: 'custom',
      path: ['classification', 'operations'],
      message: 'As operações não podem se repetir.',
    });
  }

  for (const operation of property.classification.operations) {
    if (property.pricing[operation] === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['pricing', operation],
        message: `O preço de ${operation} é obrigatório para a operação selecionada.`,
      });
    }
  }

  if (property.facts.isNew && property.facts.ageYears !== undefined) {
    context.addIssue({
      code: 'custom',
      path: ['facts', 'ageYears'],
      message: 'Um imóvel novo não pode ter idade informada.',
    });
  }

  if (property.facts.suites > property.facts.bedrooms) {
    context.addIssue({
      code: 'custom',
      path: ['facts', 'suites'],
      message: 'O número de suítes não pode exceder o número de quartos.',
    });
  }

  if (
    property.facts.totalArea !== undefined &&
    property.facts.usableArea !== undefined &&
    property.facts.usableArea > property.facts.totalArea
  ) {
    context.addIssue({
      code: 'custom',
      path: ['facts', 'usableArea'],
      message: 'A área útil não pode exceder a área total.',
    });
  }

  if (
    property.privateAddress.latitude !== undefined &&
    property.privateAddress.longitude !== undefined &&
    property.publicLocation.latitude === property.privateAddress.latitude &&
    property.publicLocation.longitude === property.privateAddress.longitude
  ) {
    context.addIssue({
      code: 'custom',
      path: ['publicLocation'],
      message: 'A localização pública deve ser aproximada e diferente das coordenadas privadas.',
    });
  }

  if (hasDuplicates(property.features.common)) {
    context.addIssue({
      code: 'custom',
      path: ['features', 'common'],
      message: 'As áreas comuns não podem se repetir.',
    });
  }

  if (hasDuplicates(property.features.private)) {
    context.addIssue({
      code: 'custom',
      path: ['features', 'private'],
      message: 'As áreas privativas não podem se repetir.',
    });
  }

  const photoIds = property.media.orderedPhotoIds;
  if (hasDuplicates(photoIds)) {
    context.addIssue({
      code: 'custom',
      path: ['media', 'orderedPhotoIds'],
      message: 'As fotos ordenadas não podem se repetir.',
    });
  }

  if (photoIds.length > 0 && property.media.coverPhotoId === undefined) {
    context.addIssue({
      code: 'custom',
      path: ['media', 'coverPhotoId'],
      message: 'Uma foto de capa é obrigatória quando há fotos.',
    });
  }

  if (photoIds.length === 0 && property.media.coverPhotoId !== undefined) {
    context.addIssue({
      code: 'custom',
      path: ['media', 'coverPhotoId'],
      message: 'Não pode haver capa sem fotos.',
    });
  }

  if (
    property.media.coverPhotoId !== undefined &&
    !photoIds.includes(property.media.coverPhotoId)
  ) {
    context.addIssue({
      code: 'custom',
      path: ['media', 'coverPhotoId'],
      message: 'A capa deve pertencer às fotos ordenadas.',
    });
  }

  if (property.seo.imagePhotoId !== undefined && !photoIds.includes(property.seo.imagePhotoId)) {
    context.addIssue({
      code: 'custom',
      path: ['seo', 'imagePhotoId'],
      message: 'A imagem de SEO deve pertencer às fotos ordenadas.',
    });
  }
});

export const publishablePropertySchema = propertyDraftSchema;

export type PropertyDraft = z.infer<typeof propertyDraftSchema>;
export type PublishableProperty = z.infer<typeof publishablePropertySchema>;
