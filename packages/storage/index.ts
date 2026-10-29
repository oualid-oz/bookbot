import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Object storage used by the web app and the worker.
 *
 * STORAGE_DRIVER=local (default) keeps files on disk under STORAGE_LOCAL_DIR,
 * which defaults to <repo>/.data/storage when run from apps/web or apps/worker.
 * An R2 driver will be added alongside presigned uploads.
 */
export interface Storage {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  /** Returns null when the object doesn't exist */
  get(key: string): Promise<Uint8Array | null>;
}

export function createLocalStorage(rootDir: string): Storage {
  const root = path.resolve(rootDir);

  // Keys come from our own code, but never let one resolve outside the root
  const resolveKey = (key: string) => {
    const fullPath = path.resolve(root, key);
    if (!fullPath.startsWith(root + path.sep)) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    return fullPath;
  };

  return {
    async put(key, body) {
      const fullPath = resolveKey(key);
      await mkdir(path.dirname(fullPath), { recursive: true });
      await writeFile(fullPath, body);
    },
    async get(key) {
      try {
        return new Uint8Array(await readFile(resolveKey(key)));
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw err;
      }
    },
  };
}

let storage: Storage | undefined;

export function getStorage(): Storage {
  if (!storage) {
    const driver = process.env.STORAGE_DRIVER ?? 'local';
    if (driver !== 'local') {
      throw new Error(`Unsupported STORAGE_DRIVER "${driver}"`);
    }
    storage = createLocalStorage(
      process.env.STORAGE_LOCAL_DIR ?? path.resolve(process.cwd(), '../../.data/storage')
    );
  }
  return storage;
}
