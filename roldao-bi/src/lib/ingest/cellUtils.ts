/** Converte uma célula de planilha em número, sem inventar valores. */
export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return null;
  const s = String(value).trim();
  if (!s) return null;
  if (/^#(div\/0|n\/a|ref|value|name|null)!?$/i.test(s)) return null; // erros do Excel
  const cleaned = s
    .replace(/[R$\s%]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '') // ponto de milhar (padrão BR)
    .replace(/,(?=\d{1,2}$)/, '.'); // vírgula decimal (padrão BR)
  const n = Number(cleaned.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

/** Converte serial de data do Excel (ou Date/string) para ISO yyyy-mm-dd. */
export function toIsoDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number') {
    const ms = EXCEL_EPOCH + value * 86400000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  // dd/mm/aaaa ou d/m/aaaa
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = `20${y}`;
    const iso = `${y.padStart(4, '0')}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
    const dt = new Date(iso);
    return Number.isNaN(dt.getTime()) ? null : iso;
  }
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
}

export function cellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

export function isRowEmpty(row: unknown[]): boolean {
  return row.every((c) => c === null || c === undefined || String(c).trim() === '');
}
