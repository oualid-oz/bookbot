import { exportWorker } from './jobs/export';

console.log('Bookbot worker started');

// Let in-flight jobs finish before exiting (Docker sends SIGTERM)
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    console.log(`${signal} received, closing worker...`);
    await exportWorker.close();
    process.exit(0);
  });
}
