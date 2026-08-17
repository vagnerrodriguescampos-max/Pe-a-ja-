import { NextResponse } from 'next/server';
import { listImports } from '@/lib/store/registry';
import { withApiErrorHandling } from '@/lib/api/handler';

export const dynamic = 'force-dynamic';

export const GET = withApiErrorHandling(async () => {
  return NextResponse.json({ imports: await listImports() });
});
