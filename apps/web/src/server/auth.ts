import type { NextAuthOptions } from 'next-auth';
import type { Provider } from 'next-auth/providers/index';
import GoogleProvider, { type GoogleProfile } from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { getPasswordUser, getSessionVersion, provisionUser } from './users';
import { verifyAgainstDummy, verifyPassword } from '@/lib/password';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

const providers: Provider[] = [
  CredentialsProvider({
    id: 'password',
    name: 'Email',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials, req) {
      const email = credentials?.email?.trim().toLowerCase();
      const password = credentials?.password;
      if (!email || !password) return null;

      // Per email (guessing one account) and per IP (trying many accounts)
      const window = 15 * 60 * 1000;
      const ip = getClientIp(new Headers(req.headers as Record<string, string>));
      const [byEmail, byIp] = await Promise.all([
        checkRateLimit(`login:${email}`, 10, window),
        checkRateLimit(`login-ip:${ip}`, 50, window),
      ]);
      if (!byEmail.allowed || !byIp.allowed) return null;

      const user = await getPasswordUser(email);
      if (!user?.passwordHash) {
        await verifyAgainstDummy(password);
        return null;
      }
      if (!(await verifyPassword(password, user.passwordHash))) return null;

      return { id: user.id, email: user.email, name: user.name };
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

// Passwordless email login for local development only. `next build` and
// `next start` run with NODE_ENV=production, so this never ships.
if (process.env.NODE_ENV === 'development') {
  providers.push(
    CredentialsProvider({
      id: 'dev-login',
      name: 'Dev login',
      credentials: {
        email: { label: 'Email', type: 'email' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        if (!email || !/^[^\s@]+@[^\s@]+$/.test(email)) return null;
        return { id: email, email, name: email.split('@')[0] };
      },
    })
  );
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  providers,
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) return false;
      // Accounts are linked by email, so only accept verified Google emails
      if (account?.provider === 'google') {
        return (profile as GoogleProfile | undefined)?.email_verified === true;
      }
      return true;
    },
    async jwt({ token, user, account }) {
      // `account` is only present on sign-in: map the provider user to our DB user
      if (account?.provider === 'password') {
        // authorize() already returned the DB user
        token.id = user.id;
        token.sv = (await getSessionVersion(user.id)) ?? 0;
      } else if (account && user?.email) {
        token.id = await provisionUser({
          email: user.email,
          name: user.name,
          image: user.image,
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          type: account.type,
          emailVerified: account.provider === 'google',
          tokens: {
            access_token: account.access_token,
            refresh_token: account.refresh_token,
            expires_at: account.expires_at,
            token_type: account.token_type,
            scope: account.scope,
            id_token: account.id_token,
            session_state: account.session_state,
          },
        });
        token.sv = (await getSessionVersion(token.id)) ?? 0;
      } else if (token.id) {
        // Every later check: sessions from before a password reset stop working.
        // Throwing makes NextAuth reject the session and clear its cookie.
        const current = await getSessionVersion(token.id);
        if (current === null || current !== (token.sv ?? 0)) {
          throw new Error('Session revoked');
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
      }
      return session;
    },
  },
};
