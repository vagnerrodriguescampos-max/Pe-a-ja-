import type { FactRow, GlobalFilters } from '../types';
import { applyFilters, shiftYearFilters, withDefaultPeriod } from '../query/filters';
import { aggregateByDim, sumTotals } from './aggregate';
import { hasPrimarySheets, restrictToPrimary } from './primary';
import { growth, pct } from '../kpi/format';

export interface RankingRow {
  chave: string;
  nome: string;
  regional?: string;
  venda: number;
  orcamento: number | null;
  atingimentoPct: number | null;
  vendaAnoAnterior: number | null;
  crescimentoPct: number | null;
  margem: number | null;
  margemPct: number | null;
  participacaoPct: number | null;
  gapOrcamento: number | null;
  gapAnoAnterior: number | null;
  lojasDistintas?: number;
  clientes: number | null;
  tendencia: 'subindo' | 'estavel' | 'caindo' | null;
}

export type RankingDim = 'loja_codigo' | 'regional' | 'categoria' | 'segmento' | 'subcategoria' | 'canal' | 'empresa';

const NAME_FIELD: Record<RankingDim, keyof FactRow> = {
  loja_codigo: 'loja_nome',
  regional: 'regional',
  categoria: 'categoria',
  segmento: 'segmento',
  subcategoria: 'subcategoria',
  canal: 'canal',
  empresa: 'empresa',
};

/** Compara a 2ª metade do período com a 1ª, por valor de dimensão, para indicar tendência. */
function buildTrendMap(facts: FactRow[], dim: RankingDim): Map<string, 'subindo' | 'estavel' | 'caindo'> {
  const withDate = facts.filter((f) => f.data && typeof f.venda_bruta === 'number' && f[dim]);
  const trend = new Map<string, 'subindo' | 'estavel' | 'caindo'>();
  if (!withDate.length) return trend;
  const dates = Array.from(new Set(withDate.map((f) => f.data!))).sort();
  if (dates.length < 4) return trend;
  const mid = dates[Math.floor(dates.length / 2)];
  const halves = new Map<string, { first: number; second: number }>();
  for (const f of withDate) {
    const key = String(f[dim]);
    let h = halves.get(key);
    if (!h) { h = { first: 0, second: 0 }; halves.set(key, h); }
    if (f.data! < mid) h.first += f.venda_bruta!; else h.second += f.venda_bruta!;
  }
  for (const [key, h] of halves) {
    if (h.first === 0 && h.second === 0) continue;
    const delta = h.first ? (h.second - h.first) / h.first : (h.second > 0 ? 1 : 0);
    trend.set(key, delta > 0.03 ? 'subindo' : delta < -0.03 ? 'caindo' : 'estavel');
  }
  return trend;
}

const COMPANY_GRAIN_DIMS: RankingDim[] = ['loja_codigo', 'regional', 'empresa'];

export function buildRanking(allFacts: FactRow[], rawFilters: GlobalFilters, dim: RankingDim): RankingRow[] {
  const filters = withDefaultPeriod(allFacts, rawFilters);
  const isDimensionalDrilldown = Boolean(filters.categoria?.length || filters.segmento?.length || filters.subcategoria?.length || filters.canal?.length);
  const filteredCurrent = applyFilters(allFacts, filters);
  const filteredPrevious = applyFilters(allFacts, shiftYearFilters(filters, -1));

  // Loja/Regional/Empresa somam a partir das abas primárias (evita somar a
  // mesma venda várias vezes via os recortes por categoria/segmento/canal).
  // Categoria/Segmento/Subcategoria/Canal usam a base completa, pois só as
  // abas específicas de cada corte carregam essas dimensões.
  const useCompanyGrain = COMPANY_GRAIN_DIMS.includes(dim) && !isDimensionalDrilldown;
  const usesPrimary = hasPrimarySheets(allFacts);
  const current = useCompanyGrain ? restrictToPrimary(filteredCurrent, usesPrimary) : filteredCurrent;
  const previous = useCompanyGrain ? restrictToPrimary(filteredPrevious, usesPrimary) : filteredPrevious;

  const curAgg = aggregateByDim(current, dim, NAME_FIELD[dim]);
  const prevAgg = new Map(aggregateByDim(previous, dim, NAME_FIELD[dim]).map((d) => [d.chave, d]));
  const totalVenda = sumTotals(current).venda_bruta;
  const trendMap = buildTrendMap(current, dim);

  return curAgg.map((row) => {
    const prev = prevAgg.get(row.chave);
    const atingimentoPct = row.orcamento ? pct(row.venda_bruta, row.orcamento) : null;
    const crescimentoPct = prev?.venda_bruta ? growth(row.venda_bruta, prev.venda_bruta) : null;
    const margemPct = row.temMargem ? pct(row.margem, row.venda_bruta) : null;

    return {
      chave: row.chave,
      nome: row.nome,
      regional: row.regional,
      venda: row.venda_bruta,
      orcamento: row.orcamento || null,
      atingimentoPct,
      vendaAnoAnterior: prev?.venda_bruta ?? null,
      crescimentoPct,
      margem: row.temMargem ? row.margem : null,
      margemPct,
      participacaoPct: totalVenda ? pct(row.venda_bruta, totalVenda) : null,
      gapOrcamento: row.orcamento ? row.venda_bruta - row.orcamento : null,
      gapAnoAnterior: prev?.venda_bruta ? row.venda_bruta - prev.venda_bruta : null,
      lojasDistintas: row.lojasDistintas,
      clientes: row.temClientes ? row.clientes : null,
      tendencia: trendMap.get(row.chave) ?? null,
    };
  }).sort((a, b) => b.venda - a.venda);
}
