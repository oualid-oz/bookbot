import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { EXPORT_QUEUE, type ExportJobData } from '@bookbot/shared';

let exportQueue: Queue<ExportJobData> | undefined;
let lastErrorLog = 0;

// Created on first use so builds and requests that don't export never touch Redis
export function getExportQueue(): Queue<ExportJobData> {
  if (!exportQueue) {
    // Producers should fail fast: without the offline queue, add() rejects while
    // Redis is unreachable instead of holding the HTTP request open
    const connection = new Redis(process.env.REDIS_URL!, { enableOfflineQueue: false });
    connection.on('error', (err) => {
      if (Date.now() - lastErrorLog > 60_000) {
        lastErrorLog = Date.now();
        console.error('Export queue Redis error:', err.message);
      }
    });

    exportQueue = new Queue<ExportJobData>(EXPORT_QUEUE, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 24 * 60 * 60 },
        removeOnFail: { age: 7 * 24 * 60 * 60 },
      },
    });
  }
  return exportQueue;
}

const QUEUE_TIMEOUT_MS = 5000;

/**
 * Queue an export, using its ID as the job ID so it can't be queued twice.
 * Rejects after a few seconds if Redis is unreachable, since BullMQ would
 * otherwise wait for the connection indefinitely.
 */
export async function addExportJob(exportId: string): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Timed out connecting to the export queue')), QUEUE_TIMEOUT_MS);
  });
  try {
    await Promise.race([getExportQueue().add('export', { exportId }, { jobId: exportId }), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
