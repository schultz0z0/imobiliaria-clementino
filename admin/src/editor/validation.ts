import { PROPERTY_SUBTYPES_BY_TYPE, type PropertySubtype, type PropertyType } from '../../../shared/featureCatalog.ts';
import { propertyDraftSchema } from '../../../shared/propertySchema.ts';
import type { WizardValues } from './types.ts';

export type WizardIssue = { path: Array<string|number>; message: string };
export type WizardValidation = { success: true; issues: [] } | { success: false; issues: WizardIssue[] };
const pass: WizardValidation = { success: true, issues: [] };
const fromZod = (section: string, result: ReturnType<typeof propertyDraftSchema.safeParse>): WizardValidation => result.success ? pass : ({ success: false, issues: result.error.issues.map((issue) => ({ path: section ? [section, ...issue.path] : [...issue.path], message: issue.message })) });
const parseSection = (section: keyof WizardValues, value: unknown): WizardValidation => {
  const schema = propertyDraftSchema.shape[section];
  const result = schema.safeParse(value);
  return result.success ? pass : { success: false, issues: result.error.issues.map((issue) => ({ path: [section, ...issue.path], message: issue.message })) };
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
  if (step === 2) {
    const address = parseSection('privateAddress', values.privateAddress);
    return address.success ? parseSection('publicLocation', values.publicLocation) : address;
  }
  if (step === 3) return parseSection('media', values.media);
  if (step === 4) {
    const facts = parseSection('facts', values.facts);
    if (!facts.success) return facts;
    if (values.facts?.isNew && values.facts.ageYears !== undefined) return { success: false, issues: [{ path: ['facts','ageYears'], message: 'Um imóvel novo não pode ter idade informada.' }] };
    if ((values.facts?.suites ?? 0) > (values.facts?.bedrooms ?? 0)) return { success: false, issues: [{ path: ['facts','suites'], message: 'O número de suítes não pode exceder o número de quartos.' }] };
    if (values.facts?.usableArea !== undefined && values.facts.totalArea !== undefined && values.facts.usableArea > values.facts.totalArea) return { success: false, issues: [{ path: ['facts','usableArea'], message: 'A área útil não pode exceder a área total.' }] };
    return pass;
  }
  if (step === 5) return parseSection('features', values.features);
  if (step === 6) {
    const editorial = parseSection('editorial', values.editorial);
    if (!editorial.success) return editorial;
    const pricing = parseSection('pricing', values.pricing);
    if (!pricing.success) return pricing;
    const missing = (values.classification?.operations ?? []).find((operation) => values.pricing?.[operation] === undefined);
    return missing ? { success: false, issues: [{ path: ['pricing', missing], message: 'Informe o preço da operação selecionada.' }] } : pass;
  }
  return fromZod('', propertyDraftSchema.safeParse(values));
};

