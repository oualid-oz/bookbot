import { assertEnv } from '@bookbot/shared';

// Refuse to start with a broken configuration. Exit rather than serve errors,
// so Docker and orchestrators see a failed start.
try {
  assertEnv('web');
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
