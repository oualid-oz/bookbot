import { Worker, Job, UnrecoverableError } from 'bullmq';
import Redis from 'ioredis';
import { failExport, runExport } from '@bookbot/exporter';
import { EXPORT_QUEUE, type ExportJobData } from '@bookbot/shared';
import { storageDriver } from '@bookbot/storage';

// BullMQ workers use blocking commands, which require maxRetriesPerRequest: null
export const connection = new Redis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });

export async function processExport(job: Job<ExportJobData>) {
  const { exportId } = job.data;

  // A PDF saved anywhere else would be "completed" but impossible to download
  const storage = storageDriver();
  if (job.data.storage && job.data.storage !== storage) {
    throw new UnrecoverableError(
      job.data.storage === 'vercel-blob'
        ? 'The worker has no access to Vercel Blob: add BLOB_READ_WRITE_TOKEN to the worker service'
        : `The worker stores files in "${storage}" but the web app uses "${job.data.storage}"`
    );
  }

  await runExport(exportId);
}

export const exportWorker = new Worker<ExportJobData>(EXPORT_QUEUE, processExport, {
  connection,
  concurrency: 2,
});

// Mark the export failed once BullMQ has no retries left, or right away for
// errors that retrying can't fix
exportWorker.on('failed', async (job, error) => {
  if (!job) return;
  const attempts = job.opts.attempts ?? 1;
  console.error(`Export ${job.data.exportId} attempt ${job.attemptsMade}/${attempts} failed:`, error.message);
  if (job.attemptsMade >= attempts || error instanceof UnrecoverableError || error.name === 'UnrecoverableError') {
    await failExport(job.data.exportId, error.message);
  }
});
