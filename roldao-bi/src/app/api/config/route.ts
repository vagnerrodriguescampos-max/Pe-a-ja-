import { NextRequest, NextResponse } from 'next/server';
import { getConfig, saveConfig } from '@/lib/store/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ config: getConfig() });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const config = saveConfig(body);
  return NextResponse.json({ config });
}
