import { randomUUID as uuid } from 'node:crypto';
import type { FactRow, ImportRecord } from '../types';
import { parseWorkbook } from './parseWorkbook';
import { saveFacts, saveRawPreview } from '../store/facts';
import { upsertImport, setActiveImport } from '../store/registry';

export interface RunImportOptions {
  fileName: string;
  fileSizeBytes: number;
  buffer: Buffer;
  importedBy: string;
  activate: boolean;
}

export function runImport(opts: RunImportOptions): ImportRecord {
  const importId = uuid();
  const importedAt = new Date().toISOString();

  let facts: FactRow[] = [];
  let sheets: ImportRecord['sheets'] = [];
  let status: ImportRecord['status'] = 'concluida';
  let errorMessage: string | undefined;

  try {
    const result = parseWorkbook(opts.buffer, importId);
    facts = result.facts;
    sheets = result.sheets;
    const anyUnmapped = sheets.some((s) => s.unmappedColumns.length > 0);
    const anyErrors = sheets.some((s) => s.errorRows > 0);
    status = anyUnmapped || anyErrors ? 'concluida_com_avisos' : 'concluida';
  } catch (err) {
    status = 'erro';
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  const lojas = new Set<string>();
  const regionais = new Set<string>();
  const categorias = new Set<string>();
  const segmentos = new Set<string>();
  const subcategorias = new Set<string>();
  let periodoInicio: string | null = null;
  let periodoFim: string | null = null;
  let validRecords = 0;

  for (const f of facts) {
    if (f.loja_codigo) lojas.add(f.loja_codigo);
    if (f.regional) regionais.add(f.regional);
    if (f.categoria) categorias.add(f.categoria);
    if (f.segmento) segmentos.add(f.segmento);
    if (f.subcategoria) subcategorias.add(f.subcategoria);
    if (f.data) {
      if (!periodoInicio || f.data < periodoInicio) periodoInicio = f.data;
      if (!periodoFim || f.data > periodoFim) periodoFim = f.data;
    }
    const hasMetric = f.venda_bruta !== undefined || f.orcamento !== undefined || f.venda_liquida !== undefined
      || f.margem !== undefined || f.clientes !== undefined || f.piso !== undefined;
    if (hasMetric) validRecords++;
  }

  const record: ImportRecord = {
    id: importId,
    fileName: opts.fileName,
    fileSizeBytes: opts.fileSizeBytes,
    importedAt,
    importedBy: opts.importedBy,
    status,
    sheets,
    totalRecords: facts.length,
    validRecords,
    errorRecords: facts.length - validRecords,
    periodoInicio,
    periodoFim,
    lojasIdentificadas: lojas.size,
    regionaisIdentificadas: regionais.size,
    categoriasIdentificadas: categorias.size,
    segmentosIdentificados: segmentos.size,
    subcategoriasIdentificadas: subcategorias.size,
    errorMessage,
    isActive: false,
  };

  if (status !== 'erro') {
    saveFacts(importId, facts);
    const preview: Record<string, unknown[]> = {};
    for (const s of sheets) {
      preview[s.sheetName] = facts.filter((f) => f.sheetName === s.sheetName).slice(0, 30);
    }
    saveRawPreview(importId, preview);
  }

  upsertImport(record);
  if (opts.activate && status !== 'erro') {
    setActiveImport(importId);
    record.isActive = true;
  }

  return record;
}
