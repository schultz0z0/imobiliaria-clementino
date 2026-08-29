import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import { API_ERROR_CODES } from '../../shared/apiContract.ts';
import { type AdminPropertyDraft, getPropertyDetail, PropertyServiceError } from '../domain/propertyService.ts';
import { type Sql, type SqlExecutor, withTransaction } from '../db/client.ts';
import type { ProcessedPropertyImage } from './imageProcessor.ts';
import { MediaStorage, type MediaDerivative } from './storage.ts';

const altTextSchema = z.string().trim().min(5).max(180);

type LockedProperty = {
  id: string;
  public_id: string;
  draft_revision_id: string;
  published_revision_id: string | null;
  revision_number: string;
  payload: AdminPropertyDraft;
};

type MediaRow = {
  id: string;
  property_id: string;
  mime_type: string;
  byte_size: string;
  width: number;
  height: number;
  checksum_sha256: string;
  alt_text: string;
  position: number;
  removed_at: Date | null;
};

export type MediaPhotoDto = {
  id: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  checksumSha256: string;
  altText: string;
  position: number;
};

const toPhotoDto = (row: MediaRow): MediaPhotoDto => ({
  id: row.id,
  mimeType: row.mime_type,
  byteSize: Number(row.byte_size),
  width: row.width,
  height: row.height,
  checksumSha256: row.checksum_sha256,
  altText: row.alt_text,
  position: row.position,
});

const stale = () =>
  new PropertyServiceError(API_ERROR_CODES.STALE_REVISION, 409, 'The draft revision is stale');
const notFound = (message = 'Property photo not found') =>
  new PropertyServiceError(API_ERROR_CODES.NOT_FOUND, 404, message);
const invalidMedia = (message: string, path: Array<string | number> = ['media']) =>
  new PropertyServiceError(API_ERROR_CODES.VALIDATION_FAILED, 400, message, [{ path, message }]);

const isPostgresError = (error: unknown, code: string): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === code;

const lockProperty = async (
  sql: SqlExecutor,
  propertyId: string,
  expectedRevision: number,
): Promise<LockedProperty> => {
  const rows = await sql<LockedProperty[]>`
    SELECT
      properties.id,
      properties.public_id,
      properties.draft_revision_id,
      properties.published_revision_id,
      property_revisions.revision_number,
      property_revisions.payload
    FROM properties
    JOIN property_revisions ON property_revisions.id = properties.draft_revision_id
    WHERE properties.id = ${propertyId}
    FOR UPDATE OF properties
  `;
  const property = rows[0];
  if (!property) {
    throw notFound('Property not found');
  }
  if (Number(property.revision_number) !== expectedRevision) {
    throw stale();
  }
  return property;
};

const activePhotos = async (sql: SqlExecutor, propertyId: string): Promise<MediaRow[]> =>
  sql<MediaRow[]>`
    SELECT
      id, property_id, mime_type, byte_size, width, height,
      checksum_sha256, alt_text, position, removed_at
    FROM property_media
    WHERE property_id = ${propertyId} AND removed_at IS NULL
    ORDER BY position, id
  `;

const insertRevision = async (
  sql: SqlExecutor,
  property: LockedProperty,
  expectedRevision: number,
  payload: AdminPropertyDraft,
  actorId: string,
): Promise<string> => {
  const rows = await sql<{ id: string }[]>`
    INSERT INTO property_revisions (property_id, revision_number, payload, created_by)
    VALUES (
      ${property.id},
      ${expectedRevision + 1},
      ${sql.json(payload)},
      ${actorId}
    )
    RETURNING id
  `;
  if (!rows[0]) {
    throw new Error('Media draft revision insert returned no row');
  }
  return rows[0].id;
};

const attachRevision = async (
  sql: SqlExecutor,
  propertyId: string,
  revisionId: string,
): Promise<void> => {
  await sql`
    UPDATE properties
    SET draft_revision_id = ${revisionId}, updated_at = clock_timestamp()
    WHERE id = ${propertyId}
  `;
};

const audit = async (
  sql: SqlExecutor,
  actorId: string,
  propertyId: string,
  action: string,
  metadata: Record<string, string | number | boolean | null | string[]>,
): Promise<void> => {
  await sql`
    INSERT INTO audit_events (actor_id, property_id, action, metadata)
    VALUES (${actorId}, ${propertyId}, ${action}, ${sql.json(metadata)})
  `;
};

const draftWithMedia = (
  draft: AdminPropertyDraft,
  orderedPhotoIds: string[],
  coverPhotoId?: string,
  altTextByPhotoId: Record<string, string> = draft.media?.altTextByPhotoId ?? {},
): AdminPropertyDraft => {
  const next = structuredClone(draft);
  next.media = {
    orderedPhotoIds,
    ...(coverPhotoId ? { coverPhotoId } : {}),
    ...(orderedPhotoIds.length > 0
      ? {
          altTextByPhotoId: Object.fromEntries(
            orderedPhotoIds.flatMap((photoId) =>
              altTextByPhotoId[photoId] ? [[photoId, altTextByPhotoId[photoId]]] : [],
            ),
          ),
        }
      : {}),
  };
  if (next.seo?.imagePhotoId && !orderedPhotoIds.includes(next.seo.imagePhotoId)) {
    delete next.seo.imagePhotoId;
  }
  return next;
};

const cleanupPromotedUpload = async (
  storage: MediaStorage,
  propertyId: string,
  mediaId: string,
  publicId: string,
  paths: string[],
): Promise<string[]> => {
  const cleanupTargets = [
    ...paths,
    storage.privateOriginalDirectory(propertyId, mediaId),
  ];
  const cleanupResults = await Promise.allSettled(
    cleanupTargets.map((targetPath) => storage.removeContained(targetPath)),
  );
  const pruneTasks = [storage.pruneEmptyDirectory(storage.privatePropertyDirectory(propertyId))];
  if (publicId) {
    pruneTasks.push(storage.pruneEmptyDirectory(storage.publicPropertyDirectory(publicId)));
  }
  await Promise.allSettled(pruneTasks);
  return cleanupResults.flatMap((result, index) =>
    result.status === 'rejected' ? [cleanupTargets[index]!] : [],
  );
};

export const createUploadedPhoto = async (input: {
  sql: Sql;
  storage: MediaStorage;
  propertyId: string;
  expectedRevision: number;
  actorId: string;
  stagedOriginalPath: string;
  processed: ProcessedPropertyImage;
  byteSize: number;
  altText?: string;
}) => {
  const mediaId = randomUUID();
  const promotedPaths: string[] = [];
  let publicId = '';
  try {
    return await withTransaction(input.sql, async (transaction) => {
      const property = await lockProperty(transaction, input.propertyId, input.expectedRevision);
      publicId = property.public_id;
      await transaction`SELECT pg_advisory_xact_lock(hashtextextended(${`${input.propertyId}:${input.processed.checksumSha256}`}, 0))`;
      const currentPhotos = await activePhotos(transaction, input.propertyId);
      if (currentPhotos.length >= 100) {
        throw invalidMedia('A property may have at most 100 active photos', ['file']);
      }
      const currentIds = currentPhotos.map(({ id }) => id);
      const defaultAlt = `Foto do imóvel: ${property.payload.editorial?.title ?? property.public_id}`;
      const altText = altTextSchema.parse(input.altText ?? defaultAlt.slice(0, 180));
      const nextIds = [...currentIds, mediaId];
      const currentCover = property.payload.media?.coverPhotoId;
      const nextCover = currentCover && currentIds.includes(currentCover) ? currentCover : mediaId;
      const nextDraft = draftWithMedia(property.payload, nextIds, nextCover, {
        ...(property.payload.media?.altTextByPhotoId ?? {}),
        [mediaId]: altText,
      });
      const revisionId = await insertRevision(
        transaction,
        property,
        input.expectedRevision,
        nextDraft,
        input.actorId,
      );

      const originalPath = input.storage.privateOriginalPath(input.propertyId, mediaId);
      const derivativePaths = Object.fromEntries(
        (Object.keys(input.processed.derivatives) as MediaDerivative[]).map((variant) => [
          variant,
          input.storage.publicDerivativePath(publicId, input.processed.checksumSha256, variant),
        ]),
      ) as Record<MediaDerivative, string>;
      const inserted = await transaction<MediaRow[]>`
        INSERT INTO property_media (
          id, property_id, revision_id, photo_id, storage_key, mime_type,
          byte_size, width, height, checksum_sha256, alt_text, position,
          cover_storage_key, gallery_storage_key, thumb_storage_key, uploaded_by
        ) VALUES (
          ${mediaId}, ${input.propertyId}, ${revisionId}, ${mediaId},
          ${input.storage.relativeKey(originalPath)}, ${input.processed.mimeType},
          ${input.byteSize}, ${input.processed.width}, ${input.processed.height},
          ${input.processed.checksumSha256}, ${altText}, ${currentIds.length},
          ${input.storage.relativeKey(derivativePaths.cover)},
          ${input.storage.relativeKey(derivativePaths.gallery)},
          ${input.storage.relativeKey(derivativePaths.thumb)}, ${input.actorId}
        )
        RETURNING
          id, property_id, mime_type, byte_size, width, height,
          checksum_sha256, alt_text, position, removed_at
      `;
      const originalPromotion = await input.storage.promoteFile(
        input.stagedOriginalPath,
        originalPath,
        0o600,
      );
      if (!originalPromotion.created) {
        throw new Error('Refusing to reuse a private media original');
      }
      promotedPaths.push(originalPath);
      for (const variant of ['cover', 'gallery', 'thumb'] as const) {
        const promotion = await input.storage.promoteFile(
          input.processed.derivatives[variant].path,
          derivativePaths[variant],
          0o644,
        );
        if (promotion.created) {
          promotedPaths.push(derivativePaths[variant]);
        }
      }
      await attachRevision(transaction, input.propertyId, revisionId);
      await audit(transaction, input.actorId, input.propertyId, 'property.photo_uploaded', {
        photoId: mediaId,
        revisionNumber: input.expectedRevision + 1,
        checksumSha256: input.processed.checksumSha256,
      });
      return {
        photo: toPhotoDto(inserted[0]!),
        property: await getPropertyDetail(transaction, input.propertyId),
      };
    });
  } catch (error) {
    const failedCleanupPaths = await cleanupPromotedUpload(
      input.storage,
      input.propertyId,
      mediaId,
      publicId,
      promotedPaths,
    );
    if (failedCleanupPaths.length > 0) {
      await input.sql`
        INSERT INTO media_cleanup_queue (property_id, media_id, paths, failure_reason)
        VALUES (
          ${input.propertyId},
          ${mediaId},
          ${input.sql.json(failedCleanupPaths)},
          ${'Promoted media cleanup failed after a rolled-back upload'}
        )
      `;
      throw new Error('Media cleanup was queued after a failed upload');
    }
    if (isPostgresError(error, '23505')) {
      throw new PropertyServiceError(
        API_ERROR_CODES.CONFLICT,
        409,
        'This property already has the same photo content',
      );
    }
    throw error;
  }
};

export const orderPropertyPhotos = async (input: {
  sql: Sql;
  propertyId: string;
  expectedRevision: number;
  actorId: string;
  orderedPhotoIds: string[];
  coverPhotoId: string;
}) =>
  withTransaction(input.sql, async (transaction) => {
    const property = await lockProperty(transaction, input.propertyId, input.expectedRevision);
    const photos = await activePhotos(transaction, input.propertyId);
    const activeIds = photos.map(({ id }) => id);
    if (new Set(input.orderedPhotoIds).size !== input.orderedPhotoIds.length) {
      throw invalidMedia('Photo order may not contain duplicates', ['orderedPhotoIds']);
    }
    if (
      activeIds.length !== input.orderedPhotoIds.length ||
      activeIds.some((id) => !input.orderedPhotoIds.includes(id))
    ) {
      throw invalidMedia('Photo order must contain every active photo exactly once', [
        'orderedPhotoIds',
      ]);
    }
    if (!input.orderedPhotoIds.includes(input.coverPhotoId)) {
      throw invalidMedia('Cover photo must be present in the exact photo order', ['coverPhotoId']);
    }
    const nextDraft = draftWithMedia(
      property.payload,
      input.orderedPhotoIds,
      input.coverPhotoId,
    );
    const revisionId = await insertRevision(
      transaction,
      property,
      input.expectedRevision,
      nextDraft,
      input.actorId,
    );
    for (const [position, photoId] of input.orderedPhotoIds.entries()) {
      await transaction`
        UPDATE property_media SET position = ${position}
        WHERE id = ${photoId} AND property_id = ${input.propertyId} AND removed_at IS NULL
      `;
    }
    await attachRevision(transaction, input.propertyId, revisionId);
    await audit(transaction, input.actorId, input.propertyId, 'property.photos_reordered', {
      orderedPhotoIds: input.orderedPhotoIds,
      coverPhotoId: input.coverPhotoId,
      revisionNumber: input.expectedRevision + 1,
    });
    return getPropertyDetail(transaction, input.propertyId);
  });

export const editPropertyPhoto = async (input: {
  sql: Sql;
  propertyId: string;
  photoId: string;
  expectedRevision: number;
  actorId: string;
  altText: string;
}) =>
  withTransaction(input.sql, async (transaction) => {
    const property = await lockProperty(transaction, input.propertyId, input.expectedRevision);
    const altText = altTextSchema.parse(input.altText);
    const rows = await transaction<MediaRow[]>`
      UPDATE property_media SET alt_text = ${altText}
      WHERE id = ${input.photoId} AND property_id = ${input.propertyId} AND removed_at IS NULL
      RETURNING
        id, property_id, mime_type, byte_size, width, height,
        checksum_sha256, alt_text, position, removed_at
    `;
    if (!rows[0]) {
      throw notFound();
    }
    const nextDraft = draftWithMedia(
      property.payload,
      property.payload.media?.orderedPhotoIds ?? [],
      property.payload.media?.coverPhotoId,
      {
        ...(property.payload.media?.altTextByPhotoId ?? {}),
        [input.photoId]: altText,
      },
    );
    const revisionId = await insertRevision(
      transaction,
      property,
      input.expectedRevision,
      nextDraft,
      input.actorId,
    );
    await attachRevision(transaction, input.propertyId, revisionId);
    await audit(transaction, input.actorId, input.propertyId, 'property.photo_alt_text_changed', {
      photoId: input.photoId,
      revisionNumber: input.expectedRevision + 1,
    });
    return {
      photo: toPhotoDto(rows[0]),
      property: await getPropertyDetail(transaction, input.propertyId),
    };
  });

export const deletePropertyPhoto = async (input: {
  sql: Sql;
  propertyId: string;
  photoId: string;
  expectedRevision: number;
  actorId: string;
}) =>
  withTransaction(input.sql, async (transaction) => {
    const property = await lockProperty(transaction, input.propertyId, input.expectedRevision);
    const photos = await activePhotos(transaction, input.propertyId);
    if (!photos.some(({ id }) => id === input.photoId)) {
      throw notFound();
    }
    const nextIds = photos.map(({ id }) => id).filter((id) => id !== input.photoId);
    const currentCover = property.payload.media?.coverPhotoId;
    const nextCover = currentCover === input.photoId ? nextIds[0] : currentCover;
    const nextDraft = draftWithMedia(
      property.payload,
      nextIds,
      nextCover,
      property.payload.media?.altTextByPhotoId ?? {},
    );
    const revisionId = await insertRevision(
      transaction,
      property,
      input.expectedRevision,
      nextDraft,
      input.actorId,
    );
    const references = await transaction<{ retained: boolean }[]>`
      SELECT (
        EXISTS (
          SELECT 1
          FROM property_revisions published_revision
          WHERE published_revision.id = ${property.published_revision_id}
            AND (published_revision.payload #> '{media,orderedPhotoIds}') ? ${input.photoId}
        )
        OR EXISTS (
          SELECT 1
          FROM release_media_refs
          JOIN site_releases ON site_releases.id = release_media_refs.release_id
          WHERE release_media_refs.media_id = ${input.photoId}
            AND (site_releases.expires_at IS NULL OR site_releases.expires_at > clock_timestamp())
        )
      ) AS retained
    `;
    const retained = references[0]?.retained ?? false;
    await transaction`
      UPDATE property_media
      SET
        removed_at = clock_timestamp(),
        retained_for_publication = ${retained},
        gc_eligible_at = CASE
          WHEN ${retained} THEN NULL
          ELSE clock_timestamp() + interval '30 days'
        END
      WHERE id = ${input.photoId} AND property_id = ${input.propertyId} AND removed_at IS NULL
    `;
    for (const [position, photoId] of nextIds.entries()) {
      await transaction`
        UPDATE property_media SET position = ${position}
        WHERE id = ${photoId} AND property_id = ${input.propertyId} AND removed_at IS NULL
      `;
    }
    await attachRevision(transaction, input.propertyId, revisionId);
    await audit(transaction, input.actorId, input.propertyId, 'property.photo_removed', {
      photoId: input.photoId,
      retainedForPublication: retained,
      revisionNumber: input.expectedRevision + 1,
    });
    return {
      property: await getPropertyDetail(transaction, input.propertyId),
      deletion: { state: 'deferred', retainedForPublication: retained },
    };
  });
