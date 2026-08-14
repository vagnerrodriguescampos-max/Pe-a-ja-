'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GlobalFilters } from '../types';

interface FiltersState {
  filters: GlobalFilters;
  compareMode: boolean;
  compareFilters: GlobalFilters | null;
  setFilters: (f: GlobalFilters) => void;
  updateFilter: <K extends keyof GlobalFilters>(key: K, value: GlobalFilters[K]) => void;
  clearFilters: () => void;
  toggleCompareMode: () => void;
  setCompareFilters: (f: GlobalFilters | null) => void;
}

export const useFiltersStore = create<FiltersState>()(
  persist(
    (set, get) => ({
      filters: {},
      compareMode: false,
      compareFilters: null,
      setFilters: (f) => set({ filters: f }),
      updateFilter: (key, value) => set({ filters: { ...get().filters, [key]: value } }),
      clearFilters: () => set({ filters: {}, compareMode: false, compareFilters: null }),
      toggleCompareMode: () => set({ compareMode: !get().compareMode }),
      setCompareFilters: (f) => set({ compareFilters: f }),
    }),
    { name: 'roldao-bi-filters' }
  )
);

export function filtersToQuery(filters: GlobalFilters): string {
  const sp = new URLSearchParams();
  if (filters.periodoInicio) sp.set('periodoInicio', filters.periodoInicio);
  if (filters.periodoFim) sp.set('periodoFim', filters.periodoFim);
  if (filters.ano) sp.set('ano', String(filters.ano));
  if (filters.mes) sp.set('mes', String(filters.mes));
  if (filters.dia) sp.set('dia', String(filters.dia));
  (['loja', 'regional', 'empresa', 'categoria', 'segmento', 'subcategoria', 'canal'] as const).forEach((k) => {
    const v = filters[k];
    if (v && v.length) sp.set(k, v.join(','));
  });
  return sp.toString();
}
