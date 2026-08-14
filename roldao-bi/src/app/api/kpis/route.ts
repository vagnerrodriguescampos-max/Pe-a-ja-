import { NextRequest, NextResponse } from 'next/server';
import { getActiveContext, parseFilters } from '@/lib/api/context';
import { computeExecutiveKpis } from '@/lib/kpi/executive';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { facts } = getActiveContext();
  const filters = parseFilters(req.nextUrl.searchParams);
  const kpis = computeExecutiveKpis(facts, filters);
  return NextResponse.json({ kpis });
}
