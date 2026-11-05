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

  it('should read just the start of a file, with its full size', async () => {
    const body = new Uint8Array(1000).map((_, i) => i % 256);
    await storage.put('assets/big.png', body, 'image/png');
    const start = await storage.readStart('assets/big.png', 100);
    expect(start?.size).toBe(1000);
    expect(start?.bytes).toEqual(body.subarray(0, 100));
    expect((await storage.readStart('assets/big.png', 5000))?.bytes).toEqual(body);
    expect(await storage.readStart('assets/missing.png', 100)).toBeNull();
  });

  it('should delete objects, ignoring missing ones', async () => {
    await storage.put('assets/a.png', new Uint8Array([1]), 'image/png');
    await storage.delete('assets/a.png');
    expect(await storage.get('assets/a.png')).toBeNull();
    await expect(storage.delete('assets/a.png')).resolves.toBeUndefined();
  });

});

describe('storageDriver', () => {
  it('uses FILE_STORAGE when set, else Vercel Blob when its token is set, else local', () => {
    expect(storageDriver({ FILE_STORAGE: 'local', BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_x' })).toBe('local');
    expect(storageDriver({ BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_x' })).toBe('vercel-blob');
    // Empty values from a copied .env don't count
    expect(storageDriver({ FILE_STORAGE: '', BLOB_READ_WRITE_TOKEN: '' })).toBe('local');
  });
});
