import argon2 from 'argon2';

export const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
} as const;

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 256;

export const assertPasswordAllowed = (password: string): void => {
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    throw new Error(
      `Password must contain between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters`,
    );
  }
};

export const hashPassword = async (password: string): Promise<string> => {
  assertPasswordAllowed(password);
  return argon2.hash(password, ARGON2_OPTIONS);
};

export const verifyPassword = async (passwordHash: string, password: string): Promise<boolean> => {
  if (password.length > MAX_PASSWORD_LENGTH) {
    return false;
  }
  try {
    return await argon2.verify(passwordHash, password);
  } catch {
    return false;
  }
};
