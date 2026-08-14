import type { FactRow } from '../types';

export interface Totals {
  venda_bruta: number;
  venda_liquida: number;
  orcamento: number;
  piso: number;
  margem: number;
  clientes: number;
  count: number;
  temMargem: boolean;
  temVendaLiquida: boolean;
  temPiso: boolean;
  temClientes: boolean;
}

export function sumTotals(facts: FactRow[]): Totals {
  const t: Totals = {
    venda_bruta: 0, venda_liquida: 0, orcamento: 0, piso: 0, margem: 0, clientes: 0,
    count: facts.length, temMargem: false, temVendaLiquida: false, temPiso: false, temClientes: false,
  };
  for (const f of facts) {
    if (typeof f.venda_bruta === 'number') t.venda_bruta += f.venda_bruta;
    if (typeof f.venda_liquida === 'number') { t.venda_liquida += f.venda_liquida; t.temVendaLiquida = true; }
    if (typeof f.orcamento === 'number') t.orcamento += f.orcamento;
    if (typeof f.piso === 'number') { t.piso += f.piso; t.temPiso = true; }
    if (typeof f.margem === 'number') { t.margem += f.margem; t.temMargem = true; }
    if (typeof f.clientes === 'number') { t.clientes += f.clientes; t.temClientes = true; }
  }
  return t;
}

export interface DimAgg extends Totals {
  chave: string;
  nome: string;
  regional?: string;
  lojasDistintas?: number;
}

/** Agrupa e soma por uma dimensão qualquer (loja, regional, categoria, segmento, subcategoria, canal). */
export function aggregateByDim(
  facts: FactRow[],
  codeField: keyof FactRow,
  nameField: keyof FactRow = codeField
): DimAgg[] {
  const map = new Map<string, { rows: FactRow[]; nome: string; regional?: string; lojas: Set<string> }>();
  for (const f of facts) {
    const codeVal = f[codeField];
    if (codeVal === undefined || codeVal === null || codeVal === '') continue;
    const key = String(codeVal);
    let entry = map.get(key);
    if (!entry) {
      entry = { rows: [], nome: String(f[nameField] ?? codeVal), regional: f.regional, lojas: new Set() };
      map.set(key, entry);
    }
    entry.rows.push(f);
    if (f.loja_codigo) entry.lojas.add(f.loja_codigo);
    if (!entry.regional && f.regional) entry.regional = f.regional;
  }
  const out: DimAgg[] = [];
  for (const [key, entry] of map) {
    const totals = sumTotals(entry.rows);
    out.push({ chave: key, nome: entry.nome, regional: entry.regional, lojasDistintas: entry.lojas.size, ...totals });
  }
  return out;
}

export interface DailyPoint {
  data: string;
  venda: number;
  orcamento: number;
  vendaAnoAnterior: number;
  clientes: number;
}

/** Série diária somando venda/orçamento do período atual e venda no mesmo dia do ano anterior. */
export function dailySeries(currentYearFacts: FactRow[], previousYearFacts: FactRow[]): DailyPoint[] {
  const map = new Map<string, DailyPoint>();
  for (const f of currentYearFacts) {
    if (!f.data) continue;
    let p = map.get(f.data);
    if (!p) { p = { data: f.data, venda: 0, orcamento: 0, vendaAnoAnterior: 0, clientes: 0 }; map.set(f.data, p); }
    if (typeof f.venda_bruta === 'number') p.venda += f.venda_bruta;
    if (typeof f.orcamento === 'number') p.orcamento += f.orcamento;
    if (typeof f.clientes === 'number') p.clientes += f.clientes;
  }
  for (const f of previousYearFacts) {
    if (!f.data || typeof f.venda_bruta !== 'number') continue;
    const d = new Date(f.data);
    d.setUTCFullYear(d.getUTCFullYear() + 1);
    const key = d.toISOString().slice(0, 10);
    let p = map.get(key);
    if (!p) { p = { data: key, venda: 0, orcamento: 0, vendaAnoAnterior: 0, clientes: 0 }; map.set(key, p); }
    p.vendaAnoAnterior += f.venda_bruta;
  }
  return Array.from(map.values()).sort((a, b) => (a.data < b.data ? -1 : 1));
}

export function accumulate(points: DailyPoint[]): DailyPoint[] {
  let accVenda = 0, accOrc = 0, accAa = 0;
  return points.map((p) => {
    accVenda += p.venda; accOrc += p.orcamento; accAa += p.vendaAnoAnterior;
    return { data: p.data, venda: accVenda, orcamento: accOrc, vendaAnoAnterior: accAa, clientes: p.clientes };
  });
}

export function countDistinct(facts: FactRow[], field: keyof FactRow): number {
  const s = new Set<string>();
  for (const f of facts) {
    const v = f[field];
    if (v !== undefined && v !== null && v !== '') s.add(String(v));
  }
  return s.size;
}
