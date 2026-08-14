import { NextRequest, NextResponse } from 'next/server';
import { getActiveContext, parseFilters } from '@/lib/api/context';
import { buildRanking, type RankingDim } from '@/lib/query/ranking';

export const dynamic = 'force-dynamic';

const VALID_DIMS: RankingDim[] = ['loja_codigo', 'regional', 'categoria', 'segmento', 'subcategoria', 'canal', 'empresa'];

export async function GET(req: NextRequest) {
  const { facts } = getActiveContext();
  const filters = parseFilters(req.nextUrl.searchParams);
  const dimParam = (req.nextUrl.searchParams.get('dim') as RankingDim) || 'loja_codigo';
  const dim = VALID_DIMS.includes(dimParam) ? dimParam : 'loja_codigo';
  const rows = buildRanking(facts, filters, dim);
  return NextResponse.json({ dim, rows });
}
