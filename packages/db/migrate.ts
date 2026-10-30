/**
 * Apply pending migrations with the runtime migrator, so deploys don't need
 * drizzle-kit (a dev dependency). Run with: npm run db:migrate
 */
import path from 'node:path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');

  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder: path.join(__dirname, 'drizzle') });
    console.log('Migrations applied');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
