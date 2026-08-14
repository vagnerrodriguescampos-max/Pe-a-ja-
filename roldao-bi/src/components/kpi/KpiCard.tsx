'use client';

import { ArrowDownRight, ArrowUpRight, Info, Minus } from 'lucide-react';
import clsx from 'clsx';
import { Card } from '../ui/Card';

export type Trend = 'up' | 'down' | 'flat' | null;

export interface KpiCardProps {
  title: string;
  value: string;
  trend?: Trend;
  trendGoodWhenUp?: boolean; // false para métricas onde "cair" é bom (ex.: gap negativo diminuindo)
  variacaoLabel?: string | null; // ex.: "8,7%"
  comparativoLabel?: string | null; // ex.: "+ R$ 10,3 Mi vs ano anterior"
  tooltip?: string;
  source?: 'planilha' | 'calculado' | 'indisponivel';
  onClick?: () => void;
  emphasis?: boolean;
}

const SOURCE_LABEL: Record<NonNullable<KpiCardProps['source']>, string> = {
  planilha: 'Dado da fonte',
  calculado: 'Indicador calculado pelo BI',
  indisponivel: 'Indisponível nesta base',
};

export function KpiCard({
  title, value, trend = null, trendGoodWhenUp = true, variacaoLabel, comparativoLabel,
  tooltip, source, onClick, emphasis,
}: KpiCardProps) {
  const isGood = trend === null ? null : trendGoodWhenUp ? trend === 'up' : trend === 'down';

  return (
    <Card
      onClick={onClick}
      className={clsx(
        'group relative animate-fade-in overflow-hidden px-5 py-4 transition-transform',
        onClick && 'cursor-pointer hover:-translate-y-0.5 hover:shadow-glow',
        emphasis && 'ring-1 ring-brand-500/40'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-base-muted">{title}</p>
        {tooltip && (
          <span className="relative shrink-0 text-base-muted/70">
            <Info size={13} />
            <span className="pointer-events-none absolute right-0 top-5 z-20 hidden w-56 rounded-lg border border-base-border bg-base-surface p-2.5 text-[11px] leading-snug text-base-muted shadow-card group-hover:block">
              {tooltip}
              {source && <span className="mt-1.5 block font-medium text-base-text/80">{SOURCE_LABEL[source]}</span>}
            </span>
          </span>
        )}
      </div>

      <p className="mt-1.5 text-2xl font-bold tabular-nums text-base-text">{value}</p>

      {(variacaoLabel || comparativoLabel) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {variacaoLabel && (
            <span
              className={clsx(
                'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-semibold',
                isGood === true && 'bg-good/10 text-good',
                isGood === false && 'bg-bad/10 text-bad',
                isGood === null && 'bg-base-surface2 text-base-muted'
              )}
            >
              {trend === 'up' && <ArrowUpRight size={13} />}
              {trend === 'down' && <ArrowDownRight size={13} />}
              {trend === 'flat' && <Minus size={13} />}
              {variacaoLabel}
            </span>
          )}
          {comparativoLabel && <span className="text-xs text-base-muted">{comparativoLabel}</span>}
        </div>
      )}
    </Card>
  );
}
