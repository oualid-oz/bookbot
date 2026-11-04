/**
 * Migrations during a Vercel build (see vercel.json). Production deployments
 * migrate before the new code goes live, and a failure stops the deployment.
 * Preview deployments skip it, so a branch can't change the production
 * database; set RUN_MIGRATIONS=1 for previews that have their own database.
 */
if (process.env.VERCEL_ENV === 'production' || process.env.RUN_MIGRATIONS === '1') {
  void import('./migrate');
} else {
  console.log(`Skipping database migrations (VERCEL_ENV=${process.env.VERCEL_ENV ?? 'unset'})`);
}
