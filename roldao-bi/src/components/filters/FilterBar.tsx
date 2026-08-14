'use client';

import { useFiltersStore, filtersToQuery } from '@/lib/store/filtersStore';
import { useApi } from '@/hooks/useApi';
import { MultiSelect } from './MultiSelect';
import type { DimensionOptions } from '@/lib/types';
import { GitCompare, RotateCcw } from 'lucide-react';
import clsx from 'clsx';

const MESES = [
  '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function FilterBar() {
  const { filters, updateFilter, clearFilters, compareMode, toggleCompareMode } = useFiltersStore();
  const qs = filtersToQuery(filters);
  const { data } = useApi<{ options: DimensionOptions }>(`/api/meta${qs ? `?${qs}` : ''}`);
  const options = data?.options;

  const hasActiveFilters = Object.values(filters).some((v) => (Array.isArray(v) ? v.length : v));

  return (
    <div className="sticky top-[73px] z-20 border-b border-base-border bg-base-surface/95 px-4 py-3 backdrop-blur lg:px-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-base-muted">Período inicial</label>
          <input
            type="date" value={filters.periodoInicio ?? ''}
            min={options?.periodoMin ?? undefined} max={options?.periodoMax ?? undefined}
            onChange={(e) => updateFilter('periodoInicio', e.target.value || undefined)}
            className="rounded-lg border border-base-border bg-base-surface px-2.5 py-1.5 text-xs text-base-text outline-none focus:border-brand-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-base-muted">Período final</label>
          <input
            type="date" value={filters.periodoFim ?? ''}
            min={options?.periodoMin ?? undefined} max={options?.periodoMax ?? undefined}
            onChange={(e) => updateFilter('periodoFim', e.target.value || undefined)}
            className="rounded-lg border border-base-border bg-base-surface px-2.5 py-1.5 text-xs text-base-text outline-none focus:border-brand-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-base-muted">Ano</label>
          <select
            value={filters.ano ?? ''}
            onChange={(e) => updateFilter('ano', e.target.value ? Number(e.target.value) : undefined)}
            className="rounded-lg border border-base-border bg-base-surface px-2.5 py-1.5 text-xs text-base-text outline-none focus:border-brand-500"
          >
            <option value="">Todos</option>
            {options?.anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-base-muted">Mês</label>
          <select
            value={filters.mes ?? ''}
            onChange={(e) => updateFilter('mes', e.target.value ? Number(e.target.value) : undefined)}
            className="rounded-lg border border-base-border bg-base-surface px-2.5 py-1.5 text-xs text-base-text outline-none focus:border-brand-500"
          >
            <option value="">Todos</option>
            {MESES.slice(1).map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-base-muted">Dia</label>
          <input
            type="number" min={1} max={31} value={filters.dia ?? ''}
            onChange={(e) => updateFilter('dia', e.target.value ? Number(e.target.value) : undefined)}
            className="w-16 rounded-lg border border-base-border bg-base-surface px-2.5 py-1.5 text-xs text-base-text outline-none focus:border-brand-500"
          />
        </div>

        <MultiSelect label="Empresa" options={(options?.empresas ?? []).map((v) => ({ value: v, label: v }))} selected={filters.empresa ?? []} onChange={(v) => updateFilter('empresa', v.length ? v : undefined)} />
        <MultiSelect label="Regional" options={(options?.regionais ?? []).map((v) => ({ value: v, label: v }))} selected={filters.regional ?? []} onChange={(v) => updateFilter('regional', v.length ? v : undefined)} />
        <MultiSelect label="Loja" options={(options?.lojas ?? []).map((l) => ({ value: l.codigo, label: l.nome }))} selected={filters.loja ?? []} onChange={(v) => updateFilter('loja', v.length ? v : undefined)} />
        <MultiSelect label="Categoria" options={(options?.categorias ?? []).map((v) => ({ value: v, label: v }))} selected={filters.categoria ?? []} onChange={(v) => updateFilter('categoria', v.length ? v : undefined)} />
        <MultiSelect label="Segmento" options={(options?.segmentos ?? []).map((v) => ({ value: v, label: v }))} selected={filters.segmento ?? []} onChange={(v) => updateFilter('segmento', v.length ? v : undefined)} />
        <MultiSelect label="Subcategoria" options={(options?.subcategorias ?? []).map((v) => ({ value: v, label: v }))} selected={filters.subcategoria ?? []} onChange={(v) => updateFilter('subcategoria', v.length ? v : undefined)} />
        <MultiSelect label="Canal" options={(options?.canais ?? []).map((v) => ({ value: v, label: v }))} selected={filters.canal ?? []} onChange={(v) => updateFilter('canal', v.length ? v : undefined)} />

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={toggleCompareMode}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
              compareMode ? 'border-brand-500 bg-brand-600/15 text-brand-400' : 'border-base-border text-base-muted hover:bg-base-surface2'
            )}
          >
            <GitCompare size={14} /> Comparar períodos
          </button>
          <button
            onClick={clearFilters}
            disabled={!hasActiveFilters}
            className="inline-flex items-center gap-1.5 rounded-lg border border-base-border px-3 py-1.5 text-xs font-semibold text-base-muted hover:bg-base-surface2 disabled:opacity-40"
          >
            <RotateCcw size={14} /> Limpar filtros
          </button>
        </div>
      </div>
    </div>
  );
}
