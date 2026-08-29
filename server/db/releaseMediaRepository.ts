import type { SqlExecutor } from './client.ts';

/**
 * Internal publisher-facing writer. A site release must record the exact media
 * rows it publishes; callers should invoke this in the same transaction that
 * inserts the release manifest.
 */
export const recordReleaseMediaReferences = async (
  sql: SqlExecutor,
  releaseId: number,
  mediaIds: readonly string[],
): Promise<void> => {
  const uniqueMediaIds = [...new Set(mediaIds)];
  for (const mediaId of uniqueMediaIds) {
    await sql`
      INSERT INTO release_media_refs (release_id, media_id)
      VALUES (${releaseId}, ${mediaId})
      ON CONFLICT DO NOTHING
    `;
  }
};

export const expireReleaseMediaReferences = async (
  sql: SqlExecutor,
  releaseId: number,
): Promise<void> => {
  await sql`
    UPDATE site_releases SET expires_at = clock_timestamp() WHERE id = ${releaseId}
  `;
};
