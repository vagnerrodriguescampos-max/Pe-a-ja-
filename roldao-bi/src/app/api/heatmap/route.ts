import { NextRequest, NextResponse } from 'next/server';
import { getActiveContext, parseFilters } from '@/lib/api/context';
import { applyFilters, withDefaultPeriod } from '@/lib/query/filters';
import { aggregateByDim } from '@/lib/query/aggregate';
import { hasPrimarySheets, restrictToPrimary } from '@/lib/query/primary';
import { formatDateBR, pct } from '@/lib/kpi/format';

export const dynamic = 'force-dynamic';

/** Loja (top N por venda) x Dia — célula = atingimento % quando há orçamento diário, senão venda. */
export async function GET(req: NextRequest) {
  const { facts } = await getActiveContext();
  const filters = withDefaultPeriod(facts, parseFilters(req.nextUrl.searchParams));
  const limit = Number(req.nextUrl.searchParams.get('limit') ?? 12);
  const filtered = applyFilters(facts, filters);
  const current = restrictToPrimary(filtered, hasPrimarySheets(facts)).filter((f) => f.data && f.loja_codigo);

  const topLojas = aggregateByDim(current, 'loja_codigo', 'loja_nome').sort((a, b) => b.venda_bruta - a.venda_bruta).slice(0, limit);
  const lojaSet = new Set(topLojas.map((l) => l.chave));
  const dates = Array.from(new Set(current.map((f) => f.data!))).sort();

  const map = new Map<string, { venda: number; orcamento: number }>();
  for (const f of current) {
    if (!lojaSet.has(f.loja_codigo!)) continue;
    const key = `${f.loja_codigo}|${f.data}`;
    let cell = map.get(key);
    if (!cell) { cell = { venda: 0, orcamento: 0 }; map.set(key, cell); }
    if (typeof f.venda_bruta === 'number') cell.venda += f.venda_bruta;
    if (typeof f.orcamento === 'number') cell.orcamento += f.orcamento;
  }

  const temOrcamentoDiario = Array.from(map.values()).some((c) => c.orcamento > 0);
  const linhas = topLojas.map((l) => l.nome);
  const colunas = dates.map((d) => formatDateBR(d).slice(0, 5));
  const cells = topLojas.flatMap((l) =>
    dates.map((d, i) => {
      const cell = map.get(`${l.chave}|${d}`);
      const valor = cell ? (temOrcamentoDiario && cell.orcamento > 0 ? pct(cell.venda, cell.orcamento) : cell.venda) : null;
      return { linha: l.nome, coluna: colunas[i], valor };
    })
  );

  return NextResponse.json({ linhas, colunas, cells, mode: temOrcamentoDiario ? 'pct' : 'raw' });
}
