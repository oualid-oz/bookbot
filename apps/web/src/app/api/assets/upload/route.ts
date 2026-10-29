import { NextRequest, NextResponse } from 'next/server';
import { assetKindSchema } from '@bookbot/shared';
import { generatePresignedUploadUrl, validateImage, saveAsset } from '@/lib/storage';
import { errorResponse, requireOrgAccess } from '@/server/org-access';

export async function POST(req: NextRequest) {
  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return errorResponse(400, 'Expected multipart form data');
  }

  const file = formData.get('file');
  const orgIdField = formData.get('orgId');
  const kind = assetKindSchema.safeParse(formData.get('kind') ?? 'image');

  if (!(file instanceof File)) {
    return errorResponse(400, 'Missing file');
  }
  if (!kind.success) {
    return errorResponse(400, 'Invalid kind');
  }

  const access = await requireOrgAccess(typeof orgIdField === 'string' ? orgIdField : undefined);
  if (!access.ok) return access.response;
  const { orgId } = access.value;

  // Validate image if it's an image file
  let dimensions = { width: 0, height: 0, dpi: 0 };
  if (kind.data === 'image') {
    if (!file.type.startsWith('image/')) {
      return errorResponse(400, 'File is not an image');
    }
    const validation = await validateImage(file);
    if (!validation.valid) {
      return errorResponse(400, validation.error ?? 'Invalid image');
    }
    dimensions = validation;
  }

  // Generate presigned URL
  const { uploadUrl, key } = await generatePresignedUploadUrl(orgId, file.name, file.type);

  // Save asset metadata
  await saveAsset(
    orgId,
    key,
    kind.data,
    dimensions.width,
    dimensions.height,
    dimensions.dpi,
    file.size,
    file.type
  );

  return NextResponse.json({ uploadUrl, key });
}
