import type { FactRow, GlobalFilters } from '../types';
import { applyFilters, shiftYearFilters, withDefaultPeriod } from '../query/filters';
import { aggregateByDim, sumTotals } from '../query/aggregate';
import { hasPrimarySheets, restrictToPrimary } from '../query/primary';
import { computeExecutiveKpis } from './executive';
import { formatCompactBRL, formatPercent, growth, pct } from './format';
import type { BiConfig } from '../store/config';

export type AlertSeverity = 'critico' | 'atencao' | 'sucesso' | 'info';

export interface Alert {
  id: string;
  severity: AlertSeverity;
  icon: string;
  title: string;
  text: string;
  escopo: string;
}

function lojaGrowthMap(current: FactRow[], previous: FactRow[]) {
  const cur = aggregateByDim(current, 'loja_codigo', 'loja_nome');
  const prevMap = new Map(aggregateByDim(previous, 'loja_codigo', 'loja_nome').map((d) => [d.chave, d]));
  return cur.map((l) => {
    const prev = prevMap.get(l.chave);
    return {
      ...l,
      vendaAnoAnterior: prev?.venda_bruta ?? null,
      crescimento: prev?.venda_bruta ? growth(l.venda_bruta, prev.venda_bruta) : null,
      atingimento: l.orcamento ? pct(l.venda_bruta, l.orcamento) : null,
      gap: l.orcamento ? l.venda_bruta - l.orcamento : null,
    };
  });
}

export function generateAlerts(allFacts: FactRow[], rawFilters: GlobalFilters, cfg: BiConfig): Alert[] {
  const filters = withDefaultPeriod(allFacts, rawFilters);
  const current = applyFilters(allFacts, filters);
  const previous = applyFilters(allFacts, shiftYearFilters(filters, -1));
  const usesPrimary = hasPrimarySheets(allFacts);
  const currentPrimary = restrictToPrimary(current, usesPrimary);
  const previousPrimary = restrictToPrimary(previous, usesPrimary);
  const alerts: Alert[] = [];
  const kpis = computeExecutiveKpis(allFacts, filters);

  if (kpis.atingimentoPct.value !== null && kpis.atingimentoPct.value < cfg.atingimentoCritico) {
    alerts.push({
      id: 'venda-abaixo-orcamento', severity: 'critico', icon: '🔴', escopo: 'Empresa',
      title: 'Venda abaixo do orçamento',
      text: `A venda está em ${formatPercent(kpis.atingimentoPct.value)} do orçamento, abaixo do limite crítico de ${cfg.atingimentoCritico}%.`,
    });
  } else if (kpis.atingimentoPct.value !== null && kpis.atingimentoPct.value < cfg.atingimentoAtencao) {
    alerts.push({
      id: 'atingimento-proximo-limite', severity: 'atencao', icon: '🟡', escopo: 'Empresa',
      title: 'Atingimento próximo do limite',
      text: `Atingimento do orçamento em ${formatPercent(kpis.atingimentoPct.value)} — próximo do ponto de atenção.`,
    });
  }

  if (kpis.crescimentoPct.value !== null && kpis.crescimentoPct.value < 0) {
    alerts.push({
      id: 'queda-ano-anterior', severity: 'critico', icon: '🔴', escopo: 'Empresa',
      title: 'Queda vs ano anterior',
      text: `A venda caiu ${formatPercent(Math.abs(kpis.crescimentoPct.value))} em relação ao mesmo período do ano anterior.`,
    });
  } else if (kpis.crescimentoPct.value !== null && kpis.crescimentoPct.value >= cfg.crescimentoRelevante) {
    alerts.push({
      id: 'crescimento-acima-media', severity: 'sucesso', icon: '🟢', escopo: 'Empresa',
      title: 'Crescimento acima da média',
      text: `Crescimento de ${formatPercent(kpis.crescimentoPct.value)} vs ano anterior — acima do patamar considerado relevante (${cfg.crescimentoRelevante}%).`,
    });
  }

  if (kpis.margemPct.value !== null && kpis.margemPct.value < cfg.margemReferencia) {
    alerts.push({
      id: 'margem-abaixo-referencia', severity: 'critico', icon: '🔴', escopo: 'Empresa',
      title: 'Margem abaixo da referência',
      text: `Margem de ${formatPercent(kpis.margemPct.value)}, abaixo da referência de ${cfg.margemReferencia}%.`,
    });
  }

  // regionais abaixo do orçamento
  const regionais = aggregateByDim(currentPrimary, 'regional');
  for (const r of regionais.filter((r) => r.orcamento > 0)) {
    const atingimento = pct(r.venda_bruta, r.orcamento);
    if (atingimento !== null && atingimento < cfg.atingimentoCritico) {
      alerts.push({
        id: `regional-abaixo-${r.chave}`, severity: 'critico', icon: '🔴', escopo: `Regional ${r.nome}`,
        title: 'Regional abaixo do orçamento',
        text: `Regional ${r.nome} está ${formatPercent(100 - atingimento)} abaixo do orçamento.`,
      });
    }
  }

  // lojas: quedas, crescimentos e recordes
  const lojas = lojaGrowthMap(currentPrimary, previousPrimary);
  const quedas = lojas.filter((l) => l.crescimento !== null && (l.crescimento as number) <= cfg.quedaRelevante)
    .sort((a, b) => (a.crescimento as number) - (b.crescimento as number));
  for (const l of quedas.slice(0, 3)) {
    alerts.push({
      id: `loja-queda-${l.chave}`, severity: 'critico', icon: '🔴', escopo: `Loja ${l.nome}`,
      title: 'Queda relevante vs ano anterior',
      text: `Loja ${l.nome} apresentou queda de ${formatPercent(Math.abs(l.crescimento as number))} vs ano anterior.`,
    });
  }
  const crescimentos = lojas.filter((l) => l.crescimento !== null && (l.crescimento as number) >= cfg.crescimentoRelevante)
    .sort((a, b) => (b.crescimento as number) - (a.crescimento as number));
  for (const l of crescimentos.slice(0, 3)) {
    alerts.push({
      id: `loja-crescimento-${l.chave}`, severity: 'sucesso', icon: '🟢', escopo: `Loja ${l.nome}`,
      title: 'Loja com crescimento relevante',
      text: `Loja ${l.nome} apresenta crescimento de ${formatPercent(l.crescimento as number)} vs ano anterior.`,
    });
  }

  const piores = lojas.filter((l) => l.gap !== null).sort((a, b) => (a.gap as number) - (b.gap as number));
  if (piores.length && (piores[0].gap as number) < 0) {
    const l = piores[0];
    alerts.push({
      id: `loja-maior-gap-${l.chave}`, severity: 'critico', icon: '🔴', escopo: `Loja ${l.nome}`,
      title: 'Maior gap negativo de orçamento',
      text: `Loja ${l.nome} possui o maior gap negativo para o orçamento: ${formatCompactBRL(l.gap as number)}.`,
    });
  }

  // piso
  const pisoFacts = current.filter((f) => f.sheetRole === 'PISO' && typeof f.piso === 'number');
  const pisoPorLoja = aggregateByDim(pisoFacts, 'loja_codigo', 'loja_nome');
  for (const l of pisoPorLoja) {
    if (l.piso > 0 && l.venda_bruta < l.piso) {
      alerts.push({
        id: `loja-abaixo-piso-${l.chave}`, severity: 'critico', icon: '🔴', escopo: `Loja ${l.nome}`,
        title: 'LOJA ABAIXO DO PISO',
        text: `Loja ${l.nome}: venda de ${formatCompactBRL(l.venda_bruta)} está abaixo do piso de ${formatCompactBRL(l.piso)}.`,
      });
    }
  }

  const sevOrder: Record<AlertSeverity, number> = { critico: 0, atencao: 1, sucesso: 2, info: 3 };
  return alerts.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);
}

/** Frases automáticas para a Central de Oportunidades (seção 18) e o Resumo Executivo (seção 29). */
export function generateOpportunities(allFacts: FactRow[], rawFilters: GlobalFilters, cfg: BiConfig): string[] {
  const filters = withDefaultPeriod(allFacts, rawFilters);
  const current = applyFilters(allFacts, filters);
  const previous = applyFilters(allFacts, shiftYearFilters(filters, -1));
  const usesPrimary = hasPrimarySheets(allFacts);
  const currentPrimary = restrictToPrimary(current, usesPrimary);
  const previousPrimary = restrictToPrimary(previous, usesPrimary);
  const phrases: string[] = [];

  const regionais = aggregateByDim(currentPrimary, 'regional').filter((r) => r.orcamento > 0);
  for (const r of regionais) {
    const atingimento = pct(r.venda_bruta, r.orcamento);
    if (atingimento !== null && atingimento < 100) {
      phrases.push(`Regional ${r.nome} está ${formatPercent(100 - atingimento)} abaixo do orçamento.`);
    }
  }

  const lojas = lojaGrowthMap(currentPrimary, previousPrimary);
  const melhorCrescimento = lojas.filter((l) => l.crescimento !== null).sort((a, b) => (b.crescimento as number) - (a.crescimento as number))[0];
  if (melhorCrescimento) phrases.push(`Loja ${melhorCrescimento.nome} apresenta crescimento de ${formatPercent(melhorCrescimento.crescimento as number)} vs ano anterior.`);

  const totalVenda = sumTotals(current).venda_bruta;
  const categorias = aggregateByDim(current, 'categoria');
  const topCategoria = categorias.sort((a, b) => b.venda_bruta - a.venda_bruta)[0];
  if (topCategoria && totalVenda > 0) {
    phrases.push(`Categoria ${topCategoria.nome} representa ${formatPercent(pct(topCategoria.venda_bruta, totalVenda) ?? 0)} da venda total.`);
  }

  const subcategorias = aggregateByDim(current, 'subcategoria');
  const prevSub = new Map(aggregateByDim(previous, 'subcategoria').map((d) => [d.chave, d]));
  const quedaSub = subcategorias
    .map((s) => ({ ...s, crescimento: prevSub.get(s.chave)?.venda_bruta ? growth(s.venda_bruta, prevSub.get(s.chave)!.venda_bruta) : null }))
    .filter((s) => s.crescimento !== null)
    .sort((a, b) => (a.crescimento as number) - (b.crescimento as number))[0];
  if (quedaSub && (quedaSub.crescimento as number) < 0) {
    phrases.push(`Subcategoria ${quedaSub.nome} apresentou queda de ${formatPercent(Math.abs(quedaSub.crescimento as number))}.`);
  }

  const piores = lojas.filter((l) => l.gap !== null).sort((a, b) => (a.gap as number) - (b.gap as number))[0];
  if (piores && (piores.gap as number) < 0) {
    phrases.push(`Loja ${piores.nome} possui o maior gap negativo para orçamento.`);
  }

  return phrases;
}

/** Texto corrido do Resumo Executivo (seção 29) — muda conforme os filtros aplicados. */
export function generateExecutiveSummary(allFacts: FactRow[], rawFilters: GlobalFilters, cfg: BiConfig): string {
  const kpis = computeExecutiveKpis(allFacts, rawFilters);
  const filters = withDefaultPeriod(allFacts, rawFilters);
  const current = restrictToPrimary(applyFilters(allFacts, filters), hasPrimarySheets(allFacts));
  const regionais = aggregateByDim(current, 'regional').filter((r) => r.orcamento > 0);
  const porAtingimento = regionais
    .map((r) => ({ ...r, atingimento: pct(r.venda_bruta, r.orcamento) }))
    .filter((r) => r.atingimento !== null)
    .sort((a, b) => (b.atingimento as number) - (a.atingimento as number));

  const partes: string[] = [];
  if (kpis.crescimentoPct.value !== null) {
    partes.push(`Na análise selecionada, a empresa apresenta ${kpis.crescimentoPct.value >= 0 ? 'crescimento' : 'queda'} de ${formatPercent(Math.abs(kpis.crescimentoPct.value))} em relação ao mesmo período do ano anterior.`);
  } else {
    partes.push('Na análise selecionada não há dados do ano anterior para comparação de crescimento.');
  }
  if (kpis.atingimentoPct.value !== null) {
    partes.push(`O atingimento do orçamento está em ${formatPercent(kpis.atingimentoPct.value)}.`);
  }
  if (porAtingimento.length >= 2) {
    const melhor = porAtingimento[0];
    const pior = porAtingimento[porAtingimento.length - 1];
    partes.push(`A Regional ${melhor.nome} apresenta o melhor desempenho, enquanto a Regional ${pior.nome} concentra o maior gap negativo.`);
  } else if (porAtingimento.length === 1) {
    partes.push(`A Regional ${porAtingimento[0].nome} é a única com orçamento disponível para comparação no filtro atual.`);
  }
  if (kpis.margemPct.value !== null) {
    partes.push(`A margem está em ${formatPercent(kpis.margemPct.value)}.`);
  }
  return partes.join(' ');
}
