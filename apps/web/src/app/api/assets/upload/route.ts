import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { generatePresignedUploadUrl, validateImage, saveAsset } from '@/lib/storage';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File;
  const orgId = formData.get('orgId') as string;
  const kind = (formData.get('kind') as 'image' | 'font' | 'other') || 'image';

  if (!file || !orgId) {
    return NextResponse.json({ error: 'Missing file or orgId' }, { status: 400 });
  }

  // Validate image if it's an image file
  if (kind === 'image' && file.type.startsWith('image/')) {
    const validation = await validateImage(file);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
  }

  // Generate presigned URL
  const { uploadUrl, key } = await generatePresignedUploadUrl(orgId, file.name, file.type);

  // Save asset metadata
  if (kind === 'image') {
    const validation = await validateImage(file);
    await saveAsset(
      orgId,
      key,
      kind,
      validation.width,
      validation.height,
      validation.dpi,
      file.size,
      file.type
    );
  } else {
    await saveAsset(orgId, key, kind, 0, 0, 0, file.size, file.type);
  }

  return NextResponse.json({ uploadUrl, key });
}
