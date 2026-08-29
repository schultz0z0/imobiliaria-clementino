import { type SqlExecutor, withTransaction } from './client.ts';
import { recordReleaseMediaReferences } from './releaseMediaRepository.ts';

export type PublicationStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export type PublicationJobRecord = {
  id: number;
  propertyId: string;
  revisionId: number;
  status: PublicationStatus;
  attempts: number;
  errorMessage: string | null;
  requestedBy: string | null;
  queuedAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
};

export type EnqueuePublicationJobInput = {
  propertyId: string;
  revisionId: number;
  requestedBy?: string | null;
};

export type RecordSuccessfulReleaseInput = {
  jobId: number;
  revisionId: number;
  releasePath: string;
  mediaIds: readonly string[];
  createdBy?: string | null;
};

export type SuccessfulReleaseRecord = {
  id: number;
  releasePath: string;
  job: PublicationJobRecord;
};

type PublicationJobRow = {
  id: string;
  property_id: string;
  revision_id: string;
  status: PublicationStatus;
  attempts: number;
  error_message: string | null;
  requested_by: string | null;
  queued_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
};

const jobColumns = `
  id,
  property_id,
  revision_id,
  status,
  attempts,
  error_message,
  requested_by,
  queued_at,
  started_at,
  finished_at
`;

const toPublicationJobRecord = (row: PublicationJobRow): PublicationJobRecord => ({
  id: Number(row.id),
  propertyId: row.property_id,
  revisionId: Number(row.revision_id),
  status: row.status,
  attempts: row.attempts,
  errorMessage: row.error_message,
  requestedBy: row.requested_by,
  queuedAt: row.queued_at,
  startedAt: row.started_at,
  finishedAt: row.finished_at,
});

export const enqueuePublicationJob = async (
  sql: SqlExecutor,
  input: EnqueuePublicationJobInput,
): Promise<PublicationJobRecord> => {
  const rows = await sql<PublicationJobRow[]>`
    INSERT INTO publication_jobs (property_id, revision_id, requested_by)
    VALUES (${input.propertyId}, ${input.revisionId}, ${input.requestedBy ?? null})
    RETURNING
      id,
      property_id,
      revision_id,
      status,
      attempts,
      error_message,
      requested_by,
      queued_at,
      started_at,
      finished_at
  `;
  const job = rows[0];
  if (!job) {
    throw new Error('Failed to enqueue publication job');
  }
  return toPublicationJobRecord(job);
};

export const claimNextPublicationJob = async (
  sql: SqlExecutor,
): Promise<PublicationJobRecord | null> =>
  withTransaction(sql, async (transaction) => {
    await transaction`SELECT pg_advisory_xact_lock(hashtext('site_publication'))`;
    const rows = await transaction<PublicationJobRow[]>`
      WITH candidate AS (
        SELECT id
        FROM publication_jobs
        WHERE status = 'queued'
        ORDER BY queued_at, id
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      UPDATE publication_jobs AS job
      SET
        status = 'running',
        attempts = job.attempts + 1,
        started_at = clock_timestamp(),
        error_message = NULL
      FROM candidate
      WHERE job.id = candidate.id
      RETURNING
        job.id,
        job.property_id,
        job.revision_id,
        job.status,
        job.attempts,
        job.error_message,
        job.requested_by,
        job.queued_at,
        job.started_at,
        job.finished_at
    `;
    return rows[0] ? toPublicationJobRecord(rows[0]) : null;
  });

const finishPublicationJob = async (
  sql: SqlExecutor,
  jobId: number,
  status: 'succeeded' | 'failed',
  errorMessage: string | null,
): Promise<PublicationJobRecord> => {
  const rows = await sql<PublicationJobRow[]>`
    UPDATE publication_jobs
    SET
      status = ${status},
      error_message = ${errorMessage},
      finished_at = clock_timestamp()
    WHERE id = ${jobId} AND status = 'running'
    RETURNING
      id,
      property_id,
      revision_id,
      status,
      attempts,
      error_message,
      requested_by,
      queued_at,
      started_at,
      finished_at
  `;
  const job = rows[0];
  if (!job) {
    throw new Error(`Running publication job not found: ${jobId}`);
  }
  return toPublicationJobRecord(job);
};

export const completePublicationJob = (
  sql: SqlExecutor,
  jobId: number,
): Promise<PublicationJobRecord> => finishPublicationJob(sql, jobId, 'succeeded', null);

/**
 * Publisher-facing completion boundary: the release manifest, job completion,
 * and concrete media references commit together. `mediaIds` is accepted from
 * the publisher only after it matches the immutable revision snapshot exactly.
 */
export const recordSuccessfulRelease = async (
  sql: SqlExecutor,
  input: RecordSuccessfulReleaseInput,
): Promise<SuccessfulReleaseRecord> =>
  withTransaction(sql, async (transaction) => {
    if (!input.releasePath.trim()) {
      throw new Error('A successful release requires a non-empty release path');
    }
    const jobs = await transaction<PublicationJobRow[]>`
      SELECT ${transaction.unsafe(jobColumns)}
      FROM publication_jobs WHERE id = ${input.jobId} FOR UPDATE
    `;
    const job = jobs[0];
    if (!job || job.status !== 'running') {
      throw new Error(`Running publication job not found: ${input.jobId}`);
    }
    if (Number(job.revision_id) !== input.revisionId) {
      throw new Error('Successful release revision does not match the publication job');
    }
    const revisions = await transaction<{ payload: { media?: { orderedPhotoIds?: unknown } } }[]>`
      SELECT payload FROM property_revisions
      WHERE id = ${input.revisionId} AND property_id = ${job.property_id}
    `;
    const orderedPhotoIds = revisions[0]?.payload.media?.orderedPhotoIds;
    if (!Array.isArray(orderedPhotoIds) || !orderedPhotoIds.every((id) => typeof id === 'string')) {
      throw new Error('Publication revision has invalid media IDs');
    }
    if (
      orderedPhotoIds.length !== input.mediaIds.length ||
      orderedPhotoIds.some((mediaId, index) => mediaId !== input.mediaIds[index])
    ) {
      throw new Error('Successful release media IDs must exactly match the publication revision');
    }
    for (const mediaId of input.mediaIds) {
      const owned = await transaction<{ id: string }[]>`
        SELECT id FROM property_media WHERE id = ${mediaId} AND property_id = ${job.property_id}
      `;
      if (!owned[0]) {
        throw new Error(`Release media ${mediaId} does not belong to the publication property`);
      }
    }
    const releases = await transaction<{ id: string }[]>`
      INSERT INTO site_releases (publication_job_id, manifest, created_by)
      VALUES (
        ${input.jobId},
        ${transaction.json({ releasePath: input.releasePath })},
        ${input.createdBy ?? null}
      )
      RETURNING id
    `;
    const release = releases[0];
    if (!release) {
      throw new Error('Failed to record successful site release');
    }
    await recordReleaseMediaReferences(transaction, Number(release.id), input.mediaIds);
    const completed = await finishPublicationJob(transaction, input.jobId, 'succeeded', null);
    return { id: Number(release.id), releasePath: input.releasePath, job: completed };
  });

export const failPublicationJob = (
  sql: SqlExecutor,
  jobId: number,
  errorMessage: string,
): Promise<PublicationJobRecord> => finishPublicationJob(sql, jobId, 'failed', errorMessage);

export const getPublicationJobById = async (
  sql: SqlExecutor,
  jobId: number,
): Promise<PublicationJobRecord | null> => {
  const rows = await sql<PublicationJobRow[]>`
    SELECT ${sql.unsafe(jobColumns)}
    FROM publication_jobs
    WHERE id = ${jobId}
  `;
  return rows[0] ? toPublicationJobRecord(rows[0]) : null;
};

export const getLatestPublicationJob = async (
  sql: SqlExecutor,
): Promise<PublicationJobRecord | null> => {
  const rows = await sql<PublicationJobRow[]>`
    SELECT ${sql.unsafe(jobColumns)}
    FROM publication_jobs
    ORDER BY queued_at DESC, id DESC
    LIMIT 1
  `;
  return rows[0] ? toPublicationJobRecord(rows[0]) : null;
};
