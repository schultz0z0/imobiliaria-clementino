import postgres from 'postgres';

export type Sql = postgres.Sql;
export type TransactionSql = postgres.TransactionSql;
export type SqlExecutor = Sql | TransactionSql;
export type PostgresClientOptions = postgres.Options<Record<string, never>>;

let singletonClient: Sql | undefined;

export const createPostgresClient = (
  databaseUrl: string,
  options: PostgresClientOptions = {},
): Sql =>
  postgres(databaseUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    ...options,
  });

export const getPostgresClient = (databaseUrl = process.env.DATABASE_URL): Sql => {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  singletonClient ??= createPostgresClient(databaseUrl);
  return singletonClient;
};

export const closePostgresClient = async (): Promise<void> => {
  if (!singletonClient) {
    return;
  }

  const client = singletonClient;
  singletonClient = undefined;
  await client.end({ timeout: 5 });
};

const isRootSql = (sql: SqlExecutor): sql is Sql => 'begin' in sql;

export const withTransaction = async <T>(
  sql: SqlExecutor,
  operation: (transaction: TransactionSql) => Promise<T>,
): Promise<T> => {
  if (isRootSql(sql)) {
    return (await sql.begin(operation)) as T;
  }

  return operation(sql);
};
