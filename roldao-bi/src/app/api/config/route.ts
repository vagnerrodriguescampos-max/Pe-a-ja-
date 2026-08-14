import { NextRequest, NextResponse } from 'next/server';
import { getConfig, saveConfig } from '@/lib/store/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ config: await getConfig() });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const config = await saveConfig(body);
  return NextResponse.json({ config });
}
