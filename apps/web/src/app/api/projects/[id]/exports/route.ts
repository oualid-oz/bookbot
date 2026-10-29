import { NextRequest, NextResponse } from 'next/server';
import { listExports, requireProjectAccess } from '@/server/projects';

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/projects/[id]/exports'>) {
  const result = await requireProjectAccess((await ctx.params).id);
  if (!result.ok) return result.response;

  return NextResponse.json({ exports: await listExports(result.value.project.id) });
}
