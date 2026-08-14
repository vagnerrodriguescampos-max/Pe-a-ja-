import { NextRequest, NextResponse } from 'next/server';
import { getActiveContext, parseFilters } from '@/lib/api/context';
import { buildRanking, type RankingDim } from '@/lib/query/ranking';

export const dynamic = 'force-dynamic';

const VALID_DIMS: RankingDim[] = ['loja_codigo', 'regional', 'categoria', 'segmento', 'subcategoria', 'canal', 'empresa'];

const HEADERS = [
  'Nome', 'Regional', 'Venda', 'Orçamento', 'Atingimento %', 'Venda Ano Anterior',
  'Crescimento %', 'Margem', 'Margem %', 'Participação %', 'Gap Orçamento', 'Clientes',
];

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: NextRequest) {
  const { facts } = getActiveContext();
  const filters = parseFilters(req.nextUrl.searchParams);
  const dimParam = (req.nextUrl.searchParams.get('dim') as RankingDim) || 'loja_codigo';
  const dim = VALID_DIMS.includes(dimParam) ? dimParam : 'loja_codigo';
  const rows = buildRanking(facts, filters, dim);

  const lines = [HEADERS.join(';')];
  for (const r of rows) {
    lines.push([
      r.nome, r.regional ?? '', r.venda, r.orcamento ?? '', r.atingimentoPct?.toFixed(1) ?? '',
      r.vendaAnoAnterior ?? '', r.crescimentoPct?.toFixed(1) ?? '', r.margem ?? '', r.margemPct?.toFixed(1) ?? '',
      r.participacaoPct?.toFixed(1) ?? '', r.gapOrcamento ?? '', r.clientes ?? '',
    ].map(csvEscape).join(';'));
  }
  const csv = '﻿' + lines.join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="roldao-bi-${dim}.csv"`,
    },
  });
}
