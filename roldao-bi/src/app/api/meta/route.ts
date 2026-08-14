import { NextRequest, NextResponse } from 'next/server';
import { getActiveContext, parseFilters } from '@/lib/api/context';
import { applyFilters, buildDimensionOptions } from '@/lib/query/filters';
import { getConfig } from '@/lib/store/config';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { record, facts } = await getActiveContext();
  const filters = parseFilters(req.nextUrl.searchParams);
  const hasFilters = Object.values(filters).some((v) => (Array.isArray(v) ? v.length : v));
  const scoped = hasFilters ? applyFilters(facts, filters) : facts;
  const options = buildDimensionOptions(scoped);
  const config = await getConfig();
  return NextResponse.json({ record, options, config });
}
