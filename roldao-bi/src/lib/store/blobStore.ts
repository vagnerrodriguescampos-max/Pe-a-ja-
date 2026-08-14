import { getStore } from '@netlify/blobs';

/**
 * Único "store" de blobs do BI — registry de importações, configurações e
 * fatos por importação vivem aqui. Escopo global (não por deploy): o
 * histórico de importações precisa sobreviver a novos deploys da aplicação
 * (seção 30 — "nunca apagar o histórico automaticamente").
 */
export function getBiStore() {
  return getStore('roldao-bi');
}
