import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';

import { seedAdministrator } from '../../scripts/admin/seedAdmin.ts';
import { apiFieldIssueSchema } from '../../shared/apiContract.ts';
import { propertyDraftSchema, type PropertyDraft } from '../../shared/propertySchema.ts';
import { createAdminSession, type CreatedSession } from '../auth/session.ts';
import { createPostgresClient } from '../db/client.ts';
import { migrate } from '../db/migrate.ts';
import { publishDraft } from '../db/propertyRepository.ts';
import { claimNextPublicationJob } from '../db/publicationRepository.ts';
import { assertDisposableTestDatabase } from '../db/testDatabaseSafety.ts';
import { createServer } from './createServer.ts';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
assertDisposableTestDatabase(testDatabaseUrl);
const sql = createPostgresClient(testDatabaseUrl, { max: 16 });
const testSuiteLockKey = 1_988_042_702;
let testSuiteLock: Awaited<ReturnType<typeof sql.reserve>> | undefined;
let app: ReturnType<typeof createServer>;
let administratorId = '';

const API_ERROR_CODES = {
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  PASSWORD_CHANGE_REQUIRED: 'PASSWORD_CHANGE_REQUIRED',
  CSRF_INVALID: 'CSRF_INVALID',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  STALE_REVISION: 'STALE_REVISION',
  PUBLICATION_JOB_ACTIVE: 'PUBLICATION_JOB_ACTIVE',
  INVALID_STATE: 'INVALID_STATE',
} as const;

const validProperty = (
  reference: string,
  overrides: Partial<PropertyDraft> = {},
): PropertyDraft =>
  propertyDraftSchema.parse({
    classification: {
      operations: ['sale'],
      type: 'apartment',
      subtype: 'standard',
    },
    privateAddress: {
      postalCode: '01310-100',
      state: 'SP',
      city: 'Sao Paulo',
      district: 'Bela Vista',
      street: 'Avenida Paulista',
      number: '1000',
    },
    publicLocation: {
      label: 'Bela Vista, Sao Paulo - SP',
      precision: 'approximate',
    },
    facts: {
      isNew: false,
      ageYears: 8,
      bedrooms: 3,
      bathrooms: 2,
      suites: 1,
      parkingSpaces: 1,
    },
    features: {
      acceptsFgts: true,
      acceptsExchange: false,
      common: [],
      private: [],
    },
    editorial: {
      title: 'Apartamento ensolarado na Bela Vista',
      description:
        'Apartamento bem distribuido, com ambientes iluminados, boa ventilacao e localizacao conveniente para toda a familia.',
      reference,
      featured: false,
    },
    pricing: { sale: 850_000 },
    media: { orderedPhotoIds: [] },
    seo: {},
    ...overrides,
  });

const truncateDatabase = async (): Promise<void> => {
  await sql.unsafe(`
    TRUNCATE TABLE
      audit_events,
      site_releases,
      publication_jobs,
      property_media,
      properties,
      property_revisions,
      admin_sessions,
      admin_users
    RESTART IDENTITY CASCADE
  `);
};

const authenticate = async (forcedPasswordChange = false): Promise<CreatedSession> => {
  if (!forcedPasswordChange) {
    await sql`
      UPDATE admin_users
      SET must_change_password = false
      WHERE id = ${administratorId}
    `;
  }
  return createAdminSession(sql, administratorId);
};

const authHeaders = (session: CreatedSession, csrf = false) => ({
  cookie: `clementino_admin_session=${session.token}; clementino_admin_csrf=${session.csrfToken}`,
  ...(csrf ? { 'x-csrf-token': session.csrfToken } : {}),
});

const createDraft = async (session: CreatedSession) => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/admin/properties',
    headers: authHeaders(session, true),
    payload: {},
  });
  assert.equal(response.statusCode, 201, response.body);
  return response.json().property as {
    id: string;
    publicId: string;
    commercialReference: string;
    slug: string;
    status: string;
    revisionNumber: number;
    draft: Record<string, unknown>;
    publishedRevisionId: number | null;
  };
};

const saveDraft = async (
  session: CreatedSession,
  propertyId: string,
  revisionNumber: number,
  patch: unknown,
) =>
  app.inject({
    method: 'PATCH',
    url: `/api/admin/properties/${propertyId}/draft`,
    headers: { ...authHeaders(session, true), 'if-match': `"${revisionNumber}"` },
    payload: patch,
  });

before(async () => {
  testSuiteLock = await sql.reserve();
  await testSuiteLock`SELECT pg_advisory_lock(${testSuiteLockKey})`;
  await migrate(sql);
  app = createServer({ sql, environment: 'test' });
  await app.ready();
});

beforeEach(async () => {
  await truncateDatabase();
  administratorId = (
    await seedAdministrator(sql, {
      username: 'administrador',
      password: 'Senha inicial segura 2026!',
    })
  ).id;
});

after(async () => {
  await app.close();
  if (testSuiteLock) {
    await testSuiteLock`SELECT pg_advisory_unlock(${testSuiteLockKey})`;
    testSuiteLock.release();
  }
  await sql.end({ timeout: 5 });
});

test('requires authentication, CSRF, and a completed password change for property administration', async () => {
  const unauthenticated = await app.inject({ method: 'GET', url: '/api/admin/properties' });
  assert.equal(unauthenticated.statusCode, 401);
  assert.equal(unauthenticated.json().error.code, API_ERROR_CODES.AUTH_REQUIRED);

  const restricted = await authenticate(true);
  const forced = await app.inject({
    method: 'GET',
    url: '/api/admin/properties',
    headers: authHeaders(restricted),
  });
  assert.equal(forced.statusCode, 403);
  assert.equal(forced.json().error.code, API_ERROR_CODES.PASSWORD_CHANGE_REQUIRED);

  await sql`UPDATE admin_users SET must_change_password = false WHERE id = ${administratorId}`;
  const missingCsrf = await app.inject({
    method: 'POST',
    url: '/api/admin/properties',
    headers: authHeaders(restricted),
    payload: {},
  });
  assert.equal(missingCsrf.statusCode, 403);
  assert.equal(missingCsrf.json().error.code, API_ERROR_CODES.CSRF_INVALID);
});

test('creates a private incomplete draft with generated immutable identity and reports field issues', async () => {
  const session = await authenticate();
  const created = await createDraft(session);

  assert.match(created.publicId, /^property_[0-9a-f-]{36}$/);
  assert.match(created.commercialReference, /^CLI-[A-Z0-9]{8}$/);
  assert.ok(created.slug.length > 0);
  assert.equal(created.status, 'draft');
  assert.equal(created.revisionNumber, 1);
  assert.equal(created.publishedRevisionId, null);
  assert.equal(created.draft.editorial.reference, created.commercialReference);

  const detail = await app.inject({
    method: 'GET',
    url: `/api/admin/properties/${created.id}`,
    headers: authHeaders(session),
  });
  assert.equal(detail.statusCode, 200, detail.body);
  assert.equal(detail.json().property.publicId, created.publicId);
  assert.equal(JSON.stringify(detail.json()).toLowerCase().includes('imovelweb'), false);

  const validation = await app.inject({
    method: 'GET',
    url: `/api/admin/properties/${created.id}/validation`,
    headers: authHeaders(session),
  });
  assert.equal(validation.statusCode, 200, validation.body);
  assert.equal(validation.json().publishable, false);
  assert.ok(validation.json().issues.length > 0);
  assert.ok(validation.json().issues.every((issue: unknown) => typeof issue === 'object'));

  await assert.rejects(
    sql`UPDATE properties SET public_id = 'mutated-public-id' WHERE id = ${created.id}`,
    /public_id is immutable/i,
  );
});

test('deep-merges strict partial autosaves and requires an optimistic revision', async () => {
  const session = await authenticate();
  const created = await createDraft(session);
  const initialTitle = (created.draft.editorial as { title: string }).title;

  const missingRevision = await app.inject({
    method: 'PATCH',
    url: `/api/admin/properties/${created.id}/draft`,
    headers: authHeaders(session, true),
    payload: { editorial: { featured: true } },
  });
  assert.equal(missingRevision.statusCode, 400);
  assert.equal(missingRevision.json().error.code, API_ERROR_CODES.VALIDATION_FAILED);

  const saved = await saveDraft(session, created.id, 1, { editorial: { description: 'Rascunho parcial sem destaque.' } });
  assert.equal(saved.statusCode, 200, saved.body);
  assert.equal(saved.json().property.revisionNumber, 2);
  assert.equal(saved.json().property.draft.editorial.title, initialTitle);
  assert.equal(saved.json().property.draft.editorial.featured, false);
});

test('uses null only to clear optional draft fields and clears coordinate pairs atomically', async () => {
  const session = await authenticate();
  const created = await createDraft(session);
  const complete = validProperty(created.commercialReference, {
    privateAddress: {
      postalCode: '01310-100',
      state: 'SP',
      city: 'Sao Paulo',
      district: 'Bela Vista',
      street: 'Avenida Paulista',
      number: '1000',
      complement: 'Apto 101',
      latitude: -23.561,
      longitude: -46.656,
    },
    publicLocation: {
      label: 'Bela Vista, Sao Paulo - SP',
      precision: 'approximate',
      latitude: -23.559,
      longitude: -46.654,
    },
    pricing: { sale: 850_000, condominium: 900, iptu: 210 },
    media: { orderedPhotoIds: ['photo-1'], coverPhotoId: 'photo-1' },
    seo: { title: 'SEO title', description: 'SEO description', imagePhotoId: 'photo-1' },
  });
  assert.equal((await saveDraft(session, created.id, 1, complete)).statusCode, 200);

  const cleared = await saveDraft(session, created.id, 2, {
    privateAddress: { complement: null, latitude: null, longitude: null },
    publicLocation: { latitude: null, longitude: null },
    facts: { isNew: true, ageYears: null },
    pricing: { sale: null, condominium: null, iptu: null },
    media: { coverPhotoId: null },
    seo: { title: null, description: null, imagePhotoId: null },
  });
  assert.equal(cleared.statusCode, 200, cleared.body);
  const draft = cleared.json().property.draft;
  assert.equal('complement' in draft.privateAddress, false);
  assert.equal('latitude' in draft.privateAddress, false);
  assert.equal('longitude' in draft.privateAddress, false);
  assert.equal('latitude' in draft.publicLocation, false);
  assert.equal('longitude' in draft.publicLocation, false);
  assert.equal('ageYears' in draft.facts, false);
  assert.equal(draft.facts.isNew, true);
  assert.equal('sale' in draft.pricing, false);
  assert.equal('condominium' in draft.pricing, false);
  assert.equal('iptu' in draft.pricing, false);
  assert.equal('coverPhotoId' in draft.media, false);
  assert.deepEqual(draft.seo, {});

  const inconsistentCoordinates = await saveDraft(session, created.id, 3, {
    privateAddress: { latitude: null },
  });
  assert.equal(inconsistentCoordinates.statusCode, 400);
  assert.equal(inconsistentCoordinates.json().error.code, API_ERROR_CODES.VALIDATION_FAILED);

  const requiredNull = await saveDraft(session, created.id, 3, { editorial: { title: null } });
  assert.equal(requiredNull.statusCode, 400);
  assert.equal(requiredNull.json().error.code, API_ERROR_CODES.VALIDATION_FAILED);
});

test('clears optional property facts without weakening required facts or publish validation', async () => {
  const session = await authenticate();
  const created = await createDraft(session);
  const complete = validProperty(created.commercialReference, {
    facts: {
      isNew: false,
      ageYears: 8,
      totalArea: 100,
      usableArea: 80,
      bedrooms: 3,
      bathrooms: 2,
      suites: 1,
      parkingSpaces: 1,
      floors: 7,
      position: 'front',
    },
  });
  assert.equal((await saveDraft(session, created.id, 1, complete)).statusCode, 200);

  const cleared = await saveDraft(session, created.id, 2, {
    facts: { totalArea: null, usableArea: null, floors: null, position: null },
  });
  assert.equal(cleared.statusCode, 200, cleared.body);
  const detail = await app.inject({
    method: 'GET',
    url: `/api/admin/properties/${created.id}`,
    headers: authHeaders(session),
  });
  assert.equal(detail.statusCode, 200, detail.body);
  for (const key of ['totalArea', 'usableArea', 'floors', 'position']) {
    assert.equal(key in detail.json().property.draft.facts, false, key);
  }

  const oneSided = await saveDraft(session, created.id, 3, {
    facts: { totalArea: 100, usableArea: 80 },
  });
  assert.equal(oneSided.statusCode, 200, oneSided.body);
  const clearedTotalOnly = await saveDraft(session, created.id, 4, { facts: { totalArea: null } });
  assert.equal(clearedTotalOnly.statusCode, 200, clearedTotalOnly.body);
  assert.equal('totalArea' in clearedTotalOnly.json().property.draft.facts, false);
  assert.equal(clearedTotalOnly.json().property.draft.facts.usableArea, 80);

  const publish = await app.inject({
    method: 'POST',
    url: `/api/admin/properties/${created.id}/publish`,
    headers: authHeaders(session, true),
    payload: {},
  });
  assert.equal(publish.statusCode, 202, publish.body);

  const requiredNull = await saveDraft(session, created.id, 5, { facts: { bedrooms: null } });
  assert.equal(requiredNull.statusCode, 400);
  assert.equal(requiredNull.json().error.code, API_ERROR_CODES.VALIDATION_FAILED);
});

test('synchronizes editorial references with unique commercial references', async () => {
  const session = await authenticate();
  const first = await createDraft(session);
  assert.equal((await saveDraft(session, first.id, 1, validProperty(first.commercialReference))).statusCode, 200);

  const renamed = await saveDraft(session, first.id, 2, {
    editorial: { reference: 'CLI-CUSTOM-REF' },
  });
  assert.equal(renamed.statusCode, 200, renamed.body);
  assert.equal(renamed.json().property.commercialReference, 'CLI-CUSTOM-REF');
  assert.equal(renamed.json().property.draft.editorial.reference, 'CLI-CUSTOM-REF');

  const second = await createDraft(session);
  assert.equal((await saveDraft(session, second.id, 1, validProperty(second.commercialReference, {
    editorial: { ...validProperty(second.commercialReference).editorial, title: 'Apartamento ensolarado em Botafogo' },
  }))).statusCode, 200);
  const conflict = await saveDraft(session, second.id, 2, {
    editorial: { reference: 'CLI-CUSTOM-REF' },
  });
  assert.equal(conflict.statusCode, 409, conflict.body);
  assert.equal(conflict.json().error.code, API_ERROR_CODES.CONFLICT);
});

test('derives the slug from the current title on every save', async () => {
  const session = await authenticate();
  const created = await createDraft(session);
  assert.match(created.slug, /^novo-imovel-[a-f0-9]{8}$/);

  const titled = await saveDraft(session, created.id, 1, {
    editorial: { title: 'Apartamento amplo no Jardim América' },
  });
  assert.equal(titled.statusCode, 200, titled.body);
  assert.equal(titled.json().property.slug, 'apartamento-amplo-no-jardim-america');

  const renamed = await saveDraft(session, created.id, 2, {
    editorial: { title: 'Título alterado posteriormente' },
  });
  assert.equal(renamed.statusCode, 200, renamed.body);
  assert.equal(renamed.json().property.slug, 'titulo-alterado-posteriormente');
});

test('rejects stale concurrent autosaves so exactly one succeeds', async () => {
  const session = await authenticate();
  const created = await createDraft(session);

  const responses = await Promise.all([
    saveDraft(session, created.id, 1, { editorial: { title: 'Primeira alteracao concorrente' } }),
    saveDraft(session, created.id, 1, { editorial: { title: 'Segunda alteracao concorrente' } }),
  ]);

  assert.equal(responses.filter(({ statusCode }) => statusCode === 200).length, 1);
  const stale = responses.find(({ statusCode }) => statusCode === 409);
  assert.ok(stale);
  assert.equal(stale.json().error.code, API_ERROR_CODES.STALE_REVISION);

  const persisted = await sql<{ revisions: string; draftSaves: string }[]>`
    SELECT
      (SELECT count(*)::text FROM property_revisions WHERE property_id = ${created.id}) AS revisions,
      (SELECT count(*)::text FROM audit_events
       WHERE property_id = ${created.id} AND action = 'property.draft_saved') AS "draftSaves"
  `;
  assert.deepEqual(Array.from(persisted), [{ revisions: '2', draftSaves: '1' }]);
});

test('rolls back a failed draft save without exposing the database failure', async () => {
  const session = await authenticate();
  const created = await createDraft(session);
  await sql.unsafe(`
    CREATE FUNCTION fail_property_draft_audit() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'injected audit failure';
    END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER fail_property_draft_audit_trigger
    BEFORE INSERT ON audit_events
    FOR EACH ROW
    WHEN (NEW.action = 'property.draft_saved')
    EXECUTE FUNCTION fail_property_draft_audit();
  `);
  try {
    const failed = await saveDraft(session, created.id, 1, { editorial: { description: 'Rascunho que falhara no audit.' } });
    assert.equal(failed.statusCode, 500);
    assert.equal(failed.json().error.code, API_ERROR_CODES.CONFLICT);
    assert.equal(failed.body.includes('injected audit failure'), false);

    const persisted = await sql<{ revisions: string; draftSaves: string }[]>`
      SELECT
        (SELECT count(*)::text FROM property_revisions WHERE property_id = ${created.id}) AS revisions,
        (SELECT count(*)::text FROM audit_events
         WHERE property_id = ${created.id} AND action = 'property.draft_saved') AS "draftSaves"
    `;
    assert.deepEqual(Array.from(persisted), [{ revisions: '1', draftSaves: '0' }]);
  } finally {
    await sql.unsafe(`
      DROP TRIGGER IF EXISTS fail_property_draft_audit_trigger ON audit_events;
      DROP FUNCTION IF EXISTS fail_property_draft_audit();
    `);
  }
});

test('rejects unknown and prototype-pollution fields without creating revisions', async () => {
  const session = await authenticate();
  const created = await createDraft(session);

  const unknown = await saveDraft(session, created.id, 1, {
    editorial: { externalPortal: 'forbidden' },
  });
  assert.equal(unknown.statusCode, 400);
  assert.equal(unknown.json().error.code, API_ERROR_CODES.VALIDATION_FAILED);

  const prototype = await app.inject({
    method: 'PATCH',
    url: `/api/admin/properties/${created.id}/draft`,
    headers: {
      ...authHeaders(session, true),
      'if-match': '"1"',
      'content-type': 'application/json',
    },
    payload: '{"__proto__":{"polluted":true}}',
  });
  assert.equal(prototype.statusCode, 400);
  assert.equal(prototype.json().error.code, API_ERROR_CODES.VALIDATION_FAILED);
  assert.equal((Object.prototype as { polluted?: boolean }).polluted, undefined);

  const revisions = await sql<{ count: string }[]>`
    SELECT count(*)::text AS count FROM property_revisions WHERE property_id = ${created.id}
  `;
  assert.equal(revisions[0]?.count, '1');
});

test('persists incomplete draft fields while publication remains strict', async () => {
  const session = await authenticate();
  const created = await createDraft(session);
  const partial = await saveDraft(session, created.id, 1, {
    editorial: { title: '', description: '' },
    classification: { operations: [] },
    privateAddress: { postalCode: '2' },
    seo: { title: '' },
    facts: { position: null },
  });
  assert.equal(partial.statusCode, 200, partial.body);
  assert.equal(partial.json().property.draft.editorial.title, '');
  assert.deepEqual(partial.json().property.draft.classification.operations, []);
  assert.equal(partial.json().property.draft.seo.title, '');
  assert.equal('position' in (partial.json().property.draft.facts ?? {}), false);
  const rejected = await app.inject({
    method: 'POST',
    url: `/api/admin/properties/${created.id}/publish`,
    headers: authHeaders(session, true),
    payload: {},
  });
  assert.equal(rejected.statusCode, 400);
  assert.ok(rejected.json().error.issues.some((issue: { path: string[] }) => issue.path.join('.') === 'editorial.title'));
});

test('lists sanitized summaries with bounded pagination, server sorting, private search, and canonical filters', async () => {
  const session = await authenticate();
  const target = await createDraft(session);
  const targetPayload = validProperty(target.commercialReference);
  const saved = await saveDraft(session, target.id, 1, targetPayload);
  assert.equal(saved.statusCode, 200, saved.body);

  const other = await createDraft(session);
  const otherPayload = validProperty(other.commercialReference, {
    classification: { operations: ['rent'], type: 'house', subtype: 'standard' },
    privateAddress: {
      postalCode: '22041-001',
      state: 'RJ',
      city: 'Rio de Janeiro',
      district: 'Copacabana',
      street: 'Rua Tonelero',
      number: '100',
    },
    publicLocation: { label: 'Copacabana, Rio de Janeiro - RJ', precision: 'approximate' },
    editorial: {
      title: 'Casa residencial perto da praia',
      description:
        'Casa residencial com planta funcional, ambientes arejados e acesso conveniente aos servicos do bairro e a praia.',
      reference: other.commercialReference,
      featured: false,
    },
    pricing: { rent: 6_500 },
  });
  assert.equal((await saveDraft(session, other.id, 1, otherPayload)).statusCode, 200);

  const query = new URLSearchParams({
    search: 'Avenida Paulista',
    status: 'draft',
    operation: 'sale',
    type: 'apartment',
    state: 'SP',
    city: 'Sao Paulo',
    district: 'Bela Vista',
    page: '1',
    limit: '20',
  });
  const filtered = await app.inject({
    method: 'GET',
    url: `/api/admin/properties?${query}`,
    headers: authHeaders(session),
  });
  assert.equal(filtered.statusCode, 200, filtered.body);
  assert.equal(filtered.json().items.length, 1);
  const summary = filtered.json().items[0];
  assert.equal(summary.id, target.id);
  assert.equal(summary.publicId, target.publicId);
  assert.equal(summary.reference, target.commercialReference);
  assert.equal(summary.title, targetPayload.editorial.title);
  assert.deepEqual(summary.location, { district: 'Bela Vista', city: 'Sao Paulo', state: 'SP' });
  assert.deepEqual(summary.classification, { operations: ['sale'] });
  assert.equal(summary.firstPrice, 850_000);
  for (const forbidden of ['draft', 'published', 'privateAddress', 'publicLocation', 'description', 'pricing', 'facts', 'features', 'media', 'seo']) {
    assert.equal(forbidden in summary, false, forbidden);
  }
  assert.doesNotMatch(JSON.stringify(summary), /Avenida Paulista|1578|complement|latitude|longitude|original|storage|imovelweb/i);
  assert.deepEqual(filtered.json().pagination, { page: 1, limit: 20, total: 1, pages: 1 });

  for (const search of [
    targetPayload.editorial.title,
    target.commercialReference,
    target.publicId,
    targetPayload.privateAddress.postalCode,
  ]) {
    const searched = await app.inject({
      method: 'GET',
      url: `/api/admin/properties?search=${encodeURIComponent(search)}`,
      headers: authHeaders(session),
    });
    assert.equal(searched.statusCode, 200, searched.body);
    assert.deepEqual(
      searched.json().items.map(({ id }: { id: string }) => id),
      [target.id],
      search,
    );
  }

  const repeated = await app.inject({
    method: 'GET',
    url: '/api/admin/properties?page=1&limit=20',
    headers: authHeaders(session),
  });
  const repeatedAgain = await app.inject({
    method: 'GET',
    url: '/api/admin/properties?page=1&limit=20',
    headers: authHeaders(session),
  });
  assert.deepEqual(
    repeated.json().items.map(({ id }: { id: string }) => id),
    repeatedAgain.json().items.map(({ id }: { id: string }) => id),
  );

  const titleSorted = await app.inject({
    method: 'GET',
    url: '/api/admin/properties?sort=title-asc&page=1&limit=20',
    headers: authHeaders(session),
  });
  assert.equal(titleSorted.statusCode, 200, titleSorted.body);
  assert.deepEqual(titleSorted.json().items.map(({ title }: { title: string }) => title), [
    'Apartamento ensolarado na Bela Vista',
    'Casa residencial perto da praia',
  ]);
  const priceSorted = await app.inject({
    method: 'GET',
    url: '/api/admin/properties?sort=price-asc&page=1&limit=1',
    headers: authHeaders(session),
  });
  assert.equal(priceSorted.statusCode, 200, priceSorted.body);
  assert.equal(priceSorted.json().items[0].firstPrice, 6_500);
  assert.deepEqual(priceSorted.json().pagination, { page: 1, limit: 1, total: 2, pages: 2 });
  const secondPage = await app.inject({
    method: 'GET',
    url: '/api/admin/properties?sort=price-asc&page=2&limit=1',
    headers: authHeaders(session),
  });
  assert.equal(secondPage.json().items[0].firstPrice, 850_000);

  const unbounded = await app.inject({
    method: 'GET',
    url: '/api/admin/properties?limit=1000',
    headers: authHeaders(session),
  });
  assert.equal(unbounded.statusCode, 400);
  assert.equal(unbounded.json().error.code, API_ERROR_CODES.VALIDATION_FAILED);

  const invalidSort = await app.inject({
    method: 'GET',
    url: '/api/admin/properties?sort=private-address-asc',
    headers: authHeaders(session),
  });
  assert.equal(invalidSort.statusCode, 400);
  assert.equal(invalidSort.json().error.code, API_ERROR_CODES.VALIDATION_FAILED);
});

test('duplicates canonical content as a distinct media-free draft without publication history', async () => {
  const session = await authenticate();
  const source = await createDraft(session);
  const payload = validProperty(source.commercialReference, {
    media: { orderedPhotoIds: ['photo-safe'], coverPhotoId: 'photo-safe' },
    seo: { imagePhotoId: 'photo-safe' },
  });
  assert.equal((await saveDraft(session, source.id, 1, payload)).statusCode, 200);
  await publishDraft(sql, source.id);

  const response = await app.inject({
    method: 'POST',
    url: `/api/admin/properties/${source.id}/duplicate`,
    headers: authHeaders(session, true),
    payload: {},
  });
  assert.equal(response.statusCode, 201, response.body);
  const duplicate = response.json().property;
  assert.notEqual(duplicate.id, source.id);
  assert.notEqual(duplicate.publicId, source.publicId);
  assert.notEqual(duplicate.commercialReference, source.commercialReference);
  assert.notEqual(duplicate.slug, source.slug);
  assert.equal(duplicate.status, 'draft');
  assert.equal(duplicate.publishedRevisionId, null);
  assert.deepEqual(duplicate.draft.media, { orderedPhotoIds: [] });
  assert.deepEqual(duplicate.draft.seo, {});
  assert.match(duplicate.draft.editorial.title, /c.pia/i);
  assert.equal(duplicate.draft.editorial.reference, duplicate.commercialReference);

  const audit = await sql<{ action: string; property_id: string }[]>`
    SELECT action, property_id FROM audit_events WHERE action = 'property.duplicated'
  `;
  assert.deepEqual(Array.from(audit), [
    { action: 'property.duplicated', property_id: duplicate.id },
  ]);
});

test('rotates at most three published highlights in FIFO order and rejects drafts', async () => {
  const session = await authenticate();
  const properties: Array<{ id: string; reference: string }> = [];
  for (let index = 0; index < 4; index += 1) {
    const draft = await createDraft(session);
    const reference = `HIGHLIGHT-${index}`;
    const title = `Imóvel destaque ${index}`;
    assert.equal(
      (await saveDraft(session, draft.id, 1, validProperty(reference, {
        editorial: {
          ...validProperty(reference).editorial,
          title,
          reference,
        },
      }))).statusCode,
      200,
    );
    await publishDraft(sql, draft.id);
    properties.push({ id: draft.id, reference });
  }

  const draftOnly = await createDraft(session);
  const draftFeature = await app.inject({
    method: 'POST',
    url: `/api/admin/properties/${draftOnly.id}/feature`,
    headers: authHeaders(session, true),
    payload: {},
  });
  assert.equal(draftFeature.statusCode, 409);
  assert.equal(draftFeature.json().error.code, API_ERROR_CODES.INVALID_STATE);

  for (const property of properties) {
    const response = await app.inject({
      method: 'POST',
      url: `/api/admin/properties/${property.id}/feature`,
      headers: authHeaders(session, true),
      payload: {},
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.json().property.featured, true);
  }

  const featured = await sql<{ commercial_reference: string }[]>`
    SELECT commercial_reference
    FROM properties
    WHERE featured_at IS NOT NULL
    ORDER BY featured_at ASC, id ASC
  `;
  assert.deepEqual(featured.map(({ commercial_reference }) => commercial_reference), [
    'HIGHLIGHT-1', 'HIGHLIGHT-2', 'HIGHLIGHT-3',
  ]);

  const unfeatured = await app.inject({
    method: 'DELETE',
    url: `/api/admin/properties/${properties[2]!.id}/feature`,
    headers: authHeaders(session, true),
  });
  assert.equal(unfeatured.statusCode, 200, unfeatured.body);
  assert.equal(unfeatured.json().property.featured, false);
});

test('derives an exact title slug, updates it on title changes, and rejects duplicate titles', async () => {
  const session = await authenticate();
  const first = await createDraft(session);
  const firstTitle = 'Casa linear em Jardim América';
  const firstSave = await saveDraft(session, first.id, 1, validProperty(first.commercialReference, {
    editorial: { ...validProperty(first.commercialReference).editorial, title: firstTitle },
  }));
  assert.equal(firstSave.statusCode, 200, firstSave.body);
  assert.equal(firstSave.json().property.slug, 'casa-linear-em-jardim-america');

  const changedTitle = 'Apartamento amplo em Copacabana';
  const changed = await saveDraft(session, first.id, 2, {
    editorial: { title: changedTitle },
  });
  assert.equal(changed.statusCode, 200, changed.body);
  assert.equal(changed.json().property.slug, 'apartamento-amplo-em-copacabana');

  const second = await createDraft(session);
  const duplicate = await saveDraft(session, second.id, 1, validProperty(second.commercialReference, {
    editorial: { ...validProperty(second.commercialReference).editorial, title: changedTitle },
  }));
  assert.equal(duplicate.statusCode, 409, duplicate.body);
  assert.equal(duplicate.json().error.code, API_ERROR_CODES.CONFLICT);
});

test('validates publish requests, queues one global job, and does not move publication state', async () => {
  const session = await authenticate();
  const incomplete = await createDraft(session);
  const rejected = await app.inject({
    method: 'POST',
    url: `/api/admin/properties/${incomplete.id}/publish`,
    headers: authHeaders(session, true),
    payload: {},
  });
  assert.equal(rejected.statusCode, 400);
  assert.equal(rejected.json().error.code, API_ERROR_CODES.VALIDATION_FAILED);
  assert.equal(rejected.json().error.issues.length > 0, true);
  for (const issue of rejected.json().error.issues) {
    apiFieldIssueSchema.parse(issue);
  }

  const publishable = await createDraft(session);
  assert.equal(
    (await saveDraft(session, publishable.id, 1, validProperty(publishable.commercialReference)))
      .statusCode,
    200,
  );
  const queued = await app.inject({
    method: 'POST',
    url: `/api/admin/properties/${publishable.id}/publish`,
    headers: authHeaders(session, true),
    payload: {},
  });
  assert.equal(queued.statusCode, 202, queued.body);
  assert.equal(queued.json().job.status, 'queued');

  const persisted = await sql<
    { status: string; published_revision_id: string | null; draft_revision_id: string }[]
  >`SELECT status, published_revision_id, draft_revision_id FROM properties WHERE id = ${publishable.id}`;
  assert.equal(persisted[0]?.status, 'draft');
  assert.equal(persisted[0]?.published_revision_id, null);
  assert.equal(String(queued.json().job.revisionId), persisted[0]?.draft_revision_id);

  const other = await createDraft(session);
  assert.equal(
    (await saveDraft(session, other.id, 1, validProperty(other.commercialReference, {
      editorial: { ...validProperty(other.commercialReference).editorial, title: 'Apartamento amplo em Ipanema' },
    }))).statusCode,
    200,
  );
  const conflict = await app.inject({
    method: 'POST',
    url: `/api/admin/properties/${other.id}/publish`,
    headers: authHeaders(session, true),
    payload: {},
  });
  assert.equal(conflict.statusCode, 409);
  assert.equal(conflict.json().error.code, API_ERROR_CODES.PUBLICATION_JOB_ACTIVE);

  const audit = await sql<{ count: string }[]>`
    SELECT count(*)::text AS count
    FROM audit_events
    WHERE action = 'property.publish_requested' AND property_id = ${publishable.id}
  `;
  assert.equal(audit[0]?.count, '1');
});

test('inactivates and reactivates only valid states while preserving draft/published separation', async () => {
  const session = await authenticate();
  const source = await createDraft(session);
  assert.equal(
    (await saveDraft(session, source.id, 1, validProperty(source.commercialReference))).statusCode,
    200,
  );
  await publishDraft(sql, source.id);
  assert.equal(
    (await saveDraft(session, source.id, 2, { editorial: { featured: true } })).statusCode,
    200,
  );
  const beforeLifecycle = await sql<
    { draft_revision_id: string; published_revision_id: string }[]
  >`SELECT draft_revision_id, published_revision_id FROM properties WHERE id = ${source.id}`;
  assert.notEqual(
    beforeLifecycle[0]?.draft_revision_id,
    beforeLifecycle[0]?.published_revision_id,
  );

  const inactive = await app.inject({
    method: 'POST',
    url: `/api/admin/properties/${source.id}/inactivate`,
    headers: authHeaders(session, true),
    payload: {},
  });
  assert.equal(inactive.statusCode, 202, inactive.body);
  assert.equal(inactive.json().property.status, 'inactive');
  assert.equal(inactive.json().job.status, 'queued');
  assert.equal(inactive.json().job.revisionId, Number(beforeLifecycle[0]?.published_revision_id));

  const invalidInactive = await app.inject({
    method: 'POST',
    url: `/api/admin/properties/${source.id}/inactivate`,
    headers: authHeaders(session, true),
    payload: {},
  });
  assert.equal(invalidInactive.statusCode, 409);
  assert.equal(invalidInactive.json().error.code, API_ERROR_CODES.INVALID_STATE);

  await sql`
    UPDATE publication_jobs
    SET status = 'succeeded', started_at = clock_timestamp(), finished_at = clock_timestamp()
    WHERE property_id = ${source.id} AND status = 'queued'
  `;
  const reactivated = await app.inject({
    method: 'POST',
    url: `/api/admin/properties/${source.id}/reactivate`,
    headers: authHeaders(session, true),
    payload: {},
  });
  assert.equal(reactivated.statusCode, 202, reactivated.body);
  assert.equal(reactivated.json().property.status, 'published');
  assert.equal(reactivated.json().job.status, 'queued');

  const pointers = await sql<
    { draft_revision_id: string; published_revision_id: string }[]
  >`SELECT draft_revision_id, published_revision_id FROM properties WHERE id = ${source.id}`;
  assert.notEqual(pointers[0]?.draft_revision_id, pointers[0]?.published_revision_id);
  assert.deepEqual(Array.from(pointers), Array.from(beforeLifecycle));

  const lifecycleAudit = await sql<{ action: string }[]>`
    SELECT action
    FROM audit_events
    WHERE property_id = ${source.id} AND action IN ('property.inactivated', 'property.reactivated')
    ORDER BY id
  `;
  assert.deepEqual(lifecycleAudit.map(({ action }) => action), [
    'property.inactivated',
    'property.reactivated',
  ]);

  const draftOnly = await createDraft(session);
  const draftInactive = await app.inject({
    method: 'POST',
    url: `/api/admin/properties/${draftOnly.id}/inactivate`,
    headers: authHeaders(session, true),
    payload: {},
  });
  assert.equal(draftInactive.statusCode, 200, draftInactive.body);
  assert.equal(draftInactive.json().job, null);
  const draftReactivated = await app.inject({
    method: 'POST',
    url: `/api/admin/properties/${draftOnly.id}/reactivate`,
    headers: authHeaders(session, true),
    payload: {},
  });
  assert.equal(draftReactivated.statusCode, 200, draftReactivated.body);
  assert.equal(draftReactivated.json().property.status, 'draft');
  assert.equal(draftReactivated.json().job, null);
});

test('cancels a queued draft-only publish before inactivation and never lets it become runnable', async () => {
  const session = await authenticate();
  const property = await createDraft(session);
  assert.equal(
    (await saveDraft(session, property.id, 1, validProperty(property.commercialReference))).statusCode,
    200,
  );
  const queued = await app.inject({
    method: 'POST',
    url: `/api/admin/properties/${property.id}/publish`,
    headers: authHeaders(session, true),
    payload: {},
  });
  assert.equal(queued.statusCode, 202, queued.body);

  const inactive = await app.inject({
    method: 'POST',
    url: `/api/admin/properties/${property.id}/inactivate`,
    headers: authHeaders(session, true),
    payload: {},
  });
  assert.equal(inactive.statusCode, 200, inactive.body);
  assert.equal(inactive.json().property.status, 'inactive');
  assert.equal(inactive.json().job, null);

  const jobs = await sql<{ status: string; error_message: string | null }[]>`
    SELECT status, error_message FROM publication_jobs WHERE id = ${queued.json().job.id}
  `;
  assert.deepEqual(Array.from(jobs), [
    { status: 'failed', error_message: 'Cancelled because property was inactivated' },
  ]);
  assert.equal(await claimNextPublicationJob(sql), null);
});

test('refuses to inactivate while this property publication is already running', async () => {
  const session = await authenticate();
  const property = await createDraft(session);
  assert.equal(
    (await saveDraft(session, property.id, 1, validProperty(property.commercialReference))).statusCode,
    200,
  );
  const queued = await app.inject({
    method: 'POST',
    url: `/api/admin/properties/${property.id}/publish`,
    headers: authHeaders(session, true),
    payload: {},
  });
  await sql`
    UPDATE publication_jobs
    SET status = 'running', started_at = clock_timestamp()
    WHERE id = ${queued.json().job.id}
  `;

  const blocked = await app.inject({
    method: 'POST',
    url: `/api/admin/properties/${property.id}/inactivate`,
    headers: authHeaders(session, true),
    payload: {},
  });
  assert.equal(blocked.statusCode, 409, blocked.body);
  assert.equal(blocked.json().error.code, API_ERROR_CODES.PUBLICATION_JOB_ACTIVE);
  const status = await sql<{ status: string }[]>`
    SELECT status FROM properties WHERE id = ${property.id}
  `;
  assert.deepEqual(Array.from(status), [{ status: 'draft' }]);
});

test('returns typed not-found responses, audits mutations, and exposes no DELETE method', async () => {
  const session = await authenticate();
  const missingId = '00000000-0000-4000-8000-000000000000';
  const missing = await app.inject({
    method: 'GET',
    url: `/api/admin/properties/${missingId}`,
    headers: authHeaders(session),
  });
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.json().error.code, API_ERROR_CODES.NOT_FOUND);

  const created = await createDraft(session);
  await saveDraft(session, created.id, 1, { editorial: { description: 'Descrição parcial do rascunho.' } });
  const deleted = await app.inject({
    method: 'DELETE',
    url: `/api/admin/properties/${created.id}`,
    headers: authHeaders(session, true),
  });
  assert.equal(deleted.statusCode, 404);

  const events = await sql<{ action: string; actor_id: string | null; property_id: string | null }[]>`
    SELECT action, actor_id, property_id
    FROM audit_events
    WHERE action LIKE 'property.%'
    ORDER BY id
  `;
  assert.deepEqual(
    events.map(({ action }) => action),
    ['property.created', 'property.draft_saved'],
  );
  assert.ok(events.every(({ actor_id }) => actor_id === administratorId));
  assert.ok(events.every(({ property_id }) => property_id === created.id));
});

test('protects CEP and public-location preview routes with admin auth, CSRF, and non-leaking responses', async () => {
  const unauthenticated = await app.inject({
    method: 'GET',
    url: '/api/admin/location/cep/01310-100',
  });
  assert.equal(unauthenticated.statusCode, 401);
  assert.equal(unauthenticated.json().error.code, API_ERROR_CODES.AUTH_REQUIRED);

  const restricted = await authenticate(true);
  const passwordChangeRequired = await app.inject({
    method: 'GET',
    url: '/api/admin/location/cep/01310-100',
    headers: authHeaders(restricted),
  });
  assert.equal(passwordChangeRequired.statusCode, 403);
  assert.equal(passwordChangeRequired.json().error.code, API_ERROR_CODES.PASSWORD_CHANGE_REQUIRED);

  const session = await authenticate();
  const csrfRequired = await app.inject({
    method: 'POST',
    url: '/api/admin/location/preview',
    headers: authHeaders(session),
    payload: {},
  });
  assert.equal(csrfRequired.statusCode, 403);
  assert.equal(csrfRequired.json().error.code, API_ERROR_CODES.CSRF_INVALID);

  const privateAddress = {
    postalCode: '01310-100',
    state: 'SP',
    city: 'Sao Paulo',
    district: 'Bela Vista',
    street: 'Avenida Paulista',
    number: '1000',
    complement: 'Apto 101',
    latitude: -23.5614,
    longitude: -46.6559,
  };
  const preview = await app.inject({
    method: 'POST',
    url: '/api/admin/location/preview',
    headers: authHeaders(session, true),
    payload: { publicId: 'property_preview_test', privateAddress },
  });
  assert.equal(preview.statusCode, 200, preview.body);
  assert.deepEqual(Object.keys(preview.json()), ['publicLocation']);
  const serialized = preview.body;
  for (const privateToken of ['Avenida Paulista', '1000', 'Apto 101', '-23.5614', '-46.6559']) {
    assert.equal(serialized.includes(privateToken), false, privateToken);
  }
});
