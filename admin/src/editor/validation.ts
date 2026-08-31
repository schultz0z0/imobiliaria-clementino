import { z } from 'zod';

import { PROPERTY_SUBTYPES_BY_TYPE, type PropertySubtype, type PropertyType } from '../../../shared/featureCatalog.ts';
import { propertyDraftSchema } from '../../../shared/propertySchema.ts';
import type { WizardValues } from './types.ts';

export type WizardIssue = { path: Array<string|number>; message: string };
export type WizardValidation = { success: true; issues: [] } | { success: false; issues: WizardIssue[] };

const pass: WizardValidation = { success: true, issues: [] };
const optionalDraftText = (maximum: number) => z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().max(maximum).optional(),
);
const draftEditorialSchema = z.strictObject({
  title: optionalDraftText(120),
  description: optionalDraftText(5_000),
  reference: optionalDraftText(50),
  featured: z.boolean().optional(),
});
const draftStepSchemas = {
  facts: propertyDraftSchema.shape.facts.partial(),
  features: propertyDraftSchema.shape.features.partial(),
  editorial: draftEditorialSchema,
  pricing: propertyDraftSchema.shape.pricing.partial(),
  media: propertyDraftSchema.shape.media.partial(),
  seo: propertyDraftSchema.shape.seo.partial(),
};
const draftWizardSchema = z.strictObject({
  classification: propertyDraftSchema.shape.classification.partial().optional(),
  privateAddress: propertyDraftSchema.shape.privateAddress.partial().optional(),
  publicLocation: propertyDraftSchema.shape.publicLocation.partial().optional(),
  facts: draftStepSchemas.facts.optional(),
  features: draftStepSchemas.features.optional(),
  editorial: draftStepSchemas.editorial.optional(),
  pricing: draftStepSchemas.pricing.optional(),
  media: draftStepSchemas.media.optional(),
  seo: draftStepSchemas.seo.optional(),
});

const parseSchema = (section: string, schema: z.ZodType, value: unknown): WizardValidation => {
  const result = schema.safeParse(value);
  return result.success
    ? pass
    : { success: false, issues: result.error.issues.map((issue) => ({
      path: section ? [section, ...issue.path] : [...issue.path], message: issue.message,
    })) };
};

const parseSection = (section: keyof WizardValues, value: unknown): WizardValidation =>
  parseSchema(section, propertyDraftSchema.shape[section], value);

const parseOptionalSection = (section: keyof typeof draftStepSchemas, value: unknown): WizardValidation =>
  value === undefined ? pass : parseSchema(section, draftStepSchemas[section], value);

const validateFactsConsistency = (values: WizardValues): WizardValidation => {
  if (values.facts?.isNew && values.facts.ageYears !== undefined) {
    return { success: false, issues: [{ path: ['facts', 'ageYears'], message: 'Um imóvel novo não pode ter idade informada.' }] };
  }
  if (values.facts?.suites !== undefined && values.facts?.bedrooms !== undefined && values.facts.suites > values.facts.bedrooms) {
    return { success: false, issues: [{ path: ['facts', 'suites'], message: 'O número de suítes não pode exceder o número de quartos.' }] };
  }
  if (values.facts?.usableArea !== undefined && values.facts.totalArea !== undefined && values.facts.usableArea > values.facts.totalArea) {
    return { success: false, issues: [{ path: ['facts', 'usableArea'], message: 'A área útil não pode exceder a área total.' }] };
  }
  return pass;
};

const validateDraft = (values: WizardValues): WizardValidation => {
  const result = draftWizardSchema.safeParse(values);
  if (!result.success) return parseSchema('', draftWizardSchema, values);
  return validateFactsConsistency(values);
};

export const validateWizardStep = (step: number, values: WizardValues): WizardValidation => {
  if (step === 1) {
    const parsed = parseSection('classification', values.classification);
    if (!parsed.success) return parsed;
    const classification = values.classification!;
    if (!PROPERTY_SUBTYPES_BY_TYPE[classification.type as PropertyType].includes(classification.subtype as PropertySubtype)) {
      return { success: false, issues: [{ path: ['classification', 'subtype'], message: 'O subtipo não é compatível com o tipo do imóvel.' }] };
    }
    return pass;
  }
  if (step === 2) return parseSection('privateAddress', values.privateAddress);
  if (step === 3) return parseOptionalSection('media', values.media);
  if (step === 4) {
    const facts = parseOptionalSection('facts', values.facts);
    return facts.success ? validateFactsConsistency(values) : facts;
  }
  if (step === 5) return parseOptionalSection('features', values.features);
  if (step === 6) {
    const editorial = parseOptionalSection('editorial', values.editorial);
    return editorial.success ? parseOptionalSection('pricing', values.pricing) : editorial;
  }
  return validateDraft(values);
};
