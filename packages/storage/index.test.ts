import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createLocalStorage, storageDriver } from './index';

describe('createLocalStorage', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'bookbot-storage-'));
  const storage = createLocalStorage(dir);
  afterAll(() => rm(dir, { recursive: true, force: true }));

  it('should round-trip an object in nested folders', async () => {
    const body = new TextEncoder().encode('%PDF-test');
    await storage.put('exports/org-1/file.pdf', body, 'application/pdf');
    expect(await storage.get('exports/org-1/file.pdf')).toEqual(body);
  });

  it('should return null for a missing object', async () => {
    expect(await storage.get('exports/missing.pdf')).toBeNull();
  });

  it('should reject keys that escape the root', async () => {
    await expect(storage.put('../outside.pdf', new Uint8Array(), 'application/pdf')).rejects.toThrow('Invalid storage key');
    await expect(storage.get('exports/../../outside.pdf')).rejects.toThrow('Invalid storage key');
  });

  it('should delete objects, ignoring missing ones', async () => {
    await storage.put('assets/a.png', new Uint8Array([1]), 'image/png');
    await storage.delete('assets/a.png');
    expect(await storage.get('assets/a.png')).toBeNull();
    await expect(storage.delete('assets/a.png')).resolves.toBeUndefined();
  });

  it('should not presign uploads (they go through the API)', async () => {
    expect(await storage.presignPut('assets/a.png', 'image/png', 10)).toBeNull();
  });
});

describe('storageDriver', () => {
  it('uses FILE_STORAGE when set, else the settings that are filled in', () => {
    expect(storageDriver({ FILE_STORAGE: 's3', R2_ACCOUNT_ID: 'acc' })).toBe('s3');
    expect(storageDriver({ R2_ACCOUNT_ID: 'acc', R2_BUCKET_NAME: 'books' })).toBe('r2');
    expect(storageDriver({ S3_BUCKET: 'books' })).toBe('s3');
    // Empty values from a copied .env don't count
    expect(storageDriver({ FILE_STORAGE: '', R2_ACCOUNT_ID: '', S3_BUCKET: '' })).toBe('local');
  });
});
