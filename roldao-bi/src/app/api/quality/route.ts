import { NextResponse } from 'next/server';
import { getActiveContext } from '@/lib/api/context';
import { buildQualityReport } from '@/lib/kpi/quality';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { record, facts } = await getActiveContext();
  if (!record) return NextResponse.json({ report: null });
  const report = buildQualityReport(record, facts);
  return NextResponse.json({ report });
}
