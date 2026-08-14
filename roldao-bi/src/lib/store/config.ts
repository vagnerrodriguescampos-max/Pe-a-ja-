import { getBiStore } from './blobStore';

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

const CONFIG_KEY = 'config.json';

export async function getConfig(): Promise<BiConfig> {
  const store = getBiStore();
  try {
    const cfg = await store.get(CONFIG_KEY, { type: 'json' });
    return { ...DEFAULT_CONFIG, ...((cfg as Partial<BiConfig>) ?? {}) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveConfig(cfg: Partial<BiConfig>): Promise<BiConfig> {
  const current = await getConfig();
  const merged = { ...current, ...cfg };
  const store = getBiStore();
  await store.setJSON(CONFIG_KEY, merged);
  return merged;
}
