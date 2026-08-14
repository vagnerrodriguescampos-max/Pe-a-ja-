import { NextRequest, NextResponse } from 'next/server';
import { getActiveContext, parseFilters } from '@/lib/api/context';
import { applyFilters, withDefaultPeriod } from '@/lib/query/filters';
import { aggregateByDim } from '@/lib/query/aggregate';
import { pct } from '@/lib/kpi/format';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { facts } = await getActiveContext();
  const filters = withDefaultPeriod(facts, parseFilters(req.nextUrl.searchParams));
  const current = applyFilters(facts, filters).filter((f) => f.sheetRole === 'PISO');
  const porLoja = aggregateByDim(current, 'loja_codigo', 'loja_nome');

  const rows = porLoja.map((l) => ({
    loja: l.nome,
    codigo: l.chave,
    regional: l.regional ?? null,
    venda: l.venda_bruta,
    piso: l.temPiso ? l.piso : null,
    orcamento: l.orcamento || null,
    abaixoDoPiso: l.temPiso ? l.venda_bruta < l.piso : null,
    atingimentoPisoPct: l.temPiso && l.piso ? pct(l.venda_bruta, l.piso) : null,
  })).sort((a, b) => (a.atingimentoPisoPct ?? 999) - (b.atingimentoPisoPct ?? 999));

  return NextResponse.json({ rows, disponivel: current.length > 0 });
}
