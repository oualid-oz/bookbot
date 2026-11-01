import { getStorage } from '@bookbot/storage';

/**
 * Delete files from storage after their database rows are gone. Failures are
 * logged, not thrown: the rows are already deleted, so a leftover file is
 * harmless and retrying the request can't find it again.
 */
export async function deleteStoredFiles(keys: (string | null)[]): Promise<void> {
  const storage = getStorage();
  const results = await Promise.allSettled(
    keys.filter((key): key is string => !!key).map((key) => storage.delete(key))
  );
  const failed = results.filter((r) => r.status === 'rejected').length;
  if (failed > 0) console.error(`Could not delete ${failed} stored file(s)`);
}
