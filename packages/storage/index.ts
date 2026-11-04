import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { del as blobDel, get as blobGet, put as blobPut } from '@vercel/blob';

/**
 * File storage used by the web app and the worker.
 *
 * FILE_STORAGE selects the backend (not STORAGE_DRIVER: container build tools
 * such as buildah read that name for their own storage, which breaks Vercel
 * builds). Unset, it's vercel-blob when BLOB_READ_WRITE_TOKEN is set, else local:
 * - vercel-blob: Vercel Blob with private files, from BLOB_READ_WRITE_TOKEN
 *   (Vercel adds it when a Blob store is connected to the project).
 * - local: files on disk under STORAGE_LOCAL_DIR, which defaults to
 *   <repo>/.data/storage when run from apps/web or apps/worker. Both apps must
 *   see the same directory.
 */
export interface Storage {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  /** Returns null when the file doesn't exist */
  get(key: string): Promise<Uint8Array | null>;
  /** No error if the file doesn't exist */
  delete(key: string): Promise<void>;
}

export type StorageDriver = 'local' | 'vercel-blob';

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
    async delete(key) {
      await rm(resolveKey(key), { force: true });
    },
  };
}

/**
 * Vercel Blob, with every file private: reads go through our API, never a
 * public URL. Browsers upload with @vercel/blob/client (see
 * apps/web/src/app/api/assets/blob-upload).
 */
export function createVercelBlobStorage(token = process.env.BLOB_READ_WRITE_TOKEN): Storage {
  return {
    async put(key, body, contentType) {
      await blobPut(key, Buffer.from(body), { access: 'private', contentType, token, addRandomSuffix: false, allowOverwrite: true });
    },
    async get(key) {
      // Skip the CDN cache: a file may have just been written or replaced
      const result = await blobGet(key, { access: 'private', token, useCache: false });
      if (!result || result.statusCode !== 200) return null;
      return new Uint8Array(await new Response(result.stream).arrayBuffer());
    },
    async delete(key) {
      await blobDel(key, { token });
    },
  };
}

/** The configured driver: FILE_STORAGE, else vercel-blob when its token is set, else local */
export function storageDriver(env: Record<string, string | undefined> = process.env): string {
  if (env.FILE_STORAGE) return env.FILE_STORAGE;
  if (env.BLOB_READ_WRITE_TOKEN) return 'vercel-blob';
  return 'local';
}

let storage: Storage | undefined;

export function getStorage(): Storage {
  if (!storage) {
    const driver = storageDriver();
    if (driver === 'vercel-blob') {
      if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('BLOB_READ_WRITE_TOKEN is required for FILE_STORAGE=vercel-blob');
      storage = createVercelBlobStorage();
    } else if (driver === 'local') {
      // Vercel has no disk shared between the web app and the worker, and it isn't kept
      if (process.env.VERCEL) {
        throw new Error('Local file storage does not work on Vercel: connect a Vercel Blob store to the project');
      }
      storage = createLocalStorage(process.env.STORAGE_LOCAL_DIR || path.resolve(process.cwd(), '../../.data/storage'));
    } else {
      throw new Error(`Unsupported FILE_STORAGE "${driver}" (use local or vercel-blob)`);
    }
    // One line in the logs (Vercel, Docker) showing where files go
    console.log(`Storage: ${driver}`);
  }
  return storage;
}
