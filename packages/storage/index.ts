import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DeleteObjectCommand, GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { del as blobDel, get as blobGet, put as blobPut } from '@vercel/blob';

/**
 * Object storage used by the web app and the worker.
 *
 * FILE_STORAGE selects the backend (not STORAGE_DRIVER: container build tools
 * such as buildah read that name for their own storage, which breaks Vercel
 * builds). Unset, it's picked from the settings that are filled in, in this order:
 * - vercel-blob: Vercel Blob, private files, from BLOB_READ_WRITE_TOKEN (Vercel
 *   adds it when a Blob store is connected to the project).
 * - r2: Cloudflare R2, from R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
 *   R2_SECRET_ACCESS_KEY and R2_BUCKET_NAME.
 * - s3: any S3-compatible service, from S3_ENDPOINT, S3_REGION, S3_BUCKET,
 *   S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.
 * - local (otherwise): files on disk under STORAGE_LOCAL_DIR, which defaults to
 *   <repo>/.data/storage when run from apps/web or apps/worker. Both apps must
 *   see the same directory.
 */
export interface Storage {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  /** Returns null when the object doesn't exist */
  get(key: string): Promise<Uint8Array | null>;
  /** No error if the object doesn't exist */
  delete(key: string): Promise<void>;
  /**
   * A URL the browser can PUT exactly `contentLength` bytes of `contentType`
   * to, or null when the driver can't presign (upload through the API instead)
   */
  presignPut(key: string, contentType: string, contentLength: number, expiresInSeconds?: number): Promise<string | null>;
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
    async delete(key) {
      await rm(resolveKey(key), { force: true });
    },
    async presignPut() {
      return null;
    },
  };
}

/**
 * Vercel Blob, with every file private: reads go through our API, never a
 * public URL. Browsers upload with @vercel/blob/client instead of a presigned
 * PUT (see apps/web/src/app/api/assets/blob-upload).
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
    async presignPut() {
      return null;
    },
  };
}

export interface S3StorageConfig {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Needed by MinIO and most self-hosted S3 services */
  forcePathStyle?: boolean;
}

export function createS3Storage(config: S3StorageConfig): Storage {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });

  return {
    async put(key, body, contentType) {
      await client.send(new PutObjectCommand({ Bucket: config.bucket, Key: key, Body: body, ContentType: contentType }));
    },
    async get(key) {
      try {
        const result = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
        return result.Body ? await result.Body.transformToByteArray() : null;
      } catch (err) {
        if (err instanceof NoSuchKey) return null;
        throw err;
      }
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
    },
    async presignPut(key, contentType, contentLength, expiresInSeconds = 600) {
      // Type and length are signed, so the upload must match what was declared
      const command = new PutObjectCommand({ Bucket: config.bucket, Key: key, ContentType: contentType, ContentLength: contentLength });
      return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
    },
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for FILE_STORAGE=${process.env.FILE_STORAGE}`);
  return value;
}

let storage: Storage | undefined;

/** The configured driver, from FILE_STORAGE or else from which settings are filled in */
export function storageDriver(env: Record<string, string | undefined> = process.env): string {
  if (env.FILE_STORAGE) return env.FILE_STORAGE;
  if (env.BLOB_READ_WRITE_TOKEN) return 'vercel-blob';
  if (env.R2_ACCOUNT_ID) return 'r2';
  if (env.S3_BUCKET) return 's3';
  return 'local';
}

export function getStorage(): Storage {
  if (!storage) {
    const driver = storageDriver();
    // Vercel has no disk shared between the web app and the worker, and it isn't kept
    if (driver === 'local' && process.env.VERCEL) {
      throw new Error('Local file storage does not work on Vercel: connect a Vercel Blob store to the project (or set the R2_*/S3_* variables)');
    }
    if (driver === 'local') {
      storage = createLocalStorage(
        process.env.STORAGE_LOCAL_DIR || path.resolve(process.cwd(), '../../.data/storage')
      );
    } else if (driver === 'vercel-blob') {
      requireEnv('BLOB_READ_WRITE_TOKEN');
      storage = createVercelBlobStorage();
    } else if (driver === 'r2') {
      storage = createS3Storage({
        endpoint: `https://${requireEnv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
        region: 'auto',
        bucket: requireEnv('R2_BUCKET_NAME'),
        accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
        secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
      });
    } else if (driver === 's3') {
      storage = createS3Storage({
        endpoint: process.env.S3_ENDPOINT || undefined,
        region: process.env.S3_REGION || 'us-east-1',
        bucket: requireEnv('S3_BUCKET'),
        accessKeyId: requireEnv('S3_ACCESS_KEY_ID'),
        secretAccessKey: requireEnv('S3_SECRET_ACCESS_KEY'),
        forcePathStyle: !!process.env.S3_ENDPOINT,
      });
    } else {
      throw new Error(`Unsupported FILE_STORAGE "${driver}"`);
    }
    // One line in the logs (Vercel, Docker) showing where files go
    console.log(`Storage: ${driver}${driver === 'r2' || driver === 's3' ? ` (bucket ${process.env.R2_BUCKET_NAME || process.env.S3_BUCKET})` : ''}`);
  }
  return storage;
}
