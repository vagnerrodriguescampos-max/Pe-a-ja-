import type { CanonicalField } from '../types';
import { normalize } from './normalize';
import { similarity } from './fuzzy';
import { ALL_CANONICAL_FIELDS, getNormalizedAliases } from './aliases';

const MONTH_ABBR: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

export interface TemporalMatch {
  ano?: number;
  mes: number;
  dia?: number;
}

/**
 * Reconhece cabeçalhos de coluna que na verdade representam um período
 * (planilhas de orçamento/venda no Roldão usam datas como coluna: "1/8",
 * "14-ago.", "jun.-25" etc.). Quando reconhecido, a coluna deve ser
 * "despivotada" (melt) em vez de tratada como uma métrica isolada.
 */
export function parseTemporalHeader(rawHeader: string, defaultYear: number): TemporalMatch | null {
  const h = rawHeader.toString().trim().toLowerCase().replace(/\s+/g, '');

  // dd/m ou dd/mm  (ex.: "1/8", "31/8")
  let m = h.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (m) {
    const dia = parseInt(m[1], 10);
    const mes = parseInt(m[2], 10);
    if (dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12) return { dia, mes, ano: defaultYear };
  }

  // dd-mmm. ou dd-mmm  (ex.: "14-ago.", "1-ago")
  m = h.match(/^(\d{1,2})-([a-zç]{3})\.?$/);
  if (m) {
    const dia = parseInt(m[1], 10);
    const mes = MONTH_ABBR[m[2]];
    if (mes && dia >= 1 && dia <= 31) return { dia, mes, ano: defaultYear };
  }

  // mmm.-aa ou mmm-aaaa (ex.: "jun.-25", "jul.-26")
  m = h.match(/^([a-zç]{3})\.?-(\d{2,4})$/);
  if (m) {
    const mes = MONTH_ABBR[m[1]];
    if (mes) {
      let ano = parseInt(m[2], 10);
      if (ano < 100) ano += 2000;
      return { mes, ano };
    }
  }

  return null;
}

/** Header formado só por um ano de 4 dígitos (ex.: "2025", "2026"). */
export function isBareYearHeader(rawHeader: string): number | null {
  const h = rawHeader.toString().trim();
  const m = h.match(/^(20\d{2})$/);
  return m ? parseInt(m[1], 10) : null;
}

export interface ColumnClassification {
  originalHeader: string;
  kind: 'dimensao' | 'metrica' | 'temporal' | 'nao_reconhecida' | 'ignorar';
  field?: CanonicalField;
  confidence: number;
  temporal?: TemporalMatch;
}

const IGNORE_PATTERNS = [/^total( geral)?$/, /^rotulos? de coluna$/, /^\(v[aá]rios itens\)$/, /^\(tudo\)$/];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Casamento por "contém", mas respeitando fronteira de palavra — sem isso,
 * aliases curtos e legítimos (ex.: "n", "no", "cod" para código de loja)
 * combinariam com qualquer cabeçalho que contivesse essas letras por
 * coincidência (ex.: "Televendas aa %" contém a letra "n" de "Televendas").
 * Só dispensamos a fronteira de palavra quando o alias já é razoavelmente
 * longo (>= 5 caracteres), caso em que uma coincidência acidental é rara.
 */
function containsAsSegment(haystack: string, needle: string): boolean {
  // aliases de 1 caractere (ex.: "n", "%") só valem por igualdade exata —
  // como "contém" eles combinariam com qualquer texto por coincidência.
  if (needle.length < 2) return false;
  if (needle.length >= 5) return haystack.includes(needle);
  return new RegExp(`(^|\\s)${escapeRegex(needle)}($|\\s)`).test(haystack);
}

/** Casa um cabeçalho de coluna com o campo canônico mais provável. */
export function matchField(rawHeader: string): { field: CanonicalField; confidence: number } | null {
  const n = normalize(rawHeader);
  if (!n) return null;

  let best: { field: CanonicalField; confidence: number } | null = null;
  let bestAliasLen = 0;
  for (const field of ALL_CANONICAL_FIELDS) {
    const aliases = getNormalizedAliases(field);
    for (const alias of aliases) {
      if (n === alias) return { field, confidence: 1 };
      let conf = 0;
      if (containsAsSegment(n, alias) || containsAsSegment(alias, n)) {
        conf = Math.min(alias.length, n.length) / Math.max(alias.length, n.length);
        conf = Math.max(conf, 0.8);
      } else {
        const sim = similarity(n, alias);
        if (sim >= 0.84) conf = sim;
      }
      // Em empate de confiança, o alias mais longo (mais específico) vence —
      // ex.: "venda dia" deve prevalecer sobre "dia" para o texto "Venda Dia".
      const better = conf > 0 && (!best || conf > best.confidence || (conf === best.confidence && alias.length > bestAliasLen));
      if (better) { best = { field, confidence: conf }; bestAliasLen = alias.length; }
    }
  }
  return best;
}

export function classifyColumn(rawHeader: string, defaultYear: number, siblingBareYearCount: number): ColumnClassification {
  const header = (rawHeader ?? '').toString().trim();
  if (!header) return { originalHeader: header, kind: 'ignorar', confidence: 1 };
  if (IGNORE_PATTERNS.some((p) => p.test(normalize(header)))) {
    return { originalHeader: header, kind: 'ignorar', confidence: 1 };
  }

  const bareYear = isBareYearHeader(header);
  if (bareYear && siblingBareYearCount >= 2) {
    return { originalHeader: header, kind: 'temporal', confidence: 1, temporal: { ano: bareYear, mes: 0 } };
  }

  const temporal = parseTemporalHeader(header, defaultYear);
  if (temporal) return { originalHeader: header, kind: 'temporal', confidence: 0.95, temporal };

  const match = matchField(header);
  if (match && match.confidence >= 0.72) {
    const dims: CanonicalField[] = [
      'empresa', 'regional', 'loja_codigo', 'loja_nome', 'categoria', 'segmento',
      'subcategoria', 'canal', 'data', 'ano', 'mes', 'dia',
    ];
    return {
      originalHeader: header,
      kind: dims.includes(match.field) ? 'dimensao' : 'metrica',
      field: match.field,
      confidence: match.confidence,
    };
  }

  return { originalHeader: header, kind: 'nao_reconhecida', confidence: 0 };
}
