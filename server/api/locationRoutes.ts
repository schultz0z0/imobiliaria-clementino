import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';

import { API_ERROR_CODES, type ApiErrorCode } from '../../shared/apiContract.ts';
import {
  derivePublicLocation,
  LocationPrivacyError,
  resolveLocationPrivacySecret,
  type PrivateLocation,
} from '../domain/locationPrivacy.ts';
import { createAdminGuard } from '../auth/routes.ts';
import { IpFailureRateLimiter } from '../auth/ipRateLimiter.ts';
import type { Sql } from '../db/client.ts';

const DEFAULT_CEP_TIMEOUT_MS = 3_000;
const DEFAULT_CEP_MAX_RESPONSE_BYTES = 16 * 1024;
const DEFAULT_CEP_ENDPOINT_TEMPLATE = 'https://viacep.com.br/ws/{cep}/json/';
const CEP_FALLBACK = {
  code: 'CEP_UNAVAILABLE' as const,
  message: 'Não foi possível consultar o CEP. Preencha manualmente.',
};

const providerResponseSchema = z.strictObject({
  cep: z.string().trim().min(1),
  logradouro: z.string().trim().min(2),
  complemento: z.string(),
  bairro: z.string().trim().min(2),
  localidade: z.string().trim().min(2),
  uf: z.string().regex(/^[A-Za-z]{2}$/),
});

const privateAddressSchema = z.strictObject({
  postalCode: z.string().trim().regex(/^\d{5}-?\d{3}$/),
  state: z.string().trim().regex(/^[A-Za-z]{2}$/),
  city: z.string().trim().min(2).max(100),
  district: z.string().trim().min(2).max(100),
  street: z.string().trim().min(2).max(160),
  number: z.string().trim().min(1).max(30),
  complement: z.string().trim().min(1).max(100).optional(),
  latitude: z.number().finite().min(-90).max(90).optional(),
  longitude: z.number().finite().min(-180).max(180).optional(),
});
const previewBodySchema = z.strictObject({
  publicId: z.string().trim().min(1).max(200),
  privateAddress: privateAddressSchema,
  manualCoordinates: z
    .strictObject({
      latitude: z.number().finite().min(-90).max(90),
      longitude: z.number().finite().min(-180).max(180),
    })
    .optional(),
});
const cepParamsSchema = z.strictObject({ cep: z.string().trim().min(1).max(32) });

type FetchImplementation = (input: string, init?: RequestInit) => Promise<Response>;

export type CepLookupResult =
  | {
      ok: true;
      address: Pick<
        PrivateLocation,
        'postalCode' | 'street' | 'complement' | 'district' | 'city' | 'state'
      >;
    }
  | { ok: false; error: typeof CEP_FALLBACK };

export type CepLookupOptions = {
  endpointTemplate?: string;
  timeoutMs?: number;
  maxResponseBytes?: number;
  fetch?: FetchImplementation;
};

const normalizeCep = (input: string): string | undefined => {
  const digits = input.replace(/\D/g, '');
  return /^\d{8}$/.test(digits) ? digits : undefined;
};

const formatCep = (digits: string): string => `${digits.slice(0, 5)}-${digits.slice(5)}`;

const readBoundedText = async (response: Response, maximumBytes: number): Promise<string> => {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new Error('Provider response exceeded the byte limit');
  }
  if (!response.body) {
    throw new Error('Provider response body is missing');
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel();
        throw new Error('Provider response exceeded the byte limit');
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
};

export const createCepLookup = (options: CepLookupOptions = {}) => {
  const endpointTemplate = options.endpointTemplate ?? process.env.CEP_LOOKUP_URL_TEMPLATE ?? DEFAULT_CEP_ENDPOINT_TEMPLATE;
  const timeoutMs = options.timeoutMs ?? DEFAULT_CEP_TIMEOUT_MS;
  const maxResponseBytes = options.maxResponseBytes ?? DEFAULT_CEP_MAX_RESPONSE_BYTES;
  const fetchImplementation = options.fetch ?? globalThis.fetch;
  return async (input: string): Promise<CepLookupResult> => {
    const cep = normalizeCep(input);
    if (!cep || !endpointTemplate?.includes('{cep}') || !fetchImplementation) {
      return { ok: false, error: CEP_FALLBACK };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImplementation(
        endpointTemplate.replaceAll('{cep}', encodeURIComponent(cep)),
        { signal: controller.signal, headers: { accept: 'application/json' } },
      );
      if (!response.ok) return { ok: false, error: CEP_FALLBACK };
      const parsed = providerResponseSchema.safeParse(JSON.parse(await readBoundedText(response, maxResponseBytes)));
      if (!parsed.success) return { ok: false, error: CEP_FALLBACK };
      const value = parsed.data;
      return {
        ok: true,
        address: {
          postalCode: formatCep(cep),
          street: value.logradouro.trim(),
          complement: value.complemento.trim() || undefined,
          district: value.bairro.trim(),
          city: value.localidade.trim(),
          state: value.uf.trim().toUpperCase(),
        },
      };
    } catch {
      return { ok: false, error: CEP_FALLBACK };
    } finally {
      clearTimeout(timer);
    }
  };
};

export type LocationRouteOptions = CepLookupOptions & {
  environment?: string;
  privacySecret?: string;
  rateLimit?: { requests: number; windowMs: number; maxEntries?: number };
};

const sendError = (reply: FastifyReply, statusCode: number, code: ApiErrorCode, message: string) =>
  reply.code(statusCode).send({ error: { code, message } });

export const registerLocationRoutes = (
  app: FastifyInstance,
  sql: Sql,
  options: LocationRouteOptions = {},
): void => {
  const lookupCep = createCepLookup(options);
  const privacySecret = resolveLocationPrivacySecret({
    environment: options.environment,
    secret: options.privacySecret,
  });
  const limiterOptions = options.rateLimit ?? { requests: 20, windowMs: 60_000, maxEntries: 10_000 };
  const limiter = new IpFailureRateLimiter({
    failureLimit: limiterOptions.requests,
    windowMs: limiterOptions.windowMs,
    maxEntries: limiterOptions.maxEntries,
  });
  const readGuard = createAdminGuard(sql, { typedErrors: true });
  const mutationGuard = createAdminGuard(sql, { csrf: true, typedErrors: true });
  const enforceRateLimit = (reply: FastifyReply, ip: string): boolean => {
    const attempt = limiter.reserveAttempt(ip);
    if (attempt.allowed) return true;
    reply.header('retry-after', Math.ceil(attempt.retryAfterMs / 1_000));
    void sendError(reply, 429, API_ERROR_CODES.RATE_LIMITED, 'Too many location requests. Try again later.');
    return false;
  };

  app.get('/api/admin/location/cep/:cep', { preHandler: readGuard }, async (request, reply) => {
    if (!enforceRateLimit(reply, request.ip)) return reply;
    const params = cepParamsSchema.safeParse(request.params);
    if (!params.success) {
      return sendError(reply, 400, API_ERROR_CODES.VALIDATION_FAILED, 'Request validation failed');
    }
    return reply.send(await lookupCep(params.data.cep));
  });

  app.post('/api/admin/location/preview', { preHandler: mutationGuard }, async (request, reply) => {
    if (!enforceRateLimit(reply, request.ip)) return reply;
    const body = previewBodySchema.safeParse(request.body);
    if (!body.success) {
      return sendError(reply, 400, API_ERROR_CODES.VALIDATION_FAILED, 'Request validation failed');
    }
    try {
      return reply.send({
        publicLocation: derivePublicLocation({ ...body.data, secret: privacySecret }),
      });
    } catch (error) {
      if (error instanceof LocationPrivacyError) {
        return sendError(reply, 400, API_ERROR_CODES.VALIDATION_FAILED, 'Public marker is not private enough.');
      }
      return sendError(reply, 500, API_ERROR_CODES.INTERNAL_ERROR, 'Location preview could not be created.');
    }
  });
};
