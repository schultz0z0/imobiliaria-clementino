import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { hashPassword } from '../../server/auth/password.ts';
import {
  createPostgresClient,
  type Sql,
  withTransaction,
} from '../../server/db/client.ts';
import type { AdministratorCredentials } from './seedAdmin.ts';
import { readAdministratorCredentials, readDatabaseUrl } from './credentials.ts';

export const resetAdministratorPassword = async (
  sql: Sql,
  credentials: AdministratorCredentials,
): Promise<void> => {
  const username = credentials.username.trim();
  if (!username || username.length > 128) {
    throw new Error('Username must contain between 1 and 128 characters');
  }
  const passwordHash = await hashPassword(credentials.password);
  await withTransaction(sql, async (transaction) => {
    const rows = await transaction<{ id: string }[]>`
      UPDATE admin_users
      SET
        password_hash = ${passwordHash},
        must_change_password = true,
        failed_login_count = 0,
        locked_until = NULL,
        updated_at = clock_timestamp()
      WHERE lower(username) = lower(${username})
      RETURNING id
    `;
    const administrator = rows[0];
    if (!administrator) {
      throw new Error('Administrator account not found');
    }
    await transaction`
      UPDATE admin_sessions
      SET revoked_at = COALESCE(revoked_at, clock_timestamp())
      WHERE admin_user_id = ${administrator.id} AND revoked_at IS NULL
    `;
    await transaction`
      INSERT INTO audit_events (actor_id, action, metadata)
      VALUES (${administrator.id}, 'auth.password_reset', '{}'::jsonb)
    `;
  });
};

const isMainModule =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  const credentials = await readAdministratorCredentials();
  const sql = createPostgresClient(readDatabaseUrl(), { max: 1 });
  try {
    await resetAdministratorPassword(sql, credentials);
    process.stdout.write('Administrator password reset; all sessions revoked.\n');
  } finally {
    await sql.end({ timeout: 5 });
  }
}
