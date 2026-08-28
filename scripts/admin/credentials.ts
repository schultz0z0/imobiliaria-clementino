import { once } from 'node:events';
import { createInterface } from 'node:readline/promises';

const argumentValue = (arguments_: string[], name: string): string | undefined => {
  const index = arguments_.indexOf(name);
  return index >= 0 ? arguments_[index + 1] : undefined;
};

const readHiddenPassword = async (): Promise<string> => {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf8').replace(/[\r\n]+$/, '');
  }

  process.stdout.write('Password: ');
  process.stdin.setRawMode(true);
  process.stdin.resume();
  let password = '';
  const onData = (chunk: Buffer): void => {
    for (const character of chunk.toString('utf8')) {
      if (character === '\u0003') {
        process.stdin.setRawMode(false);
        throw new Error('Password input cancelled');
      }
      if (character === '\r' || character === '\n') {
        process.stdin.emit('credential-complete');
      } else if (character === '\u007f' || character === '\b') {
        password = password.slice(0, -1);
      } else {
        password += character;
      }
    }
  };
  process.stdin.on('data', onData);
  await once(process.stdin, 'credential-complete');
  process.stdin.off('data', onData);
  process.stdin.setRawMode(false);
  process.stdin.pause();
  process.stdout.write('\n');
  return password;
};

export const readAdministratorCredentials = async (
  arguments_ = process.argv.slice(2),
): Promise<{ username: string; password: string }> => {
  let username = argumentValue(arguments_, '--username')?.trim();
  if (!username) {
    if (!process.stdin.isTTY) {
      throw new Error('--username is required when credentials are read from stdin');
    }
    const readline = createInterface({ input: process.stdin, output: process.stdout });
    try {
      username = (await readline.question('Username: ')).trim();
    } finally {
      readline.close();
    }
  }
  if (!username || username.length > 128) {
    throw new Error('Username must contain between 1 and 128 characters');
  }
  const password = await readHiddenPassword();
  return { username, password };
};

export const readDatabaseUrl = (arguments_ = process.argv.slice(2)): string => {
  const databaseUrl = argumentValue(arguments_, '--database-url') ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL or --database-url is required');
  }
  return databaseUrl;
};
