import { NextRequest, NextResponse } from 'next/server';
import { getActiveContext, parseFilters } from '@/lib/api/context';
import { applyFilters, shiftYearFilters, withDefaultPeriod } from '@/lib/query/filters';
import { accumulate, dailySeries } from '@/lib/query/aggregate';
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
  const daily = dailySeries(current, previous);
  const series = accumulate(daily);

  // indicador de aceleração: compara o ritmo (delta diário médio) da 2ª metade vs 1ª metade
  let ritmo: 'acelerando' | 'estavel' | 'desacelerando' | null = null;
  if (daily.length >= 6) {
    const mid = Math.floor(daily.length / 2);
    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    const primeira = avg(daily.slice(0, mid).map((d) => d.venda));
    const segunda = avg(daily.slice(mid).map((d) => d.venda));
    if (primeira > 0) {
      const delta = (segunda - primeira) / primeira;
      ritmo = delta > 0.03 ? 'acelerando' : delta < -0.03 ? 'desacelerando' : 'estavel';
    }
  }

  return NextResponse.json({ series, ritmo });
}
