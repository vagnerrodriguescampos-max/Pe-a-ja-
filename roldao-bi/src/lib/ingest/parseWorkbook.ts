import * as XLSX from 'xlsx';
import { randomUUID as uuid } from 'node:crypto';
import type { CanonicalField, ColumnMapping, FactRow, SheetImportReport, SheetRole } from '../types';
import { classifySheetRole } from '../mapping/sheetRoles';
import { classifyColumn, isBareYearHeader, parseTemporalHeader } from '../mapping/columnClassifier';
import { normalize } from '../mapping/normalize';
import { canonicalizeCanal } from '../mapping/canal';
import { toIsoDate, toNumber, cellToString, isRowEmpty } from './cellUtils';

const DIMENSION_FIELDS: CanonicalField[] = [
  'empresa', 'regional', 'loja_codigo', 'loja_nome', 'categoria', 'segmento',
  'subcategoria', 'canal', 'data', 'ano', 'mes', 'dia',
];

/** Métrica padrão a assumir para colunas de período sem rótulo de grupo. */
const DEFAULT_METRIC_BY_ROLE: Partial<Record<SheetRole, CanonicalField>> = {
  ORCADO_LOJA_DIA: 'orcamento',
  ORCADO_DIA: 'orcamento',
  ORCADO_DIA_SUBCATEGORIA: 'orcamento',
  ORCADO_CATEGORIA: 'orcamento',
  VENDAS_EXECUTIVO: 'venda_bruta',
  BASE_TELE_ECOMM: 'venda_bruta',
  PISO: 'venda_bruta',
  BASE_VENDA_ACUMULADO: 'venda_bruta',
  BASE_VENDA_DIA: 'venda_bruta',
  BASE_DIARIA_LOJA: 'venda_bruta',
  SUBCATEGORIA: 'venda_bruta',
  SEGMENTO: 'venda_bruta',
  VENDA_POR_SEGMENTO: 'venda_bruta',
  BASE_SEGMENTO: 'venda_bruta',
  BASE_SUBCATEGORIA: 'venda_bruta',
};

/** Em pivots do Excel, "Rótulos de Linha" carrega o nome da dimensão real da aba. */
const ROW_LABEL_FIELD_BY_ROLE: Partial<Record<SheetRole, CanonicalField>> = {
  SUBCATEGORIA: 'subcategoria',
  BASE_SUBCATEGORIA: 'subcategoria',
  ORCADO_DIA_SUBCATEGORIA: 'subcategoria',
  SEGMENTO: 'segmento',
  VENDA_POR_SEGMENTO: 'segmento',
};

/** Extrai um ano de 4 dígitos embutido em um texto de cabeçalho (ex.: "2026 Piso" -> 2026). */
function extractYearToken(text: string): number | null {
  const m = text.match(/\b(20\d{2})\b/);
  return m ? parseInt(m[1], 10) : null;
}

/** Amostra algumas linhas de dados para decidir se uma coluna é predominantemente numérica. */
function isColumnMostlyNumeric(rows: unknown[][], headerRowIdx: number, colIdx: number, sampleSize = 15): boolean {
  let seen = 0;
  let numeric = 0;
  for (let r = headerRowIdx + 1; r < rows.length && seen < sampleSize; r++) {
    const cell = rows[r]?.[colIdx];
    const s = cellToString(cell);
    if (!s) continue;
    seen++;
    if (typeof cell === 'number' || /^\d+([.,]\d+)?$/.test(s)) numeric++;
  }
  return seen > 0 && numeric / seen >= 0.7;
}

function resolveGroupHint(rawGroup: string): { field?: CanonicalField; canal?: string } {
  const n = normalize(rawGroup);
  if (!n) return {};
  if (n.includes('televendas')) return { field: 'venda_bruta', canal: 'Televendas' };
  if (n.includes('ecomm') || n.includes('e commerce')) return { field: 'venda_bruta', canal: 'E-commerce' };
  if (n.includes('ifood')) return { field: 'venda_bruta', canal: 'iFood' };
  if (n.includes('cliente')) return { field: 'clientes' };
  if (n.includes('ticket') || n.includes('tcket')) return { field: 'ticket_medio' };
  if (n.includes('piso')) return { field: 'piso' };
  if (n.includes('margem')) return { field: 'margem' };
  if (n.includes('meta') || n.includes('orcad')) return { field: 'orcamento' };
  if (n.includes('acumulad') || n.includes('venda')) return { field: 'venda_bruta' };
  return {};
}

interface SheetData {
  name: string;
  rows: unknown[][];
}

function readSheets(buffer: Buffer): SheetData[] {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  return wb.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null }) as unknown[][],
  }));
}

/** Estima o "ano padrão" do workbook a partir de qualquer cabeçalho ano-bare (2025/2026/...). */
function estimateDefaultYear(sheets: SheetData[]): number {
  let best = 0;
  for (const sheet of sheets) {
    for (let r = 0; r < Math.min(sheet.rows.length, 6); r++) {
      const row = sheet.rows[r] ?? [];
      for (const cell of row) {
        const y = isBareYearHeader(cellToString(cell));
        if (y && y > best) best = y;
      }
    }
  }
  return best || new Date().getFullYear();
}

function scoreHeaderRow(row: unknown[]): number {
  let score = 0;
  for (const cell of row) {
    const text = cellToString(cell);
    if (!text) continue;
    if (typeof cell === 'number') continue; // dados numéricos raramente são cabeçalho
    score += 1;
    const c = classifyColumn(text, new Date().getFullYear(), 2);
    if (c.kind !== 'nao_reconhecida' && c.kind !== 'ignorar') score += 2;
  }
  return score;
}

function findHeaderRow(rows: unknown[][]): { headerRowIdx: number; groupRowIdx: number | null } {
  const limit = Math.min(rows.length, 20);
  let best = { idx: 0, score: -1 };
  for (let i = 0; i < limit; i++) {
    const row = rows[i] ?? [];
    if (isRowEmpty(row)) continue;
    const s = scoreHeaderRow(row);
    if (s > best.score) best = { idx: i, score: s };
  }
  const headerRowIdx = best.idx;
  const aboveIdx = headerRowIdx - 1;
  const groupRowIdx = aboveIdx >= 0 && !isRowEmpty(rows[aboveIdx] ?? []) ? aboveIdx : null;
  return { headerRowIdx, groupRowIdx };
}

function forwardFill(row: unknown[], width: number): string[] {
  const out: string[] = [];
  let last = '';
  for (let j = 0; j < width; j++) {
    const v = cellToString(row[j]);
    if (v) last = v;
    out.push(last);
  }
  return out;
}

export interface ParseResult {
  sheets: SheetImportReport[];
  facts: FactRow[];
}

export function parseWorkbook(buffer: Buffer, importId: string): ParseResult {
  const sheetsData = readSheets(buffer);
  const defaultYear = estimateDefaultYear(sheetsData);
  const reports: SheetImportReport[] = [];
  const allFacts: FactRow[] = [];

  for (const sheet of sheetsData) {
    const { role, confidence } = classifySheetRole(sheet.name);
    const { headerRowIdx, groupRowIdx } = findHeaderRow(sheet.rows);
    const headerRow = sheet.rows[headerRowIdx] ?? [];
    const width = Math.max(
      headerRow.length,
      groupRowIdx !== null ? (sheet.rows[groupRowIdx] ?? []).length : 0,
      ...sheet.rows.slice(headerRowIdx, headerRowIdx + 30).map((r) => (r ? r.length : 0))
    );
    const groupRow = groupRowIdx !== null ? forwardFill(sheet.rows[groupRowIdx] ?? [], width) : new Array(width).fill('');
    const fieldRow: string[] = [];
    for (let j = 0; j < width; j++) fieldRow.push(cellToString(headerRow[j]));

    // conta headers "bare year" irmãos, para não confundir uma coluna "2025"
    // isolada (rara) com o padrão de tabela comparativa ano x ano (comum aqui).
    const bareYearCount = fieldRow.filter((h) => isBareYearHeader(h) !== null).length
      + groupRow.filter((h) => isBareYearHeader(h) !== null).length;

    const rowLabelField = ROW_LABEL_FIELD_BY_ROLE[role];
    const defaultMetric = DEFAULT_METRIC_BY_ROLE[role];

    type ColPlan =
      | { kind: 'dimensao'; field: CanonicalField }
      | { kind: 'metrica'; field: CanonicalField; ano?: number; mes?: number; dia?: number; canal?: string }
      | { kind: 'ignorar' }
      | { kind: 'extra' };

    const plan: ColPlan[] = [];
    const mappedColumns: ColumnMapping[] = [];
    const unmappedColumns: string[] = [];

    for (let j = 0; j < width; j++) {
      const field = fieldRow[j] ?? '';
      const group = groupRow[j] ?? '';
      const combined = [group, field].filter(Boolean).join(' ').trim();
      const sampleRaw = sheet.rows[headerRowIdx + 1]?.[j];

      if (!field && !group) {
        plan.push({ kind: 'ignorar' });
        continue;
      }

      // Cabeçalho ambíguo "Loja" sozinho: em algumas abas guarda o nome da
      // loja (ex.: "ORÇADO"), em outras o código numérico (ex.: "base").
      // Como o texto do cabeçalho é idêntico, desambiguamos pelo conteúdo.
      if (normalize(field) === 'loja' && isColumnMostlyNumeric(sheet.rows, headerRowIdx, j)) {
        plan.push({ kind: 'dimensao', field: 'loja_codigo' });
        mappedColumns.push({ originalHeader: field, field: 'loja_codigo', confidence: 0.85, sample: cellToString(sampleRaw) });
        continue;
      }

      // "Rótulos de Linha" contém o nome real da dimensão nesta aba (pivot do Excel)
      if (normalize(field) === 'rotulos de linha' || normalize(combined) === 'rotulos de linha') {
        if (rowLabelField) {
          plan.push({ kind: 'dimensao', field: rowLabelField });
          mappedColumns.push({ originalHeader: field || combined, field: rowLabelField, confidence: 0.9 });
        } else {
          plan.push({ kind: 'extra' });
          unmappedColumns.push(field || combined);
        }
        continue;
      }

      const temporalField = classifyColumn(field, defaultYear, bareYearCount);
      if (temporalField.kind === 'temporal' && temporalField.temporal) {
        const hint = resolveGroupHint(group);
        const metricField = hint.field ?? defaultMetric ?? 'venda_bruta';
        plan.push({
          kind: 'metrica',
          field: metricField,
          ano: temporalField.temporal.ano,
          mes: temporalField.temporal.mes || undefined,
          dia: temporalField.temporal.dia,
          canal: hint.canal,
        });
        mappedColumns.push({ originalHeader: combined || field, field: metricField, confidence: temporalField.confidence, sample: cellToString(sampleRaw) });
        continue;
      }

      const direct = classifyColumn(combined, defaultYear, bareYearCount);
      if (direct.kind === 'ignorar') {
        plan.push({ kind: 'ignorar' });
        continue;
      }
      if (direct.kind === 'dimensao' && direct.field) {
        plan.push({ kind: 'dimensao', field: direct.field });
        mappedColumns.push({ originalHeader: combined, field: direct.field, confidence: direct.confidence, sample: cellToString(sampleRaw) });
        continue;
      }
      if (direct.kind === 'metrica' && direct.field) {
        const embeddedYear = extractYearToken(combined);
        plan.push({ kind: 'metrica', field: direct.field, ano: embeddedYear ?? undefined });
        mappedColumns.push({ originalHeader: combined, field: direct.field, confidence: direct.confidence, sample: cellToString(sampleRaw) });
        continue;
      }
      if (direct.kind === 'temporal' && direct.temporal) {
        const hint = resolveGroupHint(group);
        const metricField = hint.field ?? defaultMetric ?? 'venda_bruta';
        plan.push({ kind: 'metrica', field: metricField, ano: direct.temporal.ano, mes: direct.temporal.mes || undefined, dia: direct.temporal.dia, canal: hint.canal });
        mappedColumns.push({ originalHeader: combined, field: metricField, confidence: direct.confidence });
        continue;
      }

      // coluna "Valor"/"Total" genérica cujo significado real está no rótulo de grupo
      const generic = normalize(field);
      if ((generic === 'valor' || generic === 'total') && group) {
        const hint = resolveGroupHint(group);
        if (hint.field) {
          const embeddedYear = extractYearToken(combined);
          plan.push({ kind: 'metrica', field: hint.field, canal: hint.canal, ano: embeddedYear ?? undefined });
          mappedColumns.push({ originalHeader: combined, field: hint.field, confidence: 0.7 });
          continue;
        }
      }

      // último recurso: remove um ano embutido (ex.: "2026 Acumulado") e tenta
      // reconhecer o texto restante (ex.: "Acumulado" -> venda_bruta via alias)
      const embeddedYear = extractYearToken(combined);
      if (embeddedYear) {
        const stripped = combined.replace(String(embeddedYear), '').trim();
        const hint = resolveGroupHint(stripped);
        if (hint.field) {
          plan.push({ kind: 'metrica', field: hint.field, canal: hint.canal, ano: embeddedYear });
          mappedColumns.push({ originalHeader: combined, field: hint.field, confidence: 0.65 });
          continue;
        }
      }

      plan.push({ kind: 'extra' });
      unmappedColumns.push(combined || field);
    }

    // se nenhuma coluna de métrica foi reconhecida, mas existe uma coluna de
    // total (ignorada por padrão para evitar dupla contagem quando há colunas
    // diárias), ela passa a ser a métrica da aba — nesse caso é o único valor.
    if (!plan.some((p) => p.kind === 'metrica')) {
      const totalIdx = fieldRow.findIndex((h) => /^total( geral)?$/.test(normalize(h)));
      if (totalIdx >= 0 && defaultMetric) {
        plan[totalIdx] = { kind: 'metrica', field: defaultMetric };
        mappedColumns.push({ originalHeader: fieldRow[totalIdx], field: defaultMetric, confidence: 0.6 });
      }
    }

    // ----- processa as linhas de dados -----
    const facts: FactRow[] = [];
    let totalRows = 0;
    let errorRows = 0;
    const warnings: string[] = [];

    for (let r = headerRowIdx + 1; r < sheet.rows.length; r++) {
      const row = sheet.rows[r] ?? [];
      if (isRowEmpty(row)) continue;
      totalRows++;

      const currentDims: Partial<Record<CanonicalField, string>> = {};
      const rowExtras: Record<string, string | number | null> = {};
      const buckets = new Map<string, FactRow>();
      let rowHadNumber = false;

      for (let j = 0; j < width; j++) {
        const p = plan[j];
        const cell = row[j];
        if (!p || p.kind === 'ignorar') continue;

        if (p.kind === 'dimensao') {
          if (p.field === 'data') {
            const iso = toIsoDate(cell);
            if (iso) currentDims.data = iso;
          } else {
            const s = cellToString(cell);
            if (s) currentDims[p.field] = p.field === 'canal' ? canonicalizeCanal(s) : s;
          }
          continue;
        }

        if (p.kind === 'extra') {
          const s = cellToString(cell);
          if (s) rowExtras[fieldRow[j] || `col_${j}`] = s;
          continue;
        }

        // métrica
        const num = toNumber(cell);
        if (num === null) continue;
        rowHadNumber = true;

        // Colunas de métrica sem ano/data explícitos (ex.: "Meta" isolada) são
        // atribuídas ao ano padrão do workbook, para não ficarem "soltas" sem
        // período e caírem fora dos filtros por ano/comparativos de A.A.
        const ano = p.ano ?? (currentDims.ano ? Number(currentDims.ano) : (currentDims.data ? undefined : defaultYear));
        const mes = p.mes;
        const dia = p.dia;
        const canal = p.canal ?? currentDims.canal;
        const key = JSON.stringify([
          currentDims.empresa, currentDims.regional, currentDims.loja_codigo, currentDims.loja_nome,
          currentDims.categoria, currentDims.segmento, currentDims.subcategoria, canal,
          currentDims.data, ano, mes, dia,
        ]);

        let bucket = buckets.get(key);
        if (!bucket) {
          bucket = {
            id: uuid(),
            importId,
            sheetName: sheet.name,
            sheetRole: role,
            blockIndex: 0,
            rowIndex: r,
            extras: {},
          };
          if (currentDims.empresa) bucket.empresa = currentDims.empresa;
          if (currentDims.regional) bucket.regional = currentDims.regional;
          if (currentDims.loja_codigo) bucket.loja_codigo = currentDims.loja_codigo;
          if (currentDims.loja_nome) bucket.loja_nome = currentDims.loja_nome;
          if (currentDims.categoria) bucket.categoria = currentDims.categoria;
          if (currentDims.segmento) bucket.segmento = currentDims.segmento;
          if (currentDims.subcategoria) bucket.subcategoria = currentDims.subcategoria;
          if (canal) bucket.canal = canal;
          if (currentDims.data) {
            bucket.data = currentDims.data;
            const d = new Date(currentDims.data);
            bucket.ano = d.getUTCFullYear();
            bucket.mes = d.getUTCMonth() + 1;
            bucket.dia = d.getUTCDate();
          } else {
            if (ano) bucket.ano = ano;
            if (mes) bucket.mes = mes;
            if (dia) bucket.dia = dia;
            if (ano && mes) {
              const iso = `${ano}-${String(mes).padStart(2, '0')}-${String(dia ?? 1).padStart(2, '0')}`;
              if (dia) bucket.data = iso;
            }
          }
          buckets.set(key, bucket);
        }

        const existing = bucket[p.field as keyof FactRow];
        if (typeof existing === 'number') {
          bucket[p.field as 'venda_bruta'] = (existing as number) + num;
        } else {
          (bucket as any)[p.field] = num;
        }
      }

      if (buckets.size === 0) {
        if (Object.keys(rowExtras).length > 0 || Object.keys(currentDims).length > 0) {
          // linha com dimensões/extras mas nenhuma métrica reconhecida — ainda preservamos
          const bucket: FactRow = {
            id: uuid(), importId, sheetName: sheet.name, sheetRole: role, blockIndex: 0, rowIndex: r,
            extras: { ...rowExtras },
          };
          if (currentDims.empresa) bucket.empresa = currentDims.empresa;
          if (currentDims.regional) bucket.regional = currentDims.regional;
          if (currentDims.loja_codigo) bucket.loja_codigo = currentDims.loja_codigo;
          if (currentDims.loja_nome) bucket.loja_nome = currentDims.loja_nome;
          if (currentDims.categoria) bucket.categoria = currentDims.categoria;
          if (currentDims.segmento) bucket.segmento = currentDims.segmento;
          if (currentDims.subcategoria) bucket.subcategoria = currentDims.subcategoria;
          if (currentDims.canal) bucket.canal = currentDims.canal;
          if (currentDims.data) bucket.data = currentDims.data;
          facts.push(bucket);
        } else {
          errorRows++;
        }
        continue;
      }

      for (const bucket of buckets.values()) {
        bucket.extras = { ...rowExtras };
        facts.push(bucket);
      }
      if (!rowHadNumber && Object.keys(rowExtras).length === 0) errorRows++;
    }

    allFacts.push(...facts);
    reports.push({
      sheetName: sheet.name,
      role,
      roleConfidence: confidence,
      blocks: 1,
      headerRow: headerRowIdx,
      totalRows,
      validRows: facts.length,
      errorRows,
      mappedColumns,
      unmappedColumns: Array.from(new Set(unmappedColumns)).filter(Boolean),
      warnings,
    });
  }

  enrichFacts(allFacts);
  return { sheets: reports, facts: allFacts };
}

/**
 * Camada de enriquecimento (seção 31): várias abas guardam só o código da
 * loja (sem regional/nome) ou só a subcategoria (sem segmento/categoria).
 * Aqui construímos os relacionamentos loja→regional/nome/empresa e
 * subcategoria→segmento→categoria a partir de QUALQUER aba que já traga
 * essa relação (ex.: "Base nova regional", "Base loja", "Base Segmento",
 * "Procv categoria") e preenchemos as linhas que não têm essa dimensão.
 * Nunca sobrescreve um valor já existente — só completa o que falta.
 */
function enrichFacts(facts: FactRow[]): void {
  const lojaInfo = new Map<string, { nome?: string; regional?: string; empresa?: string }>();
  const nomeToCodigo = new Map<string, string>();
  for (const f of facts) {
    if (!f.loja_codigo) continue;
    const cur = lojaInfo.get(f.loja_codigo) ?? {};
    if (f.loja_nome && !cur.nome) cur.nome = f.loja_nome;
    if (f.regional && !cur.regional) cur.regional = f.regional;
    if (f.empresa && !cur.empresa) cur.empresa = f.empresa;
    lojaInfo.set(f.loja_codigo, cur);
    if (f.loja_nome && !nomeToCodigo.has(normalize(f.loja_nome))) nomeToCodigo.set(normalize(f.loja_nome), f.loja_codigo);
  }

  const subInfo = new Map<string, { segmento?: string; categoria?: string }>();
  const segInfo = new Map<string, { categoria?: string }>();
  for (const f of facts) {
    if (f.subcategoria) {
      const cur = subInfo.get(f.subcategoria) ?? {};
      if (f.segmento && !cur.segmento) cur.segmento = f.segmento;
      if (f.categoria && !cur.categoria) cur.categoria = f.categoria;
      subInfo.set(f.subcategoria, cur);
    }
    if (f.segmento && f.categoria && !segInfo.get(f.segmento)?.categoria) {
      segInfo.set(f.segmento, { categoria: f.categoria });
    }
  }

  for (const f of facts) {
    if (!f.loja_codigo && f.loja_nome) {
      const codigo = nomeToCodigo.get(normalize(f.loja_nome));
      if (codigo) f.loja_codigo = codigo;
    }
    if (f.loja_codigo) {
      const info = lojaInfo.get(f.loja_codigo);
      if (info) {
        if (!f.loja_nome && info.nome) f.loja_nome = info.nome;
        if (!f.regional && info.regional) f.regional = info.regional;
        if (!f.empresa && info.empresa) f.empresa = info.empresa;
      }
    }
    if (f.subcategoria) {
      const info = subInfo.get(f.subcategoria);
      if (info) {
        if (!f.segmento && info.segmento) f.segmento = info.segmento;
        if (!f.categoria && info.categoria) f.categoria = info.categoria;
      }
    }
    if (f.segmento && !f.categoria) {
      const info = segInfo.get(f.segmento);
      if (info?.categoria) f.categoria = info.categoria;
    }
  }
}
