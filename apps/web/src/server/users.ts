import { randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db, users, accounts, organizations, memberships } from '@bookbot/db';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface SignInProfile {
  email: string;
  name?: string | null;
  image?: string | null;
  provider: string;
  providerAccountId: string;
  type: string;
  /** Whether the provider proved the user owns this email */
  emailVerified: boolean;
  tokens?: {
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
    token_type?: string;
    scope?: string;
    id_token?: string;
    session_state?: string;
  };
}

/**
 * Find or create the user for a sign-in, link the provider account, and make
 * sure the user belongs to at least one organization. Returns the user's id.
 *
 * Accounts are linked by email, so callers must only pass verified emails.
 */
export async function provisionUser(profile: SignInProfile): Promise<string> {
  const email = profile.email.toLowerCase();

  return db.transaction(async (tx) => {
    const [linked] = await tx
      .select({ userId: accounts.userId })
      .from(accounts)
      .where(
        and(
          eq(accounts.provider, profile.provider),
          eq(accounts.providerAccountId, profile.providerAccountId)
        )
      )
      .limit(1);

    let userId = linked?.userId;

    if (!userId) {
      const [existing] = await tx
        .select({ id: users.id, emailVerified: users.emailVerified })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      userId = existing?.id;

      // The provider has verified this email. If the existing account was created
      // by password sign-up and never verified, someone else may have registered
      // it, so drop their password before linking the real owner's account.
      if (existing && !existing.emailVerified && profile.emailVerified) {
        await tx
          .update(users)
          .set({ emailVerified: new Date(), passwordHash: null, updatedAt: new Date() })
          .where(eq(users.id, existing.id));
      }

      if (!userId) {
        const [created] = await tx
          .insert(users)
          .values({
            email,
            name: profile.name ?? null,
            image: profile.image ?? null,
            emailVerified: profile.emailVerified ? new Date() : null,
          })
          .returning({ id: users.id });
        userId = created.id;
      }

      await tx
        .insert(accounts)
        .values({
          userId,
          type: profile.type,
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
          ...profile.tokens,
        })
        .onConflictDoNothing();
    }

    await ensureMembership(tx, userId, profile.name || email.split('@')[0], email);

    return userId;
  });
}

/**
 * Create a user who signs in with email and password, plus their organization.
 * Returns null if the email is already registered.
 */
export async function createPasswordUser(input: {
  name: string;
  email: string;
  passwordHash: string;
}): Promise<{ id: string } | null> {
  const email = input.email.toLowerCase();

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(users)
      .values({ email, name: input.name, passwordHash: input.passwordHash })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id });

    if (!created) return null;

    await ensureMembership(tx, created.id, input.name, email);
    return created;
  });
}

/**
 * Look up a user for password sign-in
 */
export async function getPasswordUser(email: string) {
  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  return user ?? null;
}

/**
 * Give the user a personal organization if they don't belong to one yet
 */
async function ensureMembership(tx: Tx, userId: string, displayName: string, email: string) {
  const [membership] = await tx
    .select({ id: memberships.id })
    .from(memberships)
    .where(eq(memberships.userId, userId))
    .limit(1);

  if (membership) return;

  const [org] = await tx
    .insert(organizations)
    .values({ name: `${displayName}'s workspace`, slug: makeSlug(email) })
    .returning({ id: organizations.id });

  await tx.insert(memberships).values({ userId, orgId: org.id, role: 'owner' });
}

/**
 * Get all organizations the user belongs to, with their role
 */
export async function getUserOrgs(userId: string) {
  return db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.orgId, organizations.id))
    .where(eq(memberships.userId, userId))
    .orderBy(memberships.createdAt);
}

function makeSlug(email: string): string {
  const base = email
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'workspace';
  return `${base}-${randomBytes(3).toString('hex')}`;
}
