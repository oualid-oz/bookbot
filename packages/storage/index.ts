import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { GetObjectCommand, NoSuchKey, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

/**
 * Object storage used by the web app and the worker.
 *
 * STORAGE_DRIVER selects the backend:
 * - local (default): files on disk under STORAGE_LOCAL_DIR, which defaults to
 *   <repo>/.data/storage when run from apps/web or apps/worker. Both apps must
 *   see the same directory.
 * - r2: Cloudflare R2, from R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
 *   R2_SECRET_ACCESS_KEY and R2_BUCKET_NAME.
 * - s3: any S3-compatible service, from S3_ENDPOINT, S3_REGION, S3_BUCKET,
 *   S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.
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
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for STORAGE_DRIVER=${process.env.STORAGE_DRIVER}`);
  return value;
}

let storage: Storage | undefined;

export function getStorage(): Storage {
  if (!storage) {
    const driver = process.env.STORAGE_DRIVER || 'local';
    if (driver === 'local') {
      storage = createLocalStorage(
        process.env.STORAGE_LOCAL_DIR || path.resolve(process.cwd(), '../../.data/storage')
      );
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
      throw new Error(`Unsupported STORAGE_DRIVER "${driver}"`);
    }
  }
  return storage;
}
