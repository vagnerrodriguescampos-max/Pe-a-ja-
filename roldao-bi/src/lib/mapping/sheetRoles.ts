import type { SheetRole } from '../types';
import { SHEET_ROLE_ALIASES } from './aliases';
import { normalize } from './normalize';
import { similarity } from './fuzzy';

const NORMALIZED_ROLE_ALIASES: [SheetRole, string[]][] = Object.entries(SHEET_ROLE_ALIASES).map(
  ([role, aliases]) => [role as SheetRole, aliases.map(normalize)]
);

/**
 * Classifica o nome de uma aba em um papel de negócio conhecido.
 * Faz correspondência exata primeiro; se não encontrar, cai para
 * similaridade aproximada (para tolerar pequenas variações de digitação,
 * ex.: "Base Segmentos" vs "Base Segmento").
 */
export function classifySheetRole(sheetName: string): { role: SheetRole; confidence: number } {
  const n = normalize(sheetName);
  if (!n) return { role: 'OUTRA', confidence: 0 };

  // 1) correspondência exata de alias
  for (const [role, aliases] of NORMALIZED_ROLE_ALIASES) {
    if (aliases.includes(n)) return { role, confidence: 1 };
  }

  // 2) o nome da aba contém o alias (ou vice-versa) — comum em nomes longos
  let best: { role: SheetRole; confidence: number } = { role: 'OUTRA', confidence: 0 };
  for (const [role, aliases] of NORMALIZED_ROLE_ALIASES) {
    for (const alias of aliases) {
      if (!alias) continue;
      if (n.includes(alias) || alias.includes(n)) {
        const conf = alias.length / Math.max(alias.length, n.length);
        if (conf > best.confidence) best = { role, confidence: Math.max(conf, 0.75) };
      }
    }
  }
  if (best.confidence > 0) return best;

  // 3) similaridade aproximada (tolera pequenas diferenças de nomenclatura)
  for (const [role, aliases] of NORMALIZED_ROLE_ALIASES) {
    for (const alias of aliases) {
      if (!alias) continue;
      const sim = similarity(n, alias);
      if (sim > best.confidence && sim >= 0.72) best = { role, confidence: sim };
    }
  }

  return best.confidence > 0 ? best : { role: 'OUTRA', confidence: 0 };
}
