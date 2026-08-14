import type { FactRow, GlobalFilters } from '../types';
import { applyFilters, withDefaultPeriod } from '../query/filters';
import { sumTotals } from '../query/aggregate';
import { hasPrimarySheets, restrictToPrimary } from '../query/primary';
import { pct } from './format';

export interface Forecast {
  vendaRealizada: number;
  orcamentoPeriodo: number | null;
  diasDecorridos: number;
  diasTotais: number;
  diasRestantes: number;
  mediaDiaria: number | null;
  vendaProjetada: number | null;
  atingimentoRealizadoPct: number | null;
  atingimentoProjetadoPct: number | null;
  gapOrcamento: number | null;
  vendaDiariaNecessaria: number | null;
  status: 'sem_dados' | 'critico' | 'atencao' | 'no_alvo' | 'excelente';
  periodoInicio: string | null;
  periodoFim: string | null;
}

function daysBetween(a: string, b: string): number {
  const d1 = new Date(a).getTime();
  const d2 = new Date(b).getTime();
  return Math.round((d2 - d1) / 86400000) + 1;
}

/**
 * Forecast de fechamento (seção 7). Usa o próprio período filtrado; quando o
 * usuário não define período explícito, assume o mês do dado mais recente
 * disponível na base como "mês corrente".
 */
export function computeForecast(allFacts: FactRow[], rawFilters: GlobalFilters): Forecast {
  const filters = withDefaultPeriod(allFacts, rawFilters);
  const isDimensionalDrilldown = Boolean(filters.categoria?.length || filters.segmento?.length || filters.subcategoria?.length || filters.canal?.length);
  const filtered = applyFilters(allFacts, filters);
  const current = isDimensionalDrilldown ? filtered : restrictToPrimary(filtered, hasPrimarySheets(allFacts));
  const withDate = current.filter((f) => f.data);

  let periodoInicio = filters.periodoInicio ?? null;
  let periodoFim = filters.periodoFim ?? null;

  if (!periodoInicio || !periodoFim) {
    if (withDate.length === 0) {
      return {
        vendaRealizada: 0, orcamentoPeriodo: null, diasDecorridos: 0, diasTotais: 0, diasRestantes: 0,
        mediaDiaria: null, vendaProjetada: null, atingimentoRealizadoPct: null, atingimentoProjetadoPct: null,
        gapOrcamento: null, vendaDiariaNecessaria: null, status: 'sem_dados', periodoInicio: null, periodoFim: null,
      };
    }
    const maxData = withDate.reduce((max, f) => (f.data! > max ? f.data! : max), withDate[0].data!);
    const ref = new Date(maxData);
    const y = ref.getUTCFullYear();
    const m = ref.getUTCMonth();
    periodoInicio = periodoInicio ?? new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
    periodoFim = periodoFim ?? new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
  }

  // Restringe ao período resolvido (evitando somar meses fora do "mês corrente"
  // inferido quando o usuário não define um período explícito).
  const scoped = current.filter((f) => !f.data || (f.data >= periodoInicio! && f.data <= periodoFim!));
  const totals = sumTotals(scoped);
  const scopedWithDate = scoped.filter((f) => f.data);
  const diasTotais = daysBetween(periodoInicio, periodoFim);
  const diasComVenda = new Set(scopedWithDate.filter((f) => typeof f.venda_bruta === 'number').map((f) => f.data)).size;
  const diasDecorridos = Math.min(Math.max(diasComVenda, 0), diasTotais) || diasTotais;
  const diasRestantes = Math.max(diasTotais - diasDecorridos, 0);

  const mediaDiaria = diasDecorridos > 0 ? totals.venda_bruta / diasDecorridos : null;
  const vendaProjetada = mediaDiaria !== null ? mediaDiaria * diasTotais : null;
  const orcamentoPeriodo = totals.orcamento || null;
  const atingimentoRealizadoPct = orcamentoPeriodo ? pct(totals.venda_bruta, orcamentoPeriodo) : null;
  const atingimentoProjetadoPct = orcamentoPeriodo && vendaProjetada !== null ? pct(vendaProjetada, orcamentoPeriodo) : null;
  const gapOrcamento = orcamentoPeriodo !== null ? orcamentoPeriodo - totals.venda_bruta : null;
  const vendaDiariaNecessaria = gapOrcamento !== null && diasRestantes > 0 ? gapOrcamento / diasRestantes : null;

  let status: Forecast['status'] = 'sem_dados';
  if (atingimentoProjetadoPct !== null) {
    if (atingimentoProjetadoPct < 90) status = 'critico';
    else if (atingimentoProjetadoPct < 100) status = 'atencao';
    else if (atingimentoProjetadoPct < 105) status = 'no_alvo';
    else status = 'excelente';
  }

  return {
    vendaRealizada: totals.venda_bruta, orcamentoPeriodo, diasDecorridos, diasTotais, diasRestantes,
    mediaDiaria, vendaProjetada, atingimentoRealizadoPct, atingimentoProjetadoPct, gapOrcamento,
    vendaDiariaNecessaria, status, periodoInicio, periodoFim,
  };
}
