import { mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { PropertyDraft } from '../../shared/propertySchema.ts';
import type { Sql } from '../db/client.ts';
import { claimNextPublicationJob, failPublicationJob, recordSuccessfulRelease } from '../db/publicationRepository.ts';
import { activateRelease, activeReleaseId, prepareReleaseDirectory, rollbackRelease } from './releaseStorage.ts';
import { validateRelease } from './releaseValidation.ts';

export type ReleasePublisherOptions = { publishedRoot: string; expectedPropertyCount?: number; build: (releasePath: string) => Promise<{ propertyCount: number; routeCount: number }> };

export const publishRelease = async (options: ReleasePublisherOptions) => {
  mkdirSync(options.publishedRoot, { recursive: true });
  const releaseId = `${new Date().toISOString().replace(/[-:.TZ]/g, '')}-${randomUUID().slice(0, 8)}`;
  const releasePath = prepareReleaseDirectory(options.publishedRoot, releaseId);
  try {
    const generated = await options.build(releasePath);
    writeFileSync(`${releasePath}/release-manifest.json`, `${JSON.stringify({ propertyCount: generated.propertyCount, routeCount: generated.routeCount })}\n`, 'utf8');
    const validation = validateRelease(releasePath, options.expectedPropertyCount ?? generated.propertyCount);
    if (!validation.valid) throw new Error(validation.errors.join('; '));
    activateRelease(options.publishedRoot, releaseId);
    return { releaseId, releasePath, ...validation };
  } catch (error) {
    return Promise.reject(error);
  }
};

type RevisionSnapshot = { property_id: string; payload: PropertyDraft };

export type QueuedPublisherOptions = {
  publishedRoot: string;
  build: (input: { releasePath: string; jobId: number; propertyId: string; revisionId: number; snapshot: PropertyDraft }) => Promise<{ propertyCount: number; routeCount: number }>;
};

/** Claims and publishes at most one job. The immutable revision is read by ID,
 * the release is built in isolation, validated and swapped before the sole
 * transactional completion boundary records it and its media references. */
export const publishNextQueuedJob = async (sql: Sql, options: QueuedPublisherOptions) => {
  const job = await claimNextPublicationJob(sql);
  if (!job) return null;
  const previousRelease = activeReleaseId(options.publishedRoot);
  const releaseId = `${job.id}-${job.revisionId}-${randomUUID().slice(0, 8)}`;
  let activated = false;
  try {
    const revisions = await sql<RevisionSnapshot[]>`
      SELECT property_id, payload FROM property_revisions
      WHERE id = ${job.revisionId} AND property_id = ${job.propertyId}
    `;
    const snapshot = revisions[0];
    if (!snapshot) throw new Error('Immutable publication revision not found');
    const releasePath = prepareReleaseDirectory(options.publishedRoot, releaseId);
    const generated = await options.build({ releasePath, jobId: job.id, propertyId: job.propertyId, revisionId: job.revisionId, snapshot: structuredClone(snapshot.payload) });
    writeFileSync(`${releasePath}/release-manifest.json`, `${JSON.stringify({ jobId: job.id, revisionId: job.revisionId, propertyCount: generated.propertyCount, routeCount: generated.routeCount })}\n`, 'utf8');
    const validation = validateRelease(releasePath, generated.propertyCount);
    if (!validation.valid) throw new Error(validation.errors.join('; '));
    activateRelease(options.publishedRoot, releaseId);
    activated = true;
    const mediaIds = snapshot.payload.media?.orderedPhotoIds ?? [];
    const release = await recordSuccessfulRelease(sql, { jobId: job.id, revisionId: job.revisionId, releasePath, mediaIds, createdBy: job.requestedBy });
    return { job: release.job, releaseId, releasePath, validation };
  } catch (error) {
    if (activated && previousRelease) rollbackRelease(options.publishedRoot, previousRelease);
    const message = error instanceof Error ? error.message.slice(0, 1000) : 'Unknown publication failure';
    try { await failPublicationJob(sql, job.id, message); } catch { /* completion may already have committed */ }
    throw error;
  }
};
