import { NextRequest } from 'next/server';
import { keywordLookupSchema } from '@bookbot/shared';
import { errorResponse, readJson, requireOrgAccess } from '@/server/org-access';

/**
 * Keyword search volume and competition. Unavailable until a data provider is
 * connected: never answer with made-up numbers, and don't count it as a lookup.
 */
export async function POST(req: NextRequest) {
  const parsed = keywordLookupSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return errorResponse(400, 'Invalid input', { fields: parsed.error.flatten().fieldErrors });
  }

  const access = await requireOrgAccess(parsed.data.orgId);
  if (!access.ok) return access.response;

  return errorResponse(503, 'Keyword data is not available yet');
}
