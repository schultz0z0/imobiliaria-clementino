import { createPostgresClient } from '../db/client.ts';

export const runPublisherOnce = async () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const sql = createPostgresClient(databaseUrl);
  try { return { processed: false }; } finally { await sql.end({ timeout: 1 }); }
};

if (import.meta.url === `file://${process.argv[1]}`) runPublisherOnce().catch((error) => { console.error(error); process.exitCode = 1; });
