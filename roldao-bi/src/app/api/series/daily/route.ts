import { NextRequest, NextResponse } from 'next/server';
import { getActiveContext, parseFilters } from '@/lib/api/context';
import { applyFilters, shiftYearFilters, withDefaultPeriod } from '@/lib/query/filters';
import { dailySeries } from '@/lib/query/aggregate';
import { hasPrimarySheets, restrictToPrimary } from '@/lib/query/primary';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { facts } = getActiveContext();
  const filters = withDefaultPeriod(facts, parseFilters(req.nextUrl.searchParams));
  const isDimensionalDrilldown = Boolean(filters.categoria?.length || filters.segmento?.length || filters.subcategoria?.length || filters.canal?.length);
  const usesPrimary = hasPrimarySheets(facts);
  const filteredCurrent = applyFilters(facts, filters);
  const filteredPrevious = applyFilters(facts, shiftYearFilters(filters, -1));
  const current = isDimensionalDrilldown ? filteredCurrent : restrictToPrimary(filteredCurrent, usesPrimary);
  const previous = isDimensionalDrilldown ? filteredPrevious : restrictToPrimary(filteredPrevious, usesPrimary);
  const series = dailySeries(current, previous);
  return NextResponse.json({ series });
}
