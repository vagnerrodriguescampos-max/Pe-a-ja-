import type { BiConfig } from '../store/config';

export type GaugeStatus = 'critico' | 'atencao' | 'dentro' | 'excelente';

export const GAUGE_LABEL: Record<GaugeStatus, string> = {
  critico: 'Crítico',
  atencao: 'Atenção',
  dentro: 'Dentro / Acima',
  excelente: 'Excelente',
};

export const GAUGE_COLOR: Record<GaugeStatus, string> = {
  critico: '#f0475b',
  atencao: '#f5a623',
  dentro: '#16c784',
  excelente: '#1f74f5',
};

export function classifyAtingimento(pct: number | null, cfg: BiConfig): GaugeStatus | null {
  if (pct === null || Number.isNaN(pct)) return null;
  if (pct < cfg.atingimentoCritico) return 'critico';
  if (pct < cfg.atingimentoAtencao) return 'atencao';
  if (pct < cfg.atingimentoExcelente) return 'dentro';
  return 'excelente';
}
