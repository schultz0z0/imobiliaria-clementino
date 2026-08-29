import { randomBytes } from 'node:crypto';

import type { SqlExecutor } from '../db/client.ts';
import { hashSecret } from './csrf.ts';

export const ADMIN_SESSION_COOKIE = 'clementino_admin_session';
export const ADMIN_CSRF_COOKIE = 'clementino_admin_csrf';
export const ADMIN_COOKIE_PATH = '/api/admin';
export const ADMIN_CSRF_COOKIE_PATH = '/';
export const DEFAULT_SESSION_DURATION_SECONDS = 60 * 60 * 8;

export type AdminSession = {
  id: string;
  adminUserId: string;
  passwordHash: string;
  csrfSecretHash: string;
  mustChangePassword: boolean;
  expiresAt: Date;
};

type SessionRow = {
  id: string;
  admin_user_id: string;
  password_hash: string;
  csrf_secret_hash: string;
  must_change_password: boolean;
  expires_at: Date;
};

const toSession = (row: SessionRow): AdminSession => ({
  id: row.id,
  adminUserId: row.admin_user_id,
  passwordHash: row.password_hash,
  csrfSecretHash: row.csrf_secret_hash,
  mustChangePassword: row.must_change_password,
  expiresAt: row.expires_at,
});

export type CreatedSession = AdminSession & {
  token: string;
  csrfToken: string;
};

export const createAdminSession = async (
  sql: SqlExecutor,
  adminUserId: string,
  durationSeconds = DEFAULT_SESSION_DURATION_SECONDS,
): Promise<CreatedSession> => {
  const token = randomBytes(32).toString('base64url');
  const csrfToken = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + durationSeconds * 1_000);
  const rows = await sql<SessionRow[]>`
    INSERT INTO admin_sessions (
      admin_user_id,
      token_hash,
      csrf_secret_hash,
      expires_at
    )
    SELECT
      id,
      ${hashSecret(token)},
      ${hashSecret(csrfToken)},
      ${expiresAt}
    FROM admin_users
    WHERE id = ${adminUserId} AND active = true
    RETURNING
      id,
      admin_user_id,
      (SELECT password_hash FROM admin_users WHERE id = ${adminUserId}) AS password_hash,
      csrf_secret_hash,
      (SELECT must_change_password FROM admin_users WHERE id = ${adminUserId}) AS must_change_password,
      expires_at
  `;
  const row = rows[0];
  if (!row) {
    throw new Error('Unable to create administrator session');
  }
  return { ...toSession(row), token, csrfToken };
};

export const getActiveAdminSession = async (
  sql: SqlExecutor,
  token: string | undefined,
): Promise<AdminSession | null> => {
  if (!token || token.length > 256) {
    return null;
  }
  const rows = await sql<SessionRow[]>`
    SELECT
      s.id,
      s.admin_user_id,
      u.password_hash,
      s.csrf_secret_hash,
      u.must_change_password,
      s.expires_at
    FROM admin_sessions s
    JOIN admin_users u ON u.id = s.admin_user_id
    WHERE
      s.token_hash = ${hashSecret(token)}
      AND s.revoked_at IS NULL
      AND s.expires_at > clock_timestamp()
      AND u.active = true
  `;
  return rows[0] ? toSession(rows[0]) : null;
};

export const revokeAdminSession = async (
  sql: SqlExecutor,
  sessionId: string,
): Promise<void> => {
  await sql`
    UPDATE admin_sessions
    SET revoked_at = COALESCE(revoked_at, clock_timestamp())
    WHERE id = ${sessionId}
  `;
};

export const revokeAllAdminSessions = async (
  sql: SqlExecutor,
  adminUserId: string,
): Promise<void> => {
  await sql`
    UPDATE admin_sessions
    SET revoked_at = COALESCE(revoked_at, clock_timestamp())
    WHERE admin_user_id = ${adminUserId} AND revoked_at IS NULL
  `;
};
