import { NextRequest, NextResponse } from 'next/server';
import { getActiveContext, parseFilters } from '@/lib/api/context';
import { computeForecast } from '@/lib/kpi/forecast';
import { withApiErrorHandling } from '@/lib/api/handler';

export const dynamic = 'force-dynamic';

export const GET = withApiErrorHandling(async (req: NextRequest) => {
  const { facts } = await getActiveContext();
  const filters = parseFilters(req.nextUrl.searchParams);
  const forecast = computeForecast(facts, filters);
  return NextResponse.json({ forecast });
});
