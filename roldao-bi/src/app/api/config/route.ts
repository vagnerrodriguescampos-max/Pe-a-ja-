import { NextRequest, NextResponse } from 'next/server';
import { getConfig, saveConfig } from '@/lib/store/config';
import { withApiErrorHandling } from '@/lib/api/handler';

export const dynamic = 'force-dynamic';

export const GET = withApiErrorHandling(async () => {
  return NextResponse.json({ config: await getConfig() });
});

export const POST = withApiErrorHandling(async (req: NextRequest) => {
  const body = await req.json();
  const config = await saveConfig(body);
  return NextResponse.json({ config });
});
