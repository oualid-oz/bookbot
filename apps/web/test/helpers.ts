import { NextRequest } from 'next/server';
import { getTableName, sql, type Table } from 'drizzle-orm';
import { vi } from 'vitest';
import { db, schema } from '@bookbot/db';
import { getCurrentUser } from '@/lib/auth';
import { addExportJob } from '@/server/queue';
import { createPasswordUser, getUserOrgs } from '@/server/users';

export interface TestUser {
  id: string;
  email: string;
  name: string;
  orgId: string;
}

/** Empty every table (the test database only) */
export async function resetDatabase() {
  const tables = Object.values(schema)
    .map((table) => `"${getTableName(table as Table)}"`)
    .join(', ');
  await db.execute(sql.raw(`truncate table ${tables} cascade`));
}

let counter = 0;

/** A user with their own organization, created through the real sign-up code */
export async function createUser(name = 'Test User'): Promise<TestUser> {
  const email = `user${++counter}-${Date.now()}@example.com`;
  const user = await createPasswordUser({ name, email, passwordHash: 'scrypt$00$00' });
  if (!user) throw new Error('createUser: email taken');
  const [org] = await getUserOrgs(user.id);
  return { id: user.id, email, name, orgId: org.id };
}

/** Make route handlers see this user as signed in (null = signed out) */
export function signInAs(user: TestUser | null) {
  vi.mocked(getCurrentUser).mockResolvedValue(
    user ? { id: user.id, email: user.email, name: user.name } : undefined
  );
}

export function request(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  const { method = 'GET', body, headers = {} } = init;
  return new NextRequest(new URL(path, 'http://localhost:3000'), {
    method,
    headers: body === undefined ? headers : { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
}

/** Route handler context for dynamic segments */
export function params<T extends Record<string, string>>(values: T) {
  return { params: Promise.resolve(values) };
}

export async function json<T = Record<string, unknown>>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

/** Export IDs passed to the (mocked) queue */
export function queuedExports(): string[] {
  return vi.mocked(addExportJob).mock.calls.map(([id]) => id);
}
