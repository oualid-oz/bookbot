import { assertEnv } from '@bookbot/shared';

async function main() {
  // Check configuration before anything connects to Redis or the database
  assertEnv('worker');
  const { exportWorker, connection } = await import('./jobs/export');

  console.log('Bookbot worker started');

  const healthPort = Number(process.env.WORKER_HEALTH_PORT);
  const health = healthPort ? (await import('./health')).startHealthServer(healthPort, exportWorker, connection) : null;

  // Let in-flight jobs finish before exiting (Docker sends SIGTERM)
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, async () => {
      console.log(`${signal} received, closing worker...`);
      health?.close();
      await exportWorker.close();
      process.exit(0);
    });
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
