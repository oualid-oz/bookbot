import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, like } from 'drizzle-orm';
import { db, verificationTokens } from '@bookbot/db';
import { sendEmail } from './email';

type Purpose = 'verify' | 'reset';

const TOKEN_TTL_MS: Record<Purpose, number> = {
  verify: 24 * 60 * 60 * 1000,
  reset: 60 * 60 * 1000,
};

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const identifier = (purpose: Purpose, email: string) => `${purpose}:${email.toLowerCase()}`;

function appUrl(path: string) {
  return new URL(path, process.env.NEXTAUTH_URL ?? 'http://localhost:3000').toString();
}

/**
 * Issue a single-use token for an email; any earlier token for the same
 * purpose stops working. Only the token's hash is stored.
 */
async function issueToken(purpose: Purpose, email: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const id = identifier(purpose, email);
  await db.transaction(async (tx) => {
    await tx.delete(verificationTokens).where(eq(verificationTokens.identifier, id));
    await tx.insert(verificationTokens).values({
      identifier: id,
      token: hashToken(token),
      expires: new Date(Date.now() + TOKEN_TTL_MS[purpose]),
    });
  });
  return token;
}

/**
 * Use up a token. Returns the email it was issued for, or null if it's
 * unknown, expired, or already used.
 */
export async function consumeToken(purpose: Purpose, token: string): Promise<string | null> {
  const [row] = await db
    .delete(verificationTokens)
    .where(
      and(
        eq(verificationTokens.token, hashToken(token)),
        like(verificationTokens.identifier, `${purpose}:%`),
        gt(verificationTokens.expires, new Date())
      )
    )
    .returning({ identifier: verificationTokens.identifier });
  return row ? row.identifier.slice(purpose.length + 1) : null;
}

export async function sendVerificationEmail(email: string) {
  const token = await issueToken('verify', email);
  await sendEmail({
    to: email,
    subject: 'Verify your Bookbot email',
    text: `Confirm this is your email address by opening the link below (valid for 24 hours):\n\n${appUrl(`/verify-email?token=${token}`)}\n\nIf you didn't create a Bookbot account, you can ignore this email.`,
  });
}

export async function sendPasswordResetEmail(email: string) {
  const token = await issueToken('reset', email);
  await sendEmail({
    to: email,
    subject: 'Reset your Bookbot password',
    text: `Choose a new password by opening the link below (valid for 1 hour):\n\n${appUrl(`/reset-password?token=${token}`)}\n\nIf you didn't ask to reset your password, you can ignore this email; your password stays the same.`,
  });
}
