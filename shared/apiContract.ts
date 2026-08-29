import { z } from 'zod';

import {
  applySharedPropertyRefinements,
  formatPublicLocationLabel,
  propertyDraftSchema,
  type PropertyDraft,
} from './propertySchema.ts';

export const API_ERROR_CODES = {
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  PASSWORD_CHANGE_REQUIRED: 'PASSWORD_CHANGE_REQUIRED',
  CURRENT_PASSWORD_INVALID: 'CURRENT_PASSWORD_INVALID',
  CSRF_INVALID: 'CSRF_INVALID',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  STALE_REVISION: 'STALE_REVISION',
  PUBLICATION_JOB_ACTIVE: 'PUBLICATION_JOB_ACTIVE',
  INVALID_STATE: 'INVALID_STATE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

export const apiFieldIssueSchema = z.strictObject({
  path: z.array(z.union([z.string(), z.number()])),
  message: z.string(),
});

export type ApiFieldIssue = z.infer<typeof apiFieldIssueSchema>;

export const apiErrorResponseSchema = z.strictObject({
  error: z.strictObject({
    code: z.enum(Object.values(API_ERROR_CODES)),
    message: z.string(),
    issues: z.array(apiFieldIssueSchema).optional(),
  }),
});

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;

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
