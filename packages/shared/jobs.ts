/** BullMQ queue shared by the web app (producer) and the worker (consumer) */
export const EXPORT_QUEUE = 'exports';

/**
 * Export job payload. Only the ID is sent; the worker loads everything else
 * from the database so jobs can't carry stale or forged data.
 */
export interface ExportJobData {
  exportId: string;
  /** Where the web app keeps files; the worker must write to the same place */
  storage?: string;
}
