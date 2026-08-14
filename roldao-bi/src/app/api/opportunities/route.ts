import { NextRequest, NextResponse } from 'next/server';
import { getActiveContext, parseFilters } from '@/lib/api/context';
import { generateOpportunities } from '@/lib/kpi/insights';
import { getConfig } from '@/lib/store/config';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { facts } = getActiveContext();
  const filters = parseFilters(req.nextUrl.searchParams);
  const cfg = getConfig();
  const phrases = generateOpportunities(facts, filters, cfg);
  return NextResponse.json({ phrases });
}
