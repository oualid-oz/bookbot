import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createLocalStorage } from './index';

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
});
