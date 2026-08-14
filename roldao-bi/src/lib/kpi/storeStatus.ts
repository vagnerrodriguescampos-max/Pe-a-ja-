import type { RankingRow } from '../query/ranking';
import type { BiConfig } from '../store/config';

export type StoreStatus = 'excelente' | 'bom' | 'atencao' | 'critico';

export const STORE_STATUS_META: Record<StoreStatus, { icon: string; label: string; color: string }> = {
  excelente: { icon: '🟢', label: 'Excelente', color: '#16c784' },
  bom: { icon: '🔵', label: 'Bom', color: '#3ab7ff' },
  atencao: { icon: '🟡', label: 'Atenção', color: '#f5a623' },
  critico: { icon: '🔴', label: 'Crítico', color: '#f0475b' },
};

/**
 * Classificação de status da loja combinando atingimento do orçamento,
 * crescimento vs ano anterior, margem e tendência recente (seção 9).
 * Cada fator só participa da pontuação quando o dado existe na base.
 */
export function classifyStoreStatus(row: RankingRow, cfg: BiConfig): StoreStatus {
  let score = 0;
  let factors = 0;

  if (row.atingimentoPct !== null) {
    factors++;
    if (row.atingimentoPct >= cfg.atingimentoExcelente) score += 2;
    else if (row.atingimentoPct >= cfg.atingimentoAtencao) score += 1;
    else if (row.atingimentoPct < cfg.atingimentoCritico) score -= 2;
    else score -= 1;
  }
  if (row.crescimentoPct !== null) {
    factors++;
    if (row.crescimentoPct >= cfg.crescimentoRelevante) score += 2;
    else if (row.crescimentoPct >= 0) score += 1;
    else if (row.crescimentoPct <= cfg.quedaRelevante) score -= 2;
    else score -= 1;
  }
  if (row.margemPct !== null) {
    factors++;
    score += row.margemPct >= cfg.margemReferencia ? 1 : -1;
  }
  if (row.tendencia) {
    factors++;
    score += row.tendencia === 'subindo' ? 1 : row.tendencia === 'caindo' ? -1 : 0;
  }

  if (factors === 0) return 'atencao';
  if (score >= 4) return 'excelente';
  if (score >= 1) return 'bom';
  if (score >= -2) return 'atencao';
  return 'critico';
}
