import { getServerSession } from 'next-auth';
import { connection } from 'next/server';
import { authOptions } from '@/server/auth';

export async function getCurrentUser() {
  // getServerSession creates a random CSRF token on every call, which
  // Cache Components refuses while prerendering: wait for the request
  await connection();
  const session = await getServerSession(authOptions);
  return session?.user;
}
