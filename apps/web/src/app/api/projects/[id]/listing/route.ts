import { NextRequest, NextResponse } from 'next/server';
import { listingUpdateSchema } from '@bookbot/shared';
import { keywordSuggestions, saveListing, serializeListing } from '@/server/listings';
import { errorResponse, readJson } from '@/server/org-access';
import { requireProjectAccess } from '@/server/projects';

/** The project's Amazon listing, what KDP would object to, and keyword ideas */
export async function GET(_req: NextRequest, ctx: RouteContext<'/api/projects/[id]/listing'>) {
  const result = await requireProjectAccess((await ctx.params).id);
  if (!result.ok) return result.response;
  return NextResponse.json({
    ...serializeListing(result.value.listing),
    suggestions: await keywordSuggestions(result.value),
  });
}

export async function PUT(req: NextRequest, ctx: RouteContext<'/api/projects/[id]/listing'>) {
  const result = await requireProjectAccess((await ctx.params).id);
  if (!result.ok) return result.response;

  const parsed = listingUpdateSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return errorResponse(400, 'Invalid listing', { fields: parsed.error.flatten().fieldErrors });
  }
  return NextResponse.json(await saveListing(result.value.project.id, parsed.data));
}
