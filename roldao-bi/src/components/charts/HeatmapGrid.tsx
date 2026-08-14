'use client';

import { Fragment } from 'react';
import { formatPercent } from '@/lib/kpi/format';

export interface HeatCell {
  linha: string;
  coluna: string;
  valor: number | null; // tipicamente atingimento % ou crescimento %
  extra?: string;
}

function colorFor(v: number | null, mode: 'pct' | 'raw'): string {
  if (v === null) return 'var(--surface-2)';
  if (mode === 'pct') {
    if (v < 90) return 'rgba(240,71,91,0.85)';
    if (v < 100) return 'rgba(245,166,35,0.85)';
    if (v < 110) return 'rgba(22,199,132,0.55)';
    return 'rgba(22,199,132,0.9)';
  }
  if (v < 0) return 'rgba(240,71,91,0.75)';
  if (v < 5) return 'rgba(245,166,35,0.7)';
  return 'rgba(22,199,132,0.8)';
}

export function HeatmapGrid({ linhas, colunas, cells, mode = 'pct', formatValue }: {
  linhas: string[]; colunas: string[]; cells: HeatCell[]; mode?: 'pct' | 'raw';
  formatValue?: (v: number) => string;
}) {
  const map = new Map(cells.map((c) => [`${c.linha}|${c.coluna}`, c]));
  const fmt = formatValue ?? ((v: number) => formatPercent(v, 0));

  return (
    <div className="overflow-x-auto">
      <div className="inline-grid gap-[3px]" style={{ gridTemplateColumns: `140px repeat(${colunas.length}, minmax(30px,1fr))` }}>
        <div />
        {colunas.map((c) => (
          <div key={c} className="truncate px-1 pb-1 text-center text-[10px] font-medium text-base-muted" title={c}>{c}</div>
        ))}
        {linhas.map((l) => (
          <Fragment key={l}>
            <div className="truncate pr-2 text-xs font-medium text-base-text" title={l}>{l}</div>
            {colunas.map((c) => {
              const cell = map.get(`${l}|${c}`);
              const v = cell?.valor ?? null;
              return (
                <div
                  key={`${l}-${c}`}
                  title={`${l} · ${c}: ${v !== null ? fmt(v) : 'sem dados'}`}
                  className="aspect-square rounded-[3px] transition-transform hover:scale-110"
                  style={{ background: colorFor(v, mode) }}
                />
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
