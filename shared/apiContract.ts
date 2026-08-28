import { z } from 'zod';

import {
  propertyDraftSchema,
  rejectImovelwebReferences,
  type PropertyDraft,
} from './propertySchema.ts';

const { privateAddress: _privateAddressSchema, ...publicPropertyShape } = propertyDraftSchema.shape;

export const publicPropertySchema = z
  .strictObject(publicPropertyShape)
  .superRefine(rejectImovelwebReferences);

export type PublicPropertyDto = z.infer<typeof publicPropertySchema>;
export type PublicPropertyDTO = PublicPropertyDto;

export const toPublicPropertyDto = (input: PropertyDraft): PublicPropertyDto => {
  const property = propertyDraftSchema.parse(input);
  const { privateAddress: _privateAddress, ...publicProperty } = property;

  return publicPropertySchema.parse(publicProperty);
};
