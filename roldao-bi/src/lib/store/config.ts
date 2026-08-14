import fs from 'node:fs';
import { CONFIG_PATH, ensureDataDirs } from './paths';

export interface BiConfig {
  atingimentoCritico: number; // < este valor = crítico
  atingimentoAtencao: number; // até este valor = atenção
  atingimentoExcelente: number; // a partir deste valor = excelente
  crescimentoRelevante: number; // % considerado "crescimento relevante" para alertas
  quedaRelevante: number; // % considerado "queda relevante" para alertas
  margemReferencia: number; // % margem mínima de referência
  usuarioLogado: string;
}

export const DEFAULT_CONFIG: BiConfig = {
  atingimentoCritico: 90,
  atingimentoAtencao: 100,
  atingimentoExcelente: 105,
  crescimentoRelevante: 10,
  quedaRelevante: -5,
  margemReferencia: 12,
  usuarioLogado: 'Vagner Campos',
};

export function getConfig(): BiConfig {
  ensureDataDirs();
  if (!fs.existsSync(CONFIG_PATH)) return DEFAULT_CONFIG;
  try {
    return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(cfg: Partial<BiConfig>) {
  ensureDataDirs();
  const merged = { ...getConfig(), ...cfg };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf-8');
  return merged;
}
