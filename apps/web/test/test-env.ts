import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Database and Redis used by the integration tests.
 *
 * TEST_DATABASE_URL wins; otherwise DATABASE_URL from the repo .env with
 * "_test" appended to the database name. Tests wipe this database, so its
 * name must end in "_test".
 */
export function testDatabaseUrl(): string {
  let url = process.env.TEST_DATABASE_URL;
  if (!url) {
    const base = process.env.DATABASE_URL ?? readEnvFile('DATABASE_URL');
    if (!base) throw new Error('Set TEST_DATABASE_URL (or DATABASE_URL) for integration tests');
    const parsed = new URL(base);
    parsed.pathname = `${parsed.pathname.replace(/^\//, '')}_test`;
    url = parsed.toString();
  }
  const dbName = new URL(url).pathname.replace(/^\//, '');
  if (!dbName.endsWith('_test')) {
    throw new Error(`Refusing to run tests against "${dbName}": the test database name must end in "_test"`);
  }
  return url;
}

/** Redis DB 15 by default, kept apart from the app's DB 0 */
export function testRedisUrl(): string {
  return process.env.TEST_REDIS_URL ?? 'redis://localhost:6379/15';
}

function readEnvFile(key: string): string | undefined {
  try {
    const env = readFileSync(path.resolve(__dirname, '../../../.env'), 'utf8');
    return env.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]?.trim();
  } catch {
    return undefined;
  }
}
