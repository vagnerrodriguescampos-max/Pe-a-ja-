import type { DimensionOptions, FactRow, GlobalFilters } from '../types';

function matchesArray(value: string | undefined, list?: string[]): boolean {
  if (!list || list.length === 0) return true;
  if (!value) return false;
  return list.includes(value);
}

export function applyFilters(facts: FactRow[], filters: GlobalFilters): FactRow[] {
  return facts.filter((f) => {
    if (filters.periodoInicio && f.data && f.data < filters.periodoInicio) return false;
    if (filters.periodoFim && f.data && f.data > filters.periodoFim) return false;
    if (filters.ano && f.ano !== filters.ano) return false;
    if (filters.mes && f.mes !== filters.mes) return false;
    if (filters.dia && f.dia !== filters.dia) return false;
    if (!matchesArray(f.loja_codigo, filters.loja) && !matchesArray(f.loja_nome, filters.loja)) return false;
    if (!matchesArray(f.regional, filters.regional)) return false;
    if (!matchesArray(f.empresa, filters.empresa)) return false;
    if (!matchesArray(f.categoria, filters.categoria)) return false;
    if (!matchesArray(f.segmento, filters.segmento)) return false;
    if (!matchesArray(f.subcategoria, filters.subcategoria)) return false;
    if (!matchesArray(f.canal, filters.canal)) return false;
    return true;
  });
}

/** Mesmo filtro, mas deslocando o ano em `deltaAnos` (para comparativos vs. ano anterior). */
export function shiftYearFilters(filters: GlobalFilters, deltaAnos: number): GlobalFilters {
  const shift = (iso?: string) => {
    if (!iso) return iso;
    const d = new Date(iso);
    d.setUTCFullYear(d.getUTCFullYear() + deltaAnos);
    return d.toISOString().slice(0, 10);
  };
  return {
    ...filters,
    periodoInicio: shift(filters.periodoInicio),
    periodoFim: shift(filters.periodoFim),
    ano: filters.ano ? filters.ano + deltaAnos : undefined,
  };
}

/**
 * Sem nenhum filtro de período, "venda atual" e "venda ano anterior" não
 * podem ser calculados sobre a base inteira (misturaria todos os anos numa
 * soma só). Por padrão, o BI assume como período corrente o ano mais recente
 * disponível na base — o usuário pode sempre trocar pelos filtros de Ano/Mês
 * ou por um período customizado.
 */
export function withDefaultPeriod(facts: FactRow[], filters: GlobalFilters): GlobalFilters {
  if (filters.periodoInicio || filters.periodoFim || filters.ano) return filters;
  let maxAno = 0;
  for (const f of facts) if (f.ano && f.ano > maxAno) maxAno = f.ano;
  return maxAno ? { ...filters, ano: maxAno } : filters;
}

export function buildDimensionOptions(facts: FactRow[]): DimensionOptions {
  const empresas = new Set<string>();
  const regionais = new Set<string>();
  const lojasMap = new Map<string, { codigo: string; nome: string; regional: string | null; empresa: string | null }>();
  const categorias = new Set<string>();
  const segmentos = new Set<string>();
  const subcategorias = new Set<string>();
  const canais = new Set<string>();
  const anos = new Set<number>();
  let periodoMin: string | null = null;
  let periodoMax: string | null = null;

  for (const f of facts) {
    if (f.empresa) empresas.add(f.empresa);
    if (f.regional) regionais.add(f.regional);
    if (f.categoria) categorias.add(f.categoria);
    if (f.segmento) segmentos.add(f.segmento);
    if (f.subcategoria) subcategorias.add(f.subcategoria);
    if (f.canal) canais.add(f.canal);
    if (f.ano) anos.add(f.ano);
    if (f.data) {
      if (!periodoMin || f.data < periodoMin) periodoMin = f.data;
      if (!periodoMax || f.data > periodoMax) periodoMax = f.data;
    }
    if (f.loja_codigo) {
      const existing = lojasMap.get(f.loja_codigo);
      if (!existing) {
        lojasMap.set(f.loja_codigo, {
          codigo: f.loja_codigo,
          nome: f.loja_nome || f.loja_codigo,
          regional: f.regional || null,
          empresa: f.empresa || null,
        });
      } else {
        if (!existing.nome || existing.nome === existing.codigo) existing.nome = f.loja_nome || existing.nome;
        if (!existing.regional) existing.regional = f.regional || null;
        if (!existing.empresa) existing.empresa = f.empresa || null;
      }
    }
  }

  return {
    empresas: Array.from(empresas).sort(),
    regionais: Array.from(regionais).sort(),
    lojas: Array.from(lojasMap.values()).sort((a, b) => a.nome.localeCompare(b.nome)),
    categorias: Array.from(categorias).sort(),
    segmentos: Array.from(segmentos).sort(),
    subcategorias: Array.from(subcategorias).sort(),
    canais: Array.from(canais).sort(),
    anos: Array.from(anos).sort((a, b) => b - a),
    periodoMin,
    periodoMax,
  };
}
