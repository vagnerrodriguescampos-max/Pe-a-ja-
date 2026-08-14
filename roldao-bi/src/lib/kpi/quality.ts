import type { FactRow, ImportRecord } from '../types';

export interface QualityReport {
  registrosImportados: number;
  registrosValidos: number;
  registrosComErro: number;
  camposAusentes: { campo: string; ocorrencias: number }[];
  lojasIdentificadas: number;
  regionaisIdentificadas: number;
  categoriasIdentificadas: number;
  periodoEncontrado: { inicio: string | null; fim: string | null };
  duplicidades: number;
  valoresNulos: number;
  ultimaAtualizacao: string;
  colunasNaoMapeadasPorAba: { aba: string; colunas: string[] }[];
}

export function buildQualityReport(record: ImportRecord, facts: FactRow[]): QualityReport {
  const camposChave: (keyof FactRow)[] = ['loja_codigo', 'regional', 'categoria', 'data', 'venda_bruta'];
  const ausencias = new Map<string, number>();
  let nulos = 0;
  const seen = new Set<string>();
  let duplicidades = 0;

  for (const f of facts) {
    for (const campo of camposChave) {
      if (f[campo] === undefined || f[campo] === null) {
        ausencias.set(campo, (ausencias.get(campo) ?? 0) + 1);
      }
    }
    for (const v of Object.values(f.extras || {})) if (v === null) nulos++;
    const dupKey = `${f.sheetName}|${f.loja_codigo}|${f.data}|${f.categoria}|${f.subcategoria}|${f.canal}`;
    if (f.loja_codigo && f.data) {
      if (seen.has(dupKey)) duplicidades++;
      else seen.add(dupKey);
    }
  }

  return {
    registrosImportados: record.totalRecords,
    registrosValidos: record.validRecords,
    registrosComErro: record.errorRecords,
    camposAusentes: Array.from(ausencias.entries()).map(([campo, ocorrencias]) => ({ campo, ocorrencias })),
    lojasIdentificadas: record.lojasIdentificadas,
    regionaisIdentificadas: record.regionaisIdentificadas,
    categoriasIdentificadas: record.categoriasIdentificadas,
    periodoEncontrado: { inicio: record.periodoInicio, fim: record.periodoFim },
    duplicidades,
    valoresNulos: nulos,
    ultimaAtualizacao: record.importedAt,
    colunasNaoMapeadasPorAba: record.sheets
      .filter((s) => s.unmappedColumns.length > 0)
      .map((s) => ({ aba: s.sheetName, colunas: s.unmappedColumns })),
  };
}
