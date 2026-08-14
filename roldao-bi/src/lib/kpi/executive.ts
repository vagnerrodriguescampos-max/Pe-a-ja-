import type { FactRow, GlobalFilters, Indicator } from '../types';
import { applyFilters, shiftYearFilters, withDefaultPeriod } from '../query/filters';
import { aggregateByDim, countDistinct, sumTotals } from '../query/aggregate';
import { hasPrimarySheets, restrictToPrimary } from '../query/primary';
import { growth, pct } from './format';
import { computeForecast } from './forecast';

function ind(value: number | null, source: Indicator['source'], label: string, formula?: string): Indicator {
  return { value, source, label, formula };
}

export interface ExecutiveKpis {
  vendaBruta: Indicator;
  vendaLiquida: Indicator;
  orcamento: Indicator;
  atingimentoPct: Indicator;
  vendaAnoAnterior: Indicator;
  crescimentoPct: Indicator;
  diferencaAnoAnteriorRS: Indicator;
  margemBruta: Indicator;
  margemPct: Indicator;
  diferencaMargemVsAnoAnterior: Indicator;
  vendaAcumulada: Indicator;
  orcamentoAcumulado: Indicator;
  atingimentoAcumuladoPct: Indicator;
  vendaMediaDia: Indicator;
  vendaProjetadaMes: Indicator;
  qtdLojas: Indicator;
  lojasAcimaOrcamento: Indicator;
  lojasAbaixoOrcamento: Indicator;
  diasComDados: number;
}

/**
 * Convenção de `source` nos indicadores:
 *  - 'planilha'   -> soma direta de uma métrica que existe literalmente na base
 *                    (nenhuma fórmula além de somatório dos valores filtrados).
 *  - 'calculado'  -> resultado de uma fórmula do BI (razão, diferença, projeção).
 *  - 'indisponivel' -> a base filtrada não contém a métrica de origem; o BI
 *                    nunca preenche esse caso com valor estimado/fictício.
 */
export function computeExecutiveKpis(allFacts: FactRow[], rawFilters: GlobalFilters): ExecutiveKpis {
  const filters = withDefaultPeriod(allFacts, rawFilters);
  const current = applyFilters(allFacts, filters);
  const previous = applyFilters(allFacts, shiftYearFilters(filters, -1));

  // Venda/orçamento agregados de "empresa" usam só as abas primárias (loja x
  // dia), para não somar a mesma venda várias vezes através de recortes
  // diferentes (por segmento, subcategoria, canal, resumo mensal etc.) — ver
  // lib/query/primary.ts. Quando o filtro atual já restringe a uma categoria/
  // segmento/subcategoria/canal específico, usamos a base completa filtrada,
  // pois nesse caso é exatamente a aba daquele recorte que responde.
  const isDimensionalDrilldown = Boolean(filters.categoria?.length || filters.segmento?.length || filters.subcategoria?.length || filters.canal?.length);
  const usesPrimary = hasPrimarySheets(allFacts);
  const currentPrimary = isDimensionalDrilldown ? current : restrictToPrimary(current, usesPrimary);
  const previousPrimary = isDimensionalDrilldown ? previous : restrictToPrimary(previous, usesPrimary);

  const tCur = sumTotals(currentPrimary);
  const tPrev = sumTotals(previousPrimary);

  const vendaBruta = ind(tCur.venda_bruta, 'planilha', 'Venda Bruta');
  const vendaLiquida = tCur.temVendaLiquida
    ? ind(tCur.venda_liquida, 'planilha', 'Venda Líquida')
    : ind(null, 'indisponivel', 'Venda Líquida');
  const orcamento = ind(tCur.orcamento || null, tCur.orcamento ? 'planilha' : 'indisponivel', 'Orçamento');
  const atingimentoPct = ind(
    tCur.orcamento ? pct(tCur.venda_bruta, tCur.orcamento) : null,
    tCur.orcamento ? 'calculado' : 'indisponivel',
    'Atingimento do Orçamento', 'Venda / Orçamento'
  );

  const temAnoAnterior = previousPrimary.length > 0;
  const vendaAnoAnterior = temAnoAnterior
    ? ind(tPrev.venda_bruta, 'planilha', 'Venda Ano Anterior')
    : ind(null, 'indisponivel', 'Venda Ano Anterior');
  const crescimentoPct = ind(
    temAnoAnterior ? growth(tCur.venda_bruta, tPrev.venda_bruta) : null,
    temAnoAnterior ? 'calculado' : 'indisponivel',
    'Crescimento vs Ano Anterior', '(Venda Atual - Venda Anterior) / Venda Anterior'
  );
  const diferencaAnoAnteriorRS = ind(
    temAnoAnterior ? tCur.venda_bruta - tPrev.venda_bruta : null,
    temAnoAnterior ? 'calculado' : 'indisponivel',
    'Diferença vs Ano Anterior', 'Venda Atual - Venda Anterior'
  );

  const margemBruta = tCur.temMargem ? ind(tCur.margem, 'planilha', 'Margem Bruta') : ind(null, 'indisponivel', 'Margem Bruta');
  const margemPct = tCur.temMargem
    ? ind(pct(tCur.margem, tCur.venda_bruta), 'calculado', 'Margem %', 'Margem / Venda')
    : ind(null, 'indisponivel', 'Margem %');
  const margemPctPrev = tPrev.temMargem ? pct(tPrev.margem, tPrev.venda_bruta) : null;
  const diferencaMargemVsAnoAnterior = (tCur.temMargem && margemPctPrev !== null && margemPct.value !== null)
    ? ind(margemPct.value - margemPctPrev, 'calculado', 'Diferença de Margem vs Ano Anterior')
    : ind(null, 'indisponivel', 'Diferença de Margem vs Ano Anterior');

  const acumuladoFacts = current.filter((f) => f.sheetRole === 'BASE_VENDA_ACUMULADO');
  const tAcum = acumuladoFacts.length ? sumTotals(acumuladoFacts) : tCur;
  const vendaAcumulada = ind(tAcum.venda_bruta, 'planilha', 'Venda Acumulada');
  const orcamentoAcumulado = ind(tAcum.orcamento || tCur.orcamento || null, (tAcum.orcamento || tCur.orcamento) ? 'planilha' : 'indisponivel', 'Orçamento Acumulado');
  const atingimentoAcumuladoPct = ind(
    orcamentoAcumulado.value ? pct(tAcum.venda_bruta, orcamentoAcumulado.value) : null,
    orcamentoAcumulado.value ? 'calculado' : 'indisponivel',
    'Atingimento Acumulado', 'Venda Acumulada / Orçamento Acumulado'
  );

  const diasComDados = countDistinctDates(currentPrimary);
  const vendaMediaDia = ind(
    diasComDados ? tCur.venda_bruta / diasComDados : null,
    diasComDados ? 'calculado' : 'indisponivel',
    'Venda Média por Dia', 'Venda / Dias com venda'
  );

  const forecast = computeForecast(allFacts, filters);
  const vendaProjetadaMes = ind(forecast.vendaProjetada, forecast.vendaProjetada !== null ? 'calculado' : 'indisponivel', 'Venda Projetada', 'Média diária × dias do período');

  const qtdLojas = ind(countDistinct(current, 'loja_codigo'), 'calculado', 'Quantidade de Lojas');

  const porLoja = aggregateByDim(currentPrimary, 'loja_codigo', 'loja_nome');
  const comOrcamento = porLoja.filter((l) => l.orcamento > 0);
  const acima = comOrcamento.filter((l) => l.venda_bruta >= l.orcamento).length;
  const abaixo = comOrcamento.filter((l) => l.venda_bruta < l.orcamento).length;
  const lojasAcimaOrcamento = ind(comOrcamento.length ? acima : null, comOrcamento.length ? 'calculado' : 'indisponivel', 'Lojas Acima do Orçamento');
  const lojasAbaixoOrcamento = ind(comOrcamento.length ? abaixo : null, comOrcamento.length ? 'calculado' : 'indisponivel', 'Lojas Abaixo do Orçamento');

  return {
    vendaBruta, vendaLiquida, orcamento, atingimentoPct, vendaAnoAnterior, crescimentoPct,
    diferencaAnoAnteriorRS, margemBruta, margemPct, diferencaMargemVsAnoAnterior, vendaAcumulada,
    orcamentoAcumulado, atingimentoAcumuladoPct, vendaMediaDia, vendaProjetadaMes, qtdLojas,
    lojasAcimaOrcamento, lojasAbaixoOrcamento, diasComDados,
  };
}

function countDistinctDates(facts: FactRow[]): number {
  const s = new Set<string>();
  for (const f of facts) if (f.data) s.add(f.data);
  return s.size;
}
