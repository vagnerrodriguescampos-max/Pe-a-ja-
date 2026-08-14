import { NextResponse } from 'next/server';
import { listImports } from '@/lib/store/registry';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ imports: await listImports() });
}
