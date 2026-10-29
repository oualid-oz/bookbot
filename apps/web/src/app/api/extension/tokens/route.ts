import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createExtensionToken, listExtensionTokens } from '@/server/extension-tokens';
import { errorResponse, readJson, requireOrgAccess } from '@/server/org-access';

const createSchema = z.object({
  orgId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(100).default('Chrome extension'),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

export async function GET(req: NextRequest) {
  const access = await requireOrgAccess(req.nextUrl.searchParams.get('orgId'));
  if (!access.ok) return access.response;
  return NextResponse.json({ tokens: await listExtensionTokens(access.value.orgId, access.value.userId) });
}

export async function POST(req: NextRequest) {
  const parsed = createSchema.safeParse((await readJson(req)) ?? {});
  if (!parsed.success) {
    return errorResponse(400, 'Invalid input', { fields: parsed.error.flatten().fieldErrors });
  }
  const access = await requireOrgAccess(parsed.data.orgId);
  if (!access.ok) return access.response;

  const created = await createExtensionToken({ ...parsed.data, orgId: access.value.orgId, userId: access.value.userId });
  return NextResponse.json(created, { status: 201 });
}
