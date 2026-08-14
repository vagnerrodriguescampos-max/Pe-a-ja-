import { getStore } from '@netlify/blobs';

/**
 * Único "store" de blobs do BI — registry de importações, configurações e
 * fatos por importação vivem aqui. Escopo global (não por deploy): o
 * histórico de importações precisa sobreviver a novos deploys/redeploys da
 * aplicação (seção 30 — "nunca apagar o histórico automaticamente").
 *
 * Netlify Blobs funciona em "modo manual" fora do runtime do Netlify (ex.:
 * app rodando em outra plataforma, como Railway) desde que se informe
 * siteID + token explicitamente. Nesse caso o app continua usando o Blob
 * Store do site Netlify como armazenamento — só o código roda em outro
 * lugar. Quando as variáveis não existem, cai no modo automático (usado
 * quando o próprio Next.js está de fato rodando dentro do Netlify).
 */
export function getBiStore() {
  const siteID = process.env.NETLIFY_BLOBS_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN;
  if (siteID && token) {
    return getStore({ name: 'roldao-bi', siteID, token });
  }
  return getStore('roldao-bi');
}
