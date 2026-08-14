import { NextRequest, NextResponse } from 'next/server';
import { getActiveContext, parseFilters } from '@/lib/api/context';
import { generateExecutiveSummary } from '@/lib/kpi/insights';
import { getConfig } from '@/lib/store/config';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { facts } = await getActiveContext();
  const filters = parseFilters(req.nextUrl.searchParams);
  const cfg = await getConfig();
  const summary = generateExecutiveSummary(facts, filters, cfg);
  return NextResponse.json({ summary });
}
