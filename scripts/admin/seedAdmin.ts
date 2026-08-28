import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { SqlExecutor } from '../../server/db/client.ts';
import { createPostgresClient } from '../../server/db/client.ts';
import { hashPassword } from '../../server/auth/password.ts';
import { readAdministratorCredentials, readDatabaseUrl } from './credentials.ts';

export type AdministratorCredentials = {
  username: string;
  password: string;
};

export const seedAdministrator = async (
  sql: SqlExecutor,
  credentials: AdministratorCredentials,
): Promise<{ id: string }> => {
  const username = credentials.username.trim();
  if (!username || username.length > 128) {
    throw new Error('Username must contain between 1 and 128 characters');
  }
  const passwordHash = await hashPassword(credentials.password);
  const rows = await sql<{ id: string }[]>`
    INSERT INTO admin_users (
      username,
      email,
      display_name,
      password_hash,
      must_change_password
    )
    VALUES (${username}, ${username}, ${username}, ${passwordHash}, true)
    RETURNING id
  `;
  const administrator = rows[0];
  if (!administrator) {
    throw new Error('Unable to seed administrator');
  }
  await sql`
    INSERT INTO audit_events (actor_id, action, metadata)
    VALUES (${administrator.id}, 'auth.admin_seeded', '{}'::jsonb)
  `;
  return administrator;
};

const isMainModule =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  const credentials = await readAdministratorCredentials();
  const sql = createPostgresClient(readDatabaseUrl(), { max: 1 });
  try {
    await seedAdministrator(sql, credentials);
    process.stdout.write('Administrator account created.\n');
  } finally {
    await sql.end({ timeout: 5 });
  }
}
