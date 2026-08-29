import assert from 'node:assert/strict';
import { access, mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, beforeEach, test } from 'node:test';

import sharp from 'sharp';

import { seedAdministrator } from '../../scripts/admin/seedAdmin.ts';
import { createAdminSession, type CreatedSession } from '../auth/session.ts';
import { createPostgresClient } from '../db/client.ts';
import { migrate } from '../db/migrate.ts';
import { publishDraft } from '../db/propertyRepository.ts';
import {
  expireReleaseMediaReferences,
  recordReleaseMediaReferences,
} from '../db/releaseMediaRepository.ts';
import { assertDisposableTestDatabase } from '../db/testDatabaseSafety.ts';
import { MediaStorage } from '../media/storage.ts';
import { MAX_IMAGE_BYTES } from '../media/imageProcessor.ts';
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
    altTextByPhotoId: { [photo.id]: photo.altText },
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

test('accepts an actual 20 MB stream, rejects one extra byte, and removes staging on abort', async () => {
  const session = await authenticate();
  const property = await createDraft(session);
  const largeRoot = await mkdtemp(path.join(tmpdir(), 'clementino-media-limit-'));
  const largeApp = createServer({ sql, environment: 'test', mediaRoot: largeRoot });
  await largeApp.ready();
  try {
    const image = await png('#023047');
    const exact = Buffer.concat([image, Buffer.alloc(MAX_IMAGE_BYTES - image.byteLength)]);
    assert.equal(exact.byteLength, MAX_IMAGE_BYTES);
    const exactBoundary = `exact-${crypto.randomUUID()}`;
    const accepted = await largeApp.inject({
      method: 'POST',
      url: `/api/admin/properties/${property.id}/photos`,
      headers: {
        ...authHeaders(session, true),
        'if-match': '"1"',
        'content-type': `multipart/form-data; boundary=${exactBoundary}`,
      },
      payload: multipartBody(exactBoundary, exact, { mime: 'image/png' }),
    });
    assert.equal(accepted.statusCode, 201, accepted.body);

    const plusOne = Buffer.concat([exact, Buffer.alloc(1)]);
    const oversizedBoundary = `oversized-${crypto.randomUUID()}`;
    const rejected = await largeApp.inject({
      method: 'POST',
      url: `/api/admin/properties/${property.id}/photos`,
      headers: {
        ...authHeaders(session, true),
        'if-match': '"2"',
        'content-type': `multipart/form-data; boundary=${oversizedBoundary}`,
      },
      payload: multipartBody(oversizedBoundary, plusOne, { mime: 'image/png' }),
    });
    assert.equal(rejected.statusCode, 413, rejected.body);
    const staging = await readdir(path.join(largeRoot, '.staging')).catch(
      (error: NodeJS.ErrnoException) => (error.code === 'ENOENT' ? [] : Promise.reject(error)),
    );
    assert.deepEqual(staging, []);
  } finally {
    await largeApp.close();
    await rm(largeRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  }
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
    altTextByPhotoId: {
      [secondId]: second.json().photo.altText,
      [firstId]: first.json().photo.altText,
    },
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

test('persists actionable cleanup work when rollback cleanup fails', async () => {
  const session = await authenticate();
  const property = await createDraft(session);
  const originalRemoveContained = MediaStorage.prototype.removeContained;
  MediaStorage.prototype.removeContained = async function (targetPath: string): Promise<void> {
    if (targetPath.includes(`${path.sep}private${path.sep}`)) {
      throw new Error('injected private cleanup failure');
    }
    await originalRemoveContained.call(this, targetPath);
  };
  await sql.unsafe(`
    CREATE FUNCTION fail_queued_media_upload_audit() RETURNS trigger AS $$
    BEGIN RAISE EXCEPTION 'injected media audit failure'; END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER fail_queued_media_upload_audit_trigger
    BEFORE INSERT ON audit_events
    FOR EACH ROW WHEN (NEW.action = 'property.photo_uploaded')
    EXECUTE FUNCTION fail_queued_media_upload_audit();
  `);
  try {
    const failed = await upload(session, property.id, 1, await png('#ff006e'));
    assert.equal(failed.statusCode, 500, failed.body);
    const queued = await sql<{ paths: string[]; failure_reason: string; resolved_at: Date | null }[]>`
      SELECT paths, failure_reason, resolved_at FROM media_cleanup_queue
      WHERE property_id = ${property.id}
    `;
    assert.equal(queued.length, 1);
    assert.equal(queued[0]?.resolved_at, null);
    assert.match(queued[0]?.failure_reason ?? '', /cleanup failed/i);
    assert.ok(queued[0]?.paths.some((target) => target.includes(`${path.sep}private${path.sep}`)));
  } finally {
    MediaStorage.prototype.removeContained = originalRemoveContained;
    await sql.unsafe(`
      DROP TRIGGER IF EXISTS fail_queued_media_upload_audit_trigger ON audit_events;
      DROP FUNCTION IF EXISTS fail_queued_media_upload_audit();
    `);
  }
});

test('preserves shared deterministic derivatives when an identical re-upload rolls back', async () => {
  const session = await authenticate();
  const property = await createDraft(session);
  const image = await png('#006d77');
  const first = await upload(session, property.id, 1, image);
  assert.equal(first.statusCode, 201, first.body);

  const firstPaths = await sql<
    { storage_key: string; cover_storage_key: string; gallery_storage_key: string; thumb_storage_key: string }[]
  >`
    SELECT storage_key, cover_storage_key, gallery_storage_key, thumb_storage_key
    FROM property_media WHERE id = ${first.json().photo.id as string}
  `;
  const paths = firstPaths[0]!;
  await sql.unsafe(`DROP INDEX property_media_active_content_unique_idx`);
  await sql.unsafe(`
    CREATE FUNCTION fail_duplicate_photo_audit() RETURNS trigger AS $$
    BEGIN RAISE EXCEPTION 'injected duplicate upload failure'; END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER fail_duplicate_photo_audit_trigger
    BEFORE INSERT ON audit_events
    FOR EACH ROW WHEN (NEW.action = 'property.photo_uploaded')
    EXECUTE FUNCTION fail_duplicate_photo_audit();
  `);
  try {
    const failed = await upload(session, property.id, 2, image);
    assert.equal(failed.statusCode, 500, failed.body);
    const active = await sql<{ count: string }[]>`
      SELECT count(*)::text AS count FROM property_media
      WHERE property_id = ${property.id} AND removed_at IS NULL
    `;
    assert.equal(active[0]?.count, '1');
    for (const key of [
      paths.storage_key,
      paths.cover_storage_key,
      paths.gallery_storage_key,
      paths.thumb_storage_key,
    ]) {
      await access(path.join(mediaRoot, ...key.split('/')));
    }
  } finally {
    await sql.unsafe(`
      DROP TRIGGER IF EXISTS fail_duplicate_photo_audit_trigger ON audit_events;
      DROP FUNCTION IF EXISTS fail_duplicate_photo_audit();
      CREATE UNIQUE INDEX property_media_active_content_unique_idx
        ON property_media (property_id, checksum_sha256) WHERE removed_at IS NULL;
    `);
  }
});

test('serializes concurrent identical uploads with one active valid media row and no staging orphan', async () => {
  const session = await authenticate();
  const property = await createDraft(session);
  const image = await png('#0077b6');
  const responses = await Promise.all([
    upload(session, property.id, 1, image),
    upload(session, property.id, 1, image),
  ]);
  assert.equal(
    responses.filter((response) => response.statusCode === 201).length,
    1,
    responses.map((response) => `${response.statusCode}: ${response.body}`).join('\n'),
  );
  assert.equal(responses.filter((response) => response.statusCode === 409).length, 1);
  const media = await sql<
    { storage_key: string; cover_storage_key: string; gallery_storage_key: string; thumb_storage_key: string }[]
  >`
    SELECT storage_key, cover_storage_key, gallery_storage_key, thumb_storage_key
    FROM property_media WHERE property_id = ${property.id} AND removed_at IS NULL
  `;
  assert.equal(media.length, 1);
  for (const key of [
    media[0]!.storage_key,
    media[0]!.cover_storage_key,
    media[0]!.gallery_storage_key,
    media[0]!.thumb_storage_key,
  ]) {
    await access(path.join(mediaRoot, ...key.split('/')));
  }
  const stagingRoot = path.join(mediaRoot, '.staging');
  const stagingEntries = await readdir(stagingRoot).catch((error: NodeJS.ErrnoException) =>
    error.code === 'ENOENT' ? [] : Promise.reject(error),
  );
  assert.deepEqual(
    await Promise.all(
      stagingEntries.map(async (entry) => ({ entry, contents: await readdir(path.join(stagingRoot, entry)) })),
    ),
    [],
  );
});

test('keeps published alt text snapshot while the draft gets its own newer alt text', async () => {
  const session = await authenticate();
  const property = await createDraft(session);
  await completeDraft(session, property);
  const uploaded = await upload(session, property.id, 2, await png('#9b2226'), {
    altText: 'Texto alternativo publicado',
  });
  assert.equal(uploaded.statusCode, 201, uploaded.body);
  const photoId = uploaded.json().photo.id as string;
  await publishDraft(sql, property.id);
  const edited = await app.inject({
    method: 'PATCH',
    url: `/api/admin/properties/${property.id}/photos/${photoId}`,
    headers: { ...authHeaders(session, true), 'if-match': '"3"' },
    payload: { altText: 'Texto alternativo novo no rascunho' },
  });
  assert.equal(edited.statusCode, 200, edited.body);
  const revisions = await sql<{ revision_number: string; payload: { media: { altTextByPhotoId: Record<string, string> } } }[]>`
    SELECT revision_number, payload FROM property_revisions
    WHERE property_id = ${property.id} AND revision_number IN (3, 4)
    ORDER BY revision_number
  `;
  assert.equal(revisions[0]?.payload.media.altTextByPhotoId[photoId], 'Texto alternativo publicado');
  assert.equal(revisions[1]?.payload.media.altTextByPhotoId[photoId], 'Texto alternativo novo no rascunho');
});

test('retains deleted media for explicit active releases and makes it GC eligible after release expiry', async () => {
  const session = await authenticate();
  const property = await createDraft(session);
  await completeDraft(session, property);
  const uploaded = await upload(session, property.id, 2, await png('#3a86ff'));
  assert.equal(uploaded.statusCode, 201, uploaded.body);
  const photoId = uploaded.json().photo.id as string;
  await publishDraft(sql, property.id);
  const publishedRevision = await sql<{ draft_revision_id: string }[]>`
    SELECT draft_revision_id FROM properties WHERE id = ${property.id}
  `;
  const job = await sql<{ id: string }[]>`
    INSERT INTO publication_jobs (property_id, revision_id, status, started_at, finished_at)
    VALUES (${property.id}, ${publishedRevision[0]!.draft_revision_id}, 'succeeded', clock_timestamp(), clock_timestamp())
    RETURNING id
  `;
  const release = await sql<{ id: string }[]>`
    INSERT INTO site_releases (publication_job_id, manifest) VALUES (${job[0]!.id}, '{}'::jsonb)
    RETURNING id
  `;
  await recordReleaseMediaReferences(sql, Number(release[0]!.id), [photoId]);
  const deleted = await app.inject({
    method: 'DELETE',
    url: `/api/admin/properties/${property.id}/photos/${photoId}`,
    headers: { ...authHeaders(session, true), 'if-match': '"3"' },
  });
  assert.equal(deleted.statusCode, 200, deleted.body);
  await publishDraft(sql, property.id);
  const retained = await sql<{ retained_for_publication: boolean; gc_eligible_at: Date | null }[]>`
    SELECT retained_for_publication, gc_eligible_at FROM property_media WHERE id = ${photoId}
  `;
  assert.equal(retained[0]?.retained_for_publication, true);
  assert.equal(retained[0]?.gc_eligible_at, null);
  await expireReleaseMediaReferences(sql, Number(release[0]!.id));
  const eligible = await sql<{ retained_for_publication: boolean; gc_eligible_at: Date | null }[]>`
    SELECT retained_for_publication, gc_eligible_at FROM property_media WHERE id = ${photoId}
  `;
  assert.equal(eligible[0]?.retained_for_publication, false);
  assert.ok(eligible[0]?.gc_eligible_at);
});

test('reevaluates deferred GC when the last explicit release is removed', async () => {
  const session = await authenticate();
  const property = await createDraft(session);
  await completeDraft(session, property);
  const uploaded = await upload(session, property.id, 2, await png('#8338ec'));
  assert.equal(uploaded.statusCode, 201, uploaded.body);
  const photoId = uploaded.json().photo.id as string;
  await publishDraft(sql, property.id);
  const revision = await sql<{ draft_revision_id: string }[]>`
    SELECT draft_revision_id FROM properties WHERE id = ${property.id}
  `;
  const job = await sql<{ id: string }[]>`
    INSERT INTO publication_jobs (property_id, revision_id, status, started_at, finished_at)
    VALUES (${property.id}, ${revision[0]!.draft_revision_id}, 'succeeded', clock_timestamp(), clock_timestamp())
    RETURNING id
  `;
  const release = await sql<{ id: string }[]>`
    INSERT INTO site_releases (publication_job_id, manifest) VALUES (${job[0]!.id}, '{}'::jsonb)
    RETURNING id
  `;
  await recordReleaseMediaReferences(sql, Number(release[0]!.id), [photoId]);
  const deleted = await app.inject({
    method: 'DELETE',
    url: `/api/admin/properties/${property.id}/photos/${photoId}`,
    headers: { ...authHeaders(session, true), 'if-match': '"3"' },
  });
  assert.equal(deleted.statusCode, 200, deleted.body);
  await publishDraft(sql, property.id);
  await sql`DELETE FROM site_releases WHERE id = ${release[0]!.id}`;
  const eligible = await sql<{ retained_for_publication: boolean; gc_eligible_at: Date | null }[]>`
    SELECT retained_for_publication, gc_eligible_at FROM property_media WHERE id = ${photoId}
  `;
  assert.equal(eligible[0]?.retained_for_publication, false);
  assert.ok(eligible[0]?.gc_eligible_at);
});
