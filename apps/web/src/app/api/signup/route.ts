import { NextRequest, NextResponse } from 'next/server';
import { signupSchema } from '@bookbot/shared';
import { hashPassword } from '@/lib/password';
import { checkRateLimit } from '@/lib/rate-limit';
import { createPasswordUser } from '@/server/users';

export async function POST(req: NextRequest) {
  // 5 sign-ups per hour per IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const rateLimit = checkRateLimit(`signup:${ip}`, 5, 60 * 60 * 1000);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many sign-up attempts. Try again later.' },
      { status: 429, headers: { 'Retry-After': Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString() } }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', fields: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { name, email, password } = parsed.data;
  const user = await createPasswordUser({ name, email, passwordHash: await hashPassword(password) });

  if (!user) {
    return NextResponse.json(
      { error: 'An account with this email already exists', fields: { email: ['An account with this email already exists'] } },
      { status: 409 }
    );
  }

  return NextResponse.json({ id: user.id, email }, { status: 201 });
}
