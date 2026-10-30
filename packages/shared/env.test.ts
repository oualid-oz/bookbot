import { describe, expect, it } from 'vitest';
import { checkEnv } from './env';

const base = { DATABASE_URL: 'postgresql://u:p@localhost:5432/db', REDIS_URL: 'redis://localhost:6379/0' };
const prod = { ...base, NODE_ENV: 'production', NEXTAUTH_SECRET: 'x'.repeat(40), NEXTAUTH_URL: 'https://app.example.com' };

describe('checkEnv', () => {
  it('accepts a minimal development setup', () => {
    expect(checkEnv('web', base)).toEqual({ errors: [], warnings: [] });
    expect(checkEnv('worker', base)).toEqual({ errors: [], warnings: [] });
  });

  it('requires the database and Redis', () => {
    expect(checkEnv('worker', {}).errors).toEqual(['DATABASE_URL must be a postgres:// URL', 'REDIS_URL must be a redis:// URL']);
    expect(checkEnv('web', { ...base, DATABASE_URL: 'mysql://x' }).errors).toHaveLength(1);
  });

  it('requires auth settings in production', () => {
    const { errors } = checkEnv('web', { ...base, NODE_ENV: 'production' });
    expect(errors).toEqual(['NEXTAUTH_SECRET is required in production', 'NEXTAUTH_URL must be the public URL of the app in production']);
  });

  it('warns about production setups that work but are risky', () => {
    const { errors, warnings } = checkEnv('web', { ...prod, NEXTAUTH_URL: 'http://app.example.com', NEXTAUTH_SECRET: 'short' });
    expect(errors).toEqual([]);
    expect(warnings).toEqual([
      'STORAGE_DRIVER=local: the web app and worker must share the storage directory',
      'NEXTAUTH_URL should use https in production',
      'NEXTAUTH_SECRET should be at least 32 characters',
      'EMAIL_TRANSPORT=console: emails are not delivered to users',
    ]);
  });

  it('checks the storage driver settings', () => {
    expect(checkEnv('worker', { ...base, STORAGE_DRIVER: 'r2', R2_BUCKET_NAME: 'b' }).errors).toEqual([
      'R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY are required for STORAGE_DRIVER=r2',
    ]);
    expect(checkEnv('worker', { ...base, STORAGE_DRIVER: 'ftp' }).errors).toEqual(['STORAGE_DRIVER must be local, r2, or s3 (got "ftp")']);
  });

  it('treats billing as all or nothing', () => {
    expect(checkEnv('web', { ...base, STRIPE_PRICE_ID_PRO: 'price_1' }).errors).toEqual([
      'STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET are required when billing is configured',
    ]);
    expect(checkEnv('web', { ...base, STRIPE_SECRET_KEY: 'sk_test_1', STRIPE_WEBHOOK_SECRET: 'whsec_1', STRIPE_PRICE_ID_PRO: 'price_1' }).errors).toEqual([]);
  });

  it('needs both Google credentials or neither', () => {
    expect(checkEnv('web', { ...base, GOOGLE_CLIENT_ID: 'id' }).errors).toEqual(['Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither']);
  });

  it('never includes values in messages', () => {
    const secret = 'sk_live_supersecretvalue';
    const report = checkEnv('web', { ...base, STRIPE_SECRET_KEY: secret, GOOGLE_CLIENT_ID: 'x', DATABASE_URL: 'mysql://user:pw@h/db' });
    expect(JSON.stringify(report)).not.toMatch(/supersecret|pw@/);
  });
});
