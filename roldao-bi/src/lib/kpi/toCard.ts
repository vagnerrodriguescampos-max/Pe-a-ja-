import type { Indicator } from '../types';
import { formatCompactBRL, formatPercent } from './format';
import type { KpiCardProps, Trend } from '@/components/kpi/KpiCard';

export function moneyCard(title: string, indicator: Indicator, opts?: { tooltip?: string }): Pick<KpiCardProps, 'title' | 'value' | 'tooltip' | 'source'> {
  return {
    title,
    value: indicator.value !== null ? formatCompactBRL(indicator.value) : 'Sem dados',
    tooltip: opts?.tooltip ?? indicator.formula,
    source: indicator.source,
  };
}

export function pctCard(title: string, indicator: Indicator, opts?: { tooltip?: string }): Pick<KpiCardProps, 'title' | 'value' | 'tooltip' | 'source'> {
  return {
    title,
    value: indicator.value !== null ? formatPercent(indicator.value) : 'Sem dados',
    tooltip: opts?.tooltip ?? indicator.formula,
    source: indicator.source,
  };
}

export function trendFromValue(value: number | null, epsilon = 0.05): Trend {
  if (value === null) return null;
  if (value > epsilon) return 'up';
  if (value < -epsilon) return 'down';
  return 'flat';
}
