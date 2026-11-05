import { after } from 'next/server';
import { failExport, runExport } from '@bookbot/exporter';
import { addExportJob } from './queue';

/**
 * How exports are rendered. EXPORT_MODE overrides; otherwise:
 * - inline on Vercel: this app renders the PDF right after responding, so no
 *   separate worker or queue is needed
 * - queue elsewhere (Docker): the worker picks the job up from Redis
 */
export function exportMode(env: Record<string, string | undefined> = process.env): 'inline' | 'queue' {
  if (env.EXPORT_MODE === 'inline' || env.EXPORT_MODE === 'queue') return env.EXPORT_MODE;
  return env.VERCEL ? 'inline' : 'queue';
}

/** Start rendering a newly created export; rejects only if it can't be queued */
export async function startExport(exportId: string): Promise<void> {
  if (exportMode() === 'queue') {
    await addExportJob(exportId);
    return;
  }
  // Runs after the response is sent, within the route's maxDuration
  after(async () => {
    try {
      await runExport(exportId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Export ${exportId} failed:`, message);
      await failExport(exportId, message).catch(() => {});
    }
  });
}
