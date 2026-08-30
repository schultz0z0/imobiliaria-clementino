import type { PropertyDraft } from '../../../shared/propertySchema.ts';

export type WizardValues = {
  classification?: Partial<PropertyDraft['classification']>;
  privateAddress?: Partial<PropertyDraft['privateAddress']>;
  publicLocation?: Partial<PropertyDraft['publicLocation']>;
  facts?: Partial<PropertyDraft['facts']>;
  features?: Partial<PropertyDraft['features']>;
  editorial?: Partial<PropertyDraft['editorial']>;
  pricing?: Partial<PropertyDraft['pricing']>;
  media?: Partial<PropertyDraft['media']>;
  seo?: Partial<PropertyDraft['seo']>;
};

export type WizardPath = string;

export const EMPTY_WIZARD_VALUES: WizardValues = {
  classification: { operations: [], type: 'apartment', subtype: 'standard' },
  facts: { isNew: false, bedrooms: 0, bathrooms: 0, suites: 0, parkingSpaces: 0 },
  features: { acceptsFgts: false, acceptsExchange: false, common: [], private: [] },
  editorial: { title: '', description: '', reference: '', featured: false },
  pricing: {},
  media: { orderedPhotoIds: [], altTextByPhotoId: {} },
  seo: {},
};

export const mergeWizardValues = (current: WizardValues, incoming: WizardValues): WizardValues => {
  const merged = { ...current };
  for (const section of Object.keys(incoming) as Array<keyof WizardValues>) {
    const value = incoming[section];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      (merged as Record<string, unknown>)[section] = {
        ...((current[section] ?? {}) as object),
        ...value,
      };
    } else if (value !== undefined) {
      (merged as Record<string, unknown>)[section] = value;
    }
  }
  return merged;
};

export const patchForPath = (values: WizardValues, path: string): WizardValues => {
  const [section, field] = path.split('.');
  if (!section || !field) return {};
  const sectionValue = (values as Record<string, unknown>)[section];
  if (!sectionValue || typeof sectionValue !== 'object') return {};
  const value = (sectionValue as Record<string, unknown>)[field];
  return { [section]: { [field]: value === undefined ? null : value } } as WizardValues;
};

