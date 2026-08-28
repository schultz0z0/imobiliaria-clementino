import { randomBytes } from 'node:crypto';

import type { FastifyInstance, FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';

import { type Sql, withTransaction } from '../db/client.ts';
import { verifyCsrfToken } from './csrf.ts';
import {
  DEFAULT_IP_RATE_LIMIT_MAX_ENTRIES,
  IpFailureRateLimiter,
} from './ipRateLimiter.ts';
import { hashPassword, verifyPassword } from './password.ts';
import {
  ADMIN_COOKIE_PATH,
  ADMIN_CSRF_COOKIE,
  ADMIN_SESSION_COOKIE,
  createAdminSession,
  DEFAULT_SESSION_DURATION_SECONDS,
  getActiveAdminSession,
  revokeAdminSession,
  type AdminSession,
  type CreatedSession,
} from './session.ts';

declare module 'fastify' {
  interface FastifyRequest {
    adminSession?: AdminSession;
  }
}

const genericLoginFailure = { error: 'Invalid username or password' } as const;
const genericCsrfFailure = { error: 'Invalid request' } as const;

type AdminUserRow = {
  id: string;
  password_hash: string;
  must_change_password: boolean;
  failed_login_count: number;
  locked_until: Date | null;
};

export type AuthOptions = {
  accountFailureLimit?: number;
  lockoutSeconds?: number;
  ipAttemptLimit?: number;
  ipWindowSeconds?: number;
  ipRateLimitMaxEntries?: number;
  sessionDurationSeconds?: number;
};

type ResolvedAuthOptions = Required<AuthOptions>;

const resolveAuthOptions = (options: AuthOptions = {}): ResolvedAuthOptions => ({
  accountFailureLimit: options.accountFailureLimit ?? 5,
  lockoutSeconds: options.lockoutSeconds ?? 15 * 60,
  ipAttemptLimit: options.ipAttemptLimit ?? 10,
  ipWindowSeconds: options.ipWindowSeconds ?? 60,
  ipRateLimitMaxEntries:
    options.ipRateLimitMaxEntries ?? DEFAULT_IP_RATE_LIMIT_MAX_ENTRIES,
  sessionDurationSeconds: options.sessionDurationSeconds ?? DEFAULT_SESSION_DURATION_SECONDS,
});

const insertAuditEvent = async (
  sql: Sql,
  action: string,
  actorId: string | null = null,
): Promise<void> => {
  await sql`
    INSERT INTO audit_events (actor_id, action, metadata)
    VALUES (${actorId}, ${action}, '{}'::jsonb)
  `;
};

const cookieOptions = (
  environment: string,
  expiresAt: Date,
  httpOnly: boolean,
) => ({
  httpOnly,
  secure: environment === 'production',
  sameSite: 'strict' as const,
  path: ADMIN_COOKIE_PATH,
  expires: expiresAt,
  maxAge: Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1_000)),
});

const setSessionCookies = (
  reply: FastifyReply,
  session: CreatedSession,
  environment: string,
): void => {
  reply.setCookie(
    ADMIN_SESSION_COOKIE,
    session.token,
    cookieOptions(environment, session.expiresAt, true),
  );
  reply.setCookie(
    ADMIN_CSRF_COOKIE,
    session.csrfToken,
    cookieOptions(environment, session.expiresAt, false),
  );
};

const clearSessionCookies = (reply: FastifyReply, environment: string): void => {
  const options = {
    path: ADMIN_COOKIE_PATH,
    sameSite: 'strict' as const,
    secure: environment === 'production',
    expires: new Date(0),
    maxAge: 0,
  };
  reply.clearCookie(ADMIN_SESSION_COOKIE, { ...options, httpOnly: true });
  reply.clearCookie(ADMIN_CSRF_COOKIE, { ...options, httpOnly: false });
};

const readLoginBody = (body: unknown): { username: string; password: string } => {
  if (typeof body !== 'object' || body === null) {
    return { username: '', password: '' };
  }
  const candidate = body as Record<string, unknown>;
  return {
    username:
      typeof candidate.username === 'string' && candidate.username.length <= 128
        ? candidate.username.trim()
        : '',
    password:
      typeof candidate.password === 'string' && candidate.password.length <= 256
        ? candidate.password
        : '',
  };
};

const readChangePasswordBody = (
  body: unknown,
): { currentPassword: string; newPassword: string } | null => {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const candidate = body as Record<string, unknown>;
  if (typeof candidate.currentPassword !== 'string' || typeof candidate.newPassword !== 'string') {
    return null;
  }
  return { currentPassword: candidate.currentPassword, newPassword: candidate.newPassword };
};

const findAdminByUsername = async (sql: Sql, username: string): Promise<AdminUserRow | null> => {
  const rows = await sql<AdminUserRow[]>`
    SELECT
      id,
      password_hash,
      must_change_password,
      failed_login_count,
      locked_until
    FROM admin_users
    WHERE lower(username) = lower(${username}) AND active = true
  `;
  return rows[0] ?? null;
};

const isLocked = (user: AdminUserRow, now = new Date()): boolean =>
  user.locked_until !== null && user.locked_until.getTime() > now.getTime();

const recordAccountFailure = async (
  sql: Sql,
  adminUserId: string,
  options: ResolvedAuthOptions,
): Promise<void> => {
  await withTransaction(sql, async (transaction) => {
    const rows = await transaction<Pick<AdminUserRow, 'failed_login_count' | 'locked_until'>[]>`
      SELECT failed_login_count, locked_until
      FROM admin_users
      WHERE id = ${adminUserId}
      FOR UPDATE
    `;
    const user = rows[0];
    if (!user || (user.locked_until && user.locked_until.getTime() > Date.now())) {
      return;
    }
    const previousFailures =
      user.locked_until && user.locked_until.getTime() <= Date.now()
        ? 0
        : user.failed_login_count;
    const failedLoginCount = previousFailures + 1;
    const lockedUntil =
      failedLoginCount >= options.accountFailureLimit
        ? new Date(Date.now() + options.lockoutSeconds * 1_000)
        : null;
    await transaction`
      UPDATE admin_users
      SET
        failed_login_count = ${failedLoginCount},
        locked_until = ${lockedUntil},
        updated_at = clock_timestamp()
      WHERE id = ${adminUserId}
    `;
  });
};

export const createAdminGuard = (
  sql: Sql,
  options: { allowPasswordChangeRequired?: boolean; csrf?: boolean } = {},
): preHandlerHookHandler =>
  async (request, reply) => {
    const session = await getActiveAdminSession(sql, request.cookies[ADMIN_SESSION_COOKIE]);
    if (!session) {
      await reply.code(401).send({ error: 'Authentication required' });
      return;
    }
    if (!options.allowPasswordChangeRequired && session.mustChangePassword) {
      await reply.code(403).send({ error: 'Password change required' });
      return;
    }
    if (
      options.csrf &&
      !verifyCsrfToken(
        session.csrfSecretHash,
        request.cookies[ADMIN_CSRF_COOKIE],
        request.headers['x-csrf-token'],
      )
    ) {
      await reply.code(403).send(genericCsrfFailure);
      return;
    }
    request.adminSession = session;
  };

export const registerAuthRoutes = (
  app: FastifyInstance,
  sql: Sql,
  environment: string,
  authOptions: AuthOptions = {},
): void => {
  const options = resolveAuthOptions(authOptions);
  const ipRateLimiter = new IpFailureRateLimiter({
    failureLimit: options.ipAttemptLimit,
    windowMs: options.ipWindowSeconds * 1_000,
    maxEntries: options.ipRateLimitMaxEntries,
  });
  let dummyPasswordHash = '';

  app.addHook('onReady', async () => {
    dummyPasswordHash = await hashPassword(randomBytes(32).toString('base64url'));
  });

  app.post('/api/admin/auth/login', async (request, reply) => {
    if (ipRateLimiter.isLimited(request.ip)) {
      await insertAuditEvent(sql, 'auth.login_rate_limited');
      return reply.code(429).send({ error: 'Too many login attempts' });
    }

    const { username, password } = readLoginBody(request.body);
    const user = await findAdminByUsername(sql, username);
    const passwordMatches = await verifyPassword(user?.password_hash ?? dummyPasswordHash, password);
    if (!user || !passwordMatches || isLocked(user)) {
      ipRateLimiter.recordFailure(request.ip);
      if (user && !isLocked(user)) {
        await recordAccountFailure(sql, user.id, options);
      }
      await insertAuditEvent(sql, 'auth.login_failed');
      return reply.code(401).send(genericLoginFailure);
    }

    const session = await withTransaction(sql, async (transaction) => {
      const rows = await transaction<AdminUserRow[]>`
        SELECT
          id,
          password_hash,
          must_change_password,
          failed_login_count,
          locked_until
        FROM admin_users
        WHERE id = ${user.id} AND active = true
        FOR UPDATE
      `;
      const current = rows[0];
      if (!current || current.password_hash !== user.password_hash || isLocked(current)) {
        return null;
      }
      await transaction`
        UPDATE admin_users
        SET failed_login_count = 0, locked_until = NULL, updated_at = clock_timestamp()
        WHERE id = ${current.id}
      `;
      const created = await createAdminSession(
        transaction,
        current.id,
        options.sessionDurationSeconds,
      );
      await transaction`
        INSERT INTO audit_events (actor_id, action, metadata)
        VALUES (${current.id}, 'auth.login_succeeded', '{}'::jsonb)
      `;
      return created;
    });
    if (!session) {
      ipRateLimiter.recordFailure(request.ip);
      await insertAuditEvent(sql, 'auth.login_failed');
      return reply.code(401).send(genericLoginFailure);
    }

    ipRateLimiter.clear(request.ip);
    setSessionCookies(reply, session, environment);
    return reply.send({ mustChangePassword: session.mustChangePassword });
  });

  app.get(
    '/api/admin/auth/session',
    { preHandler: createAdminGuard(sql, { allowPasswordChangeRequired: true }) },
    async (request) => ({ mustChangePassword: request.adminSession!.mustChangePassword }),
  );

  app.post(
    '/api/admin/auth/change-password',
    {
      preHandler: createAdminGuard(sql, {
        allowPasswordChangeRequired: true,
        csrf: true,
      }),
    },
    async (request, reply) => {
      const body = readChangePasswordBody(request.body);
      if (!body || !(await verifyPassword(request.adminSession!.passwordHash, body.currentPassword))) {
        return reply.code(401).send(genericLoginFailure);
      }

      let nextPasswordHash: string;
      try {
        nextPasswordHash = await hashPassword(body.newPassword);
      } catch {
        return reply.code(400).send({ error: 'Password does not meet requirements' });
      }

      const replacement = await withTransaction(sql, async (transaction) => {
        const rows = await transaction<{ password_hash: string }[]>`
          SELECT u.password_hash
          FROM admin_sessions s
          JOIN admin_users u ON u.id = s.admin_user_id
          WHERE
            s.id = ${request.adminSession!.id}
            AND s.revoked_at IS NULL
            AND s.expires_at > clock_timestamp()
          FOR UPDATE OF s, u
        `;
        if (rows[0]?.password_hash !== request.adminSession!.passwordHash) {
          return null;
        }
        await transaction`
          UPDATE admin_users
          SET
            password_hash = ${nextPasswordHash},
            must_change_password = false,
            failed_login_count = 0,
            locked_until = NULL,
            updated_at = clock_timestamp()
          WHERE id = ${request.adminSession!.adminUserId}
        `;
        await transaction`
          UPDATE admin_sessions
          SET revoked_at = COALESCE(revoked_at, clock_timestamp())
          WHERE admin_user_id = ${request.adminSession!.adminUserId} AND revoked_at IS NULL
        `;
        const created = await createAdminSession(
          transaction,
          request.adminSession!.adminUserId,
          options.sessionDurationSeconds,
        );
        await transaction`
          INSERT INTO audit_events (actor_id, action, metadata)
          VALUES (${request.adminSession!.adminUserId}, 'auth.password_changed', '{}'::jsonb)
        `;
        return created;
      });
      if (!replacement) {
        clearSessionCookies(reply, environment);
        return reply.code(401).send({ error: 'Authentication required' });
      }
      setSessionCookies(reply, replacement, environment);
      return reply.send({ mustChangePassword: false });
    },
  );

  app.post(
    '/api/admin/auth/logout',
    {
      preHandler: createAdminGuard(sql, {
        allowPasswordChangeRequired: true,
        csrf: true,
      }),
    },
    async (request, reply) => {
      await revokeAdminSession(sql, request.adminSession!.id);
      await insertAuditEvent(sql, 'auth.logout_succeeded', request.adminSession!.adminUserId);
      clearSessionCookies(reply, environment);
      return reply.code(204).send();
    },
  );
};
