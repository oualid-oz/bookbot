import { NextRequest, NextResponse } from 'next/server';
import { saveBookSchema } from '@bookbot/shared';
import { checkRateLimit } from '@/lib/rate-limit';
import { saveBook } from '@/server/books';
import { requireExtensionToken } from '@/server/extension-tokens';
import { errorResponse, readJson } from '@/server/org-access';

/** Save the book the extension is looking at */
export async function POST(req: NextRequest) {
  const auth = await requireExtensionToken(req);
  if (!auth.ok) return auth.response;

  if (!(await checkRateLimit(`ext:${auth.value.orgId}`, 100, 60000)).allowed) {
    return errorResponse(429, 'Rate limit exceeded');
  }

  const parsed = saveBookSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return errorResponse(400, 'Invalid input', { fields: parsed.error.flatten().fieldErrors });
  }

  return NextResponse.json({ book: await saveBook(auth.value.orgId, parsed.data) }, { status: 201 });
}
