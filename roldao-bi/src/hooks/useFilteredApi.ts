'use client';

import { useFiltersStore, filtersToQuery } from '@/lib/store/filtersStore';
import { useApi } from './useApi';

export function useFilteredApi<T>(basePath: string, extraQuery?: Record<string, string>): { data: T | null; loading: boolean; error: string | null } {
  const filters = useFiltersStore((s) => s.filters);
  const qs = filtersToQuery(filters);
  const extra = extraQuery ? new URLSearchParams(extraQuery).toString() : '';
  const query = [qs, extra].filter(Boolean).join('&');
  const path = `${basePath}${query ? `?${query}` : ''}`;
  return useApi<T>(path);
}
