import { z } from 'zod';

import {
  applySharedPropertyRefinements,
  formatPublicLocationLabel,
  propertyDraftSchema,
  type PropertyDraft,
} from './propertySchema.ts';

const { privateAddress: _privateAddressSchema, ...publicPropertyShape } = propertyDraftSchema.shape;

export const publicPropertySchema = z
  .strictObject(publicPropertyShape)
  .superRefine(applySharedPropertyRefinements);

export type PublicPropertyDto = z.infer<typeof publicPropertySchema>;
export type PublicPropertyDTO = PublicPropertyDto;

export const toPublicPropertyDto = (input: PropertyDraft): PublicPropertyDto => {
  const property = propertyDraftSchema.parse({
    ...input,
    publicLocation: {
      ...input.publicLocation,
      label: formatPublicLocationLabel(input.privateAddress),
    },
  });
  const { privateAddress: _privateAddress, ...publicProperty } = property;

  return publicPropertySchema.parse(publicProperty);
};
