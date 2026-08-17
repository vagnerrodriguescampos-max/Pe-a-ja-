import { NextRequest, NextResponse } from 'next/server';
import { getActiveContext, parseFilters } from '@/lib/api/context';
import { generateOpportunities } from '@/lib/kpi/insights';
import { getConfig } from '@/lib/store/config';
import { withApiErrorHandling } from '@/lib/api/handler';

export const dynamic = 'force-dynamic';

export const GET = withApiErrorHandling(async (req: NextRequest) => {
  const { facts } = await getActiveContext();
  const filters = parseFilters(req.nextUrl.searchParams);
  const cfg = await getConfig();
  const phrases = generateOpportunities(facts, filters, cfg);
  return NextResponse.json({ phrases });
});
