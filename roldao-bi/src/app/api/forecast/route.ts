import { NextRequest, NextResponse } from 'next/server';
import { getActiveContext, parseFilters } from '@/lib/api/context';
import { computeForecast } from '@/lib/kpi/forecast';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { facts } = getActiveContext();
  const filters = parseFilters(req.nextUrl.searchParams);
  const forecast = computeForecast(facts, filters);
  return NextResponse.json({ forecast });
}
