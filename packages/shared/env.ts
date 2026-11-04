/**
 * Startup configuration checks for the web app and the worker. Errors stop
 * the process; warnings are logged. Only names are ever reported, never values.
 */
type Env = Record<string, string | undefined>;

export interface EnvReport {
  errors: string[];
  warnings: string[];
}

const isUrl = (value: string | undefined, protocols: string[]) => {
  try {
    return !!value && protocols.includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

export function checkEnv(app: 'web' | 'worker', env: Env = process.env): EnvReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const production = env.NODE_ENV === 'production';
  const missing = (names: string[], reason: string) => {
    const absent = names.filter((name) => !env[name]);
    if (absent.length) errors.push(`${absent.join(', ')} ${absent.length > 1 ? 'are' : 'is'} required ${reason}`);
  };

  if (!isUrl(env.DATABASE_URL, ['postgres:', 'postgresql:'])) errors.push('DATABASE_URL must be a postgres:// URL');
  if (!isUrl(env.REDIS_URL, ['redis:', 'rediss:'])) errors.push('REDIS_URL must be a redis:// URL');

  // Same choice as @bookbot/storage: the setting, else whichever credentials are filled in
  const storage =
    env.FILE_STORAGE || (env.BLOB_READ_WRITE_TOKEN ? 'vercel-blob' : env.R2_ACCOUNT_ID ? 'r2' : env.S3_BUCKET ? 's3' : 'local');
  if (storage === 'vercel-blob') {
    missing(['BLOB_READ_WRITE_TOKEN'], 'for FILE_STORAGE=vercel-blob (connect a Blob store to the Vercel project)');
  } else if (storage === 'r2') {
    missing(['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'], 'for FILE_STORAGE=r2');
  } else if (storage === 's3') {
    missing(['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'], 'for FILE_STORAGE=s3');
  } else if (storage === 'local') {
    if (env.VERCEL) errors.push('Vercel needs file storage: connect a Vercel Blob store to the project');
    else if (production) warnings.push('FILE_STORAGE=local: the web app and worker must share the storage directory');
  } else {
    errors.push(`FILE_STORAGE must be local, vercel-blob, r2, or s3 (got "${storage}")`);
  }

  if (app === 'web') {
    if (production) {
      missing(['NEXTAUTH_SECRET'], 'in production');
      const url = env.NEXTAUTH_URL;
      if (!url || !isUrl(url, ['https:', 'http:'])) errors.push('NEXTAUTH_URL must be the public URL of the app in production');
      else if (!url.startsWith('https:')) warnings.push('NEXTAUTH_URL should use https in production');
    }
    if (env.NEXTAUTH_SECRET && env.NEXTAUTH_SECRET.length < 32) warnings.push('NEXTAUTH_SECRET should be at least 32 characters');

    // Billing is all or nothing
    const stripeVars = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_ID_PRO', 'STRIPE_PRICE_ID_ENTERPRISE'];
    if (stripeVars.some((name) => env[name])) {
      missing(['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'], 'when billing is configured');
      if (!env.STRIPE_PRICE_ID_PRO && !env.STRIPE_PRICE_ID_ENTERPRISE) errors.push('Set STRIPE_PRICE_ID_PRO and/or STRIPE_PRICE_ID_ENTERPRISE');
      if (production && env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) warnings.push('STRIPE_SECRET_KEY is a test-mode key');
    }

    if (!!env.GOOGLE_CLIENT_ID !== !!env.GOOGLE_CLIENT_SECRET) errors.push('Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither');

    const email = env.EMAIL_TRANSPORT || 'console';
    if (!['console', 'memory'].includes(email)) errors.push(`EMAIL_TRANSPORT must be console or memory (got "${email}")`);
    else if (production) warnings.push(`EMAIL_TRANSPORT=${email}: emails are not delivered to users`);
  }

  return { errors, warnings };
}

/**
 * Log warnings and stop on errors
 */
export function assertEnv(app: 'web' | 'worker', env: Env = process.env): void {
  const { errors, warnings } = checkEnv(app, env);
  for (const warning of warnings) console.warn(`[config] ${warning}`);
  if (errors.length) {
    throw new Error(`Invalid configuration for ${app}:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  }
}
