import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, beforeEach, test } from 'node:test';

import sharp from 'sharp';

import { seedAdministrator } from '../../scripts/admin/seedAdmin.ts';
import { createAdminSession, type CreatedSession } from '../auth/session.ts';
import { createPostgresClient } from '../db/client.ts';
import { migrate } from '../db/migrate.ts';
import { publishDraft } from '../db/propertyRepository.ts';
import { assertDisposableTestDatabase } from '../db/testDatabaseSafety.ts';
import { createServer } from './createServer.ts';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
assertDisposableTestDatabase(testDatabaseUrl);
const sql = createPostgresClient(testDatabaseUrl, { max: 16 });
const suiteLockKey = 1_988_042_702;
let suiteLock: Awaited<ReturnType<typeof sql.reserve>> | undefined;
let mediaRoot = '';
let app: ReturnType<typeof createServer>;
let administratorId = '';
const testFileLimit = 256 * 1024;
sharp.cache(false);

const authHeaders = (session: CreatedSession, csrf = false) => ({
  cookie: `clementino_admin_session=${session.token}; clementino_admin_csrf=${session.csrfToken}`,
  ...(csrf ? { 'x-csrf-token': session.csrfToken } : {}),
});

const authenticate = async (forcedPasswordChange = false): Promise<CreatedSession> => {
  if (!forcedPasswordChange) {
    await sql`UPDATE admin_users SET must_change_password = false WHERE id = ${administratorId}`;
  }
  return createAdminSession(sql, administratorId);
};

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
    revisionNumber: number;
  };
};

const completeDraft = async (
  session: CreatedSession,
  property: Awaited<ReturnType<typeof createDraft>>,
) => {
  const response = await app.inject({
    method: 'PATCH',
    url: `/api/admin/properties/${property.id}/draft`,
    headers: { ...authHeaders(session, true), 'if-match': '"1"' },
    payload: {
      classification: { operations: ['sale'], type: 'apartment', subtype: 'standard' },
      privateAddress: {
        postalCode: '01310-100',
        state: 'SP',
        city: 'São Paulo',
        district: 'Bela Vista',
        street: 'Avenida Paulista',
        number: '1000',
      },
      publicLocation: { label: 'Bela Vista, São Paulo - SP', precision: 'approximate' },
      facts: {
        isNew: false,
        ageYears: 8,
        bedrooms: 3,
        bathrooms: 2,
        suites: 1,
        parkingSpaces: 1,
      },
      features: { acceptsFgts: true, acceptsExchange: false, common: [], private: [] },
      editorial: {
        title: 'Apartamento ensolarado na Bela Vista',
        description:
          'Apartamento bem distribuído, com ambientes iluminados, boa ventilação e localização conveniente para toda a família.',
        reference: property.commercialReference,
        featured: false,
      },
      pricing: { sale: 850_000 },
      media: { orderedPhotoIds: [] },
      seo: {},
    },
  });
  assert.equal(response.statusCode, 200, response.body);
};

const multipartBody = (
  boundary: string,
  file: Buffer,
  options: { filename?: string; mime?: string; altText?: string } = {},
): Buffer => {
  const chunks: Buffer[] = [];
  if (options.altText !== undefined) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="altText"\r\n\r\n${options.altText}\r\n`,
      ),
    );
  }
  chunks.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${options.filename ?? 'photo.jpg'}"\r\nContent-Type: ${options.mime ?? 'application/octet-stream'}\r\n\r\n`,
    ),
    file,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  );
  return Buffer.concat(chunks);
};

const multipartTwoFiles = (boundary: string, first: Buffer, second: Buffer): Buffer =>
  Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="first.png"\r\nContent-Type: image/png\r\n\r\n`,
    ),
    first,
    Buffer.from(
      `\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="second.png"\r\nContent-Type: image/png\r\n\r\n`,
    ),
    second,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

const upload = async (
  session: CreatedSession,
  propertyId: string,
  revision: number,
  file: Buffer,
  options: { filename?: string; mime?: string; altText?: string; csrf?: boolean } = {},
) => {
  const boundary = `clementino-${crypto.randomUUID()}`;
  return app.inject({
    method: 'POST',
    url: `/api/admin/properties/${propertyId}/photos`,
    headers: {
      ...authHeaders(session, options.csrf ?? true),
      'if-match': `"${revision}"`,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    payload: multipartBody(boundary, file, options),
  });
};

const png = (colour: string) =>
  sharp({ create: { width: 64, height: 48, channels: 3, background: colour } })
    .png()
    .toBuffer();

before(async () => {
  suiteLock = await sql.reserve();
  await suiteLock`SELECT pg_advisory_lock(${suiteLockKey})`;
  await migrate(sql);
  mediaRoot = await mkdtemp(path.join(tmpdir(), 'clementino-media-api-'));
  app = createServer({
    sql,
    environment: 'test',
    mediaRoot,
    mediaMaxImageBytes: testFileLimit,
  });
  await app.ready();
});

beforeEach(async () => {
  await sql.unsafe(`
    TRUNCATE TABLE
      audit_events, site_releases, publication_jobs, property_media,
      properties, property_revisions, admin_sessions, admin_users
    RESTART IDENTITY CASCADE
  `);
  administratorId = (
    await seedAdministrator(sql, {
      username: 'administrador',
      password: 'Senha inicial segura 2026!',
    })
  ).id;
});

after(async () => {
  await app.close();
  await rm(mediaRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  if (suiteLock) {
    await suiteLock`SELECT pg_advisory_unlock(${suiteLockKey})`;
    suiteLock.release();
  }
  await sql.end({ timeout: 5 });
});

test('requires authentication, completed password change, CSRF, and If-Match for uploads', async () => {
  const image = await png('#123456');
  const anonymousBoundary = 'anonymous-boundary';
  const anonymous = await app.inject({
    method: 'POST',
    url: '/api/admin/properties/11111111-1111-4111-8111-111111111111/photos',
    headers: { 'content-type': `multipart/form-data; boundary=${anonymousBoundary}` },
    payload: multipartBody(anonymousBoundary, image),
  });
  assert.equal(anonymous.statusCode, 401);
  assert.equal(anonymous.json().error.code, 'AUTH_REQUIRED');

  const forced = await authenticate(true);
  const forcedResponse = await upload(
    forced,
    '11111111-1111-4111-8111-111111111111',
    1,
    image,
  );
  assert.equal(forcedResponse.statusCode, 403);
  assert.equal(forcedResponse.json().error.code, 'PASSWORD_CHANGE_REQUIRED');

  await sql`UPDATE admin_users SET must_change_password = false WHERE id = ${administratorId}`;
  const property = await createDraft(forced);
  const missingCsrf = await upload(forced, property.id, 1, image, { csrf: false });
  assert.equal(missingCsrf.statusCode, 403);
  assert.equal(missingCsrf.json().error.code, 'CSRF_INVALID');

  const missingRevisionBoundary = 'missing-revision';
  const missingRevision = await app.inject({
    method: 'POST',
    url: `/api/admin/properties/${property.id}/photos`,
    headers: {
      ...authHeaders(forced, true),
      'content-type': `multipart/form-data; boundary=${missingRevisionBoundary}`,
    },
    payload: multipartBody(missingRevisionBoundary, image),
  });
  assert.equal(missingRevision.statusCode, 400);
  assert.equal(missingRevision.json().error.code, 'VALIDATION_FAILED');
});

test('streams a byte-sniffed upload, creates immutable derivatives, and defaults Portuguese alt text', async () => {
  const session = await authenticate();
  const property = await createDraft(session);
  const image = await png('#8b4513');
  const response = await upload(session, property.id, 1, image, {
    filename: 'misleading.jpeg',
    mime: 'text/plain',
  });

  assert.equal(response.statusCode, 201, response.body);
  const { photo, property: updated } = response.json();
  assert.equal(updated.revisionNumber, 2);
  assert.deepEqual(updated.draft.media, {
    orderedPhotoIds: [photo.id],
    coverPhotoId: photo.id,
  });
  assert.equal(photo.mimeType, 'image/png');
  assert.match(photo.altText, /^Foto do im.vel/i);
  assert.match(photo.id, /^[0-9a-f-]{36}$/i);

  const rows = await sql<
    { storage_key: string; cover_storage_key: string; checksum_sha256: string }[]
  >`SELECT storage_key, cover_storage_key, checksum_sha256 FROM property_media WHERE id = ${photo.id}`;
  assert.equal(rows.length, 1);
  assert.match(rows[0]!.storage_key, /^private\//);
  assert.match(rows[0]!.cover_storage_key, new RegExp(`${rows[0]!.checksum_sha256}-cover\\.webp$`));
  const privateOriginal = path.join(mediaRoot, ...rows[0]!.storage_key.split('/'));
  const cover = path.join(mediaRoot, ...rows[0]!.cover_storage_key.split('/'));
  assert.equal((await stat(privateOriginal)).size, image.byteLength);
  assert.equal((await sharp(cover).metadata()).format, 'webp');
});

test('rejects content whose magic prefix cannot be decoded', async () => {
  const session = await authenticate();
  const property = await createDraft(session);
  const broken = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
  const invalid = await upload(session, property.id, 1, broken);
  assert.equal(invalid.statusCode, 400, invalid.body);
  assert.equal(invalid.json().error.code, 'VALIDATION_FAILED');
});

test('rejects an oversized multipart file while streaming it', async () => {
  const session = await authenticate();
  const property = await createDraft(session);
  const huge = Buffer.alloc(testFileLimit + 1, 0);
  const oversized = await upload(session, property.id, 1, huge);
  assert.equal(oversized.statusCode, 413, oversized.body);
});

test('rejects a second multipart file without creating media', async () => {
  const session = await authenticate();
  const property = await createDraft(session);
  const boundary = `two-files-${crypto.randomUUID()}`;
  const response = await app.inject({
    method: 'POST',
    url: `/api/admin/properties/${property.id}/photos`,
    headers: {
      ...authHeaders(session, true),
      'if-match': '"1"',
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    payload: multipartTwoFiles(boundary, await png('#111'), await png('#222')),
  });
  assert.ok([400, 413].includes(response.statusCode), response.body);
  const rows = await sql<{ count: string }[]>`
    SELECT count(*)::text AS count FROM property_media WHERE property_id = ${property.id}
  `;
  assert.equal(rows[0]?.count, '0');
});

test('deduplicates property content without extra revisions or media rows', async () => {
  const session = await authenticate();
  const property = await createDraft(session);
  const image = await png('#008080');
  const first = await upload(session, property.id, 1, image);
  assert.equal(first.statusCode, 201, first.body);
  const duplicate = await upload(session, property.id, 2, image);
  assert.equal(duplicate.statusCode, 409, duplicate.body);
  assert.equal(duplicate.json().error.code, 'CONFLICT');
  const counts = await sql<{ media: string; revisions: string }[]>`
    SELECT
      (SELECT count(*)::text FROM property_media WHERE property_id = ${property.id}) AS media,
      (SELECT count(*)::text FROM property_revisions WHERE property_id = ${property.id}) AS revisions
  `;
  assert.deepEqual(Array.from(counts), [{ media: '1', revisions: '2' }]);

  const otherProperty = await createDraft(session);
  const otherUpload = await upload(session, otherProperty.id, 1, image);
  assert.equal(otherUpload.statusCode, 201, otherUpload.body);
});

test('enforces exact owned active photo order, cover membership, and optimistic revisions', async () => {
  const session = await authenticate();
  const property = await createDraft(session);
  const first = await upload(session, property.id, 1, await png('#ff0000'));
  const second = await upload(session, property.id, 2, await png('#0000ff'));
  const firstId = first.json().photo.id as string;
  const secondId = second.json().photo.id as string;

  for (const payload of [
    { orderedPhotoIds: [firstId], coverPhotoId: firstId },
    { orderedPhotoIds: [firstId, firstId], coverPhotoId: firstId },
    { orderedPhotoIds: [firstId, crypto.randomUUID()], coverPhotoId: firstId },
    { orderedPhotoIds: [firstId, secondId], coverPhotoId: crypto.randomUUID() },
  ]) {
    const invalid = await app.inject({
      method: 'PATCH',
      url: `/api/admin/properties/${property.id}/photos/order`,
      headers: { ...authHeaders(session, true), 'if-match': '"3"' },
      payload,
    });
    assert.equal(invalid.statusCode, 400, invalid.body);
  }

  const ordered = await app.inject({
    method: 'PATCH',
    url: `/api/admin/properties/${property.id}/photos/order`,
    headers: { ...authHeaders(session, true), 'if-match': '"3"' },
    payload: { orderedPhotoIds: [secondId, firstId], coverPhotoId: secondId },
  });
  assert.equal(ordered.statusCode, 200, ordered.body);
  assert.equal(ordered.json().property.revisionNumber, 4);
  assert.deepEqual(ordered.json().property.draft.media, {
    orderedPhotoIds: [secondId, firstId],
    coverPhotoId: secondId,
  });

  const stale = await app.inject({
    method: 'PATCH',
    url: `/api/admin/properties/${property.id}/photos/order`,
    headers: { ...authHeaders(session, true), 'if-match': '"3"' },
    payload: { orderedPhotoIds: [firstId, secondId], coverPhotoId: firstId },
  });
  assert.equal(stale.statusCode, 409);
  assert.equal(stale.json().error.code, 'STALE_REVISION');
});

test('edits bounded alt text and defers physical deletion referenced by a published revision', async () => {
  const session = await authenticate();
  const property = await createDraft(session);
  await completeDraft(session, property);
  const uploaded = await upload(session, property.id, 2, await png('#4b0082'));
  const photoId = uploaded.json().photo.id as string;

  const invalidAlt = await app.inject({
    method: 'PATCH',
    url: `/api/admin/properties/${property.id}/photos/${photoId}`,
    headers: { ...authHeaders(session, true), 'if-match': '"3"' },
    payload: { altText: 'x' },
  });
  assert.equal(invalidAlt.statusCode, 400, invalidAlt.body);

  const edited = await app.inject({
    method: 'PATCH',
    url: `/api/admin/properties/${property.id}/photos/${photoId}`,
    headers: { ...authHeaders(session, true), 'if-match': '"3"' },
    payload: { altText: 'Sala iluminada com janelas amplas' },
  });
  assert.equal(edited.statusCode, 200, edited.body);
  assert.equal(edited.json().photo.altText, 'Sala iluminada com janelas amplas');
  assert.equal(edited.json().property.revisionNumber, 4);

  await publishDraft(sql, property.id);
  const stored = await sql<{ storage_key: string; cover_storage_key: string }[]>`
    SELECT storage_key, cover_storage_key FROM property_media WHERE id = ${photoId}
  `;
  const removed = await app.inject({
    method: 'DELETE',
    url: `/api/admin/properties/${property.id}/photos/${photoId}`,
    headers: { ...authHeaders(session, true), 'if-match': '"4"' },
  });
  assert.equal(removed.statusCode, 200, removed.body);
  assert.deepEqual(removed.json().property.draft.media, { orderedPhotoIds: [] });

  const state = await sql<
    { removed_at: Date | null; gc_eligible_at: Date | null; retained_for_publication: boolean }[]
  >`SELECT removed_at, gc_eligible_at, retained_for_publication FROM property_media WHERE id = ${photoId}`;
  assert.ok(state[0]?.removed_at);
  assert.equal(state[0]?.gc_eligible_at, null);
  assert.equal(state[0]?.retained_for_publication, true);
  await stat(path.join(mediaRoot, ...stored[0]!.storage_key.split('/')));
  await stat(path.join(mediaRoot, ...stored[0]!.cover_storage_key.split('/')));
});

test('removes every newly promoted file if the database transaction fails', async () => {
  const session = await authenticate();
  const property = await createDraft(session);
  await sql.unsafe(`
    CREATE FUNCTION fail_media_upload_audit() RETURNS trigger AS $$
    BEGIN RAISE EXCEPTION 'injected media audit failure'; END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER fail_media_upload_audit_trigger
    BEFORE INSERT ON audit_events
    FOR EACH ROW WHEN (NEW.action = 'property.photo_uploaded')
    EXECUTE FUNCTION fail_media_upload_audit();
  `);
  try {
    const failed = await upload(session, property.id, 1, await png('#daa520'));
    assert.equal(failed.statusCode, 500, failed.body);
    assert.equal(failed.body.includes('injected media audit failure'), false);
    const rows = await sql<{ count: string }[]>`
      SELECT count(*)::text AS count FROM property_media WHERE property_id = ${property.id}
    `;
    assert.equal(rows[0]?.count, '0');
    const privatePropertyDirectory = path.join(mediaRoot, 'private', property.id);
    await assert.rejects(readdir(privatePropertyDirectory));
    const publicPropertyDirectory = path.join(mediaRoot, 'public', 'imoveis', property.publicId);
    await assert.rejects(readdir(publicPropertyDirectory));
  } finally {
    await sql.unsafe(`
      DROP TRIGGER IF EXISTS fail_media_upload_audit_trigger ON audit_events;
      DROP FUNCTION IF EXISTS fail_media_upload_audit();
    `);
  }
});
