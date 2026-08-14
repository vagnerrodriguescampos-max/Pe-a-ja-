import type { FactRow, GlobalFilters, ImportRecord } from '../types';
import { getActiveImport } from '../store/registry';
import { loadFacts } from '../store/facts';

export function getActiveContext(): { record: ImportRecord | null; facts: FactRow[] } {
  const record = getActiveImport();
  if (!record) return { record: null, facts: [] };
  return { record, facts: loadFacts(record.id) };
}

function parseList(sp: URLSearchParams, key: string): string[] | undefined {
  const values = sp.getAll(key);
  if (values.length === 0) return undefined;
  return values.flatMap((v) => v.split(',')).filter(Boolean);
}

export function parseFilters(sp: URLSearchParams): GlobalFilters {
  return {
    periodoInicio: sp.get('periodoInicio') || undefined,
    periodoFim: sp.get('periodoFim') || undefined,
    ano: sp.get('ano') ? Number(sp.get('ano')) : undefined,
    mes: sp.get('mes') ? Number(sp.get('mes')) : undefined,
    dia: sp.get('dia') ? Number(sp.get('dia')) : undefined,
    loja: parseList(sp, 'loja'),
    regional: parseList(sp, 'regional'),
    empresa: parseList(sp, 'empresa'),
    categoria: parseList(sp, 'categoria'),
    segmento: parseList(sp, 'segmento'),
    subcategoria: parseList(sp, 'subcategoria'),
    canal: parseList(sp, 'canal'),
  };
}
