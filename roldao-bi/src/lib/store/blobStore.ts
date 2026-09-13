import { getStore } from '@netlify/blobs';
import { caminhoDoArmazenamentoLocal, criarArmazenamentoLocal } from './localStore';

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
let loggedMode = false;

export function getBiStore() {
  const siteID = process.env.NETLIFY_BLOBS_SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN;
  if (!loggedMode) {
    // Log único por processo (não a cada chamada) — ajuda a diagnosticar
    // rapidamente, via logs do host, se o app está mesmo em "modo manual"
    // (fora do runtime do Netlify) sem expor o token.
    console.log(
      siteID && token
        ? `[blobStore] modo manual — siteID=${siteID.slice(0, 8)}… token=${token.slice(0, 6)}…(${token.length} chars)`
        : `[blobStore] sem credenciais do Netlify — usando armazenamento local em ${caminhoDoArmazenamentoLocal()}`
    );
    loggedMode = true;
  }
  if (siteID && token) {
    return getStore({ name: 'roldao-bi', siteID, token });
  }
  // Sem credenciais, `getStore('roldao-bi')` só funciona dentro do runtime do
  // Netlify — fora dele ele lança, e antes disso a exceção derrubava TODAS as
  // rotas de API, deixando as 17 páginas em branco. Cair para o disco mantém o
  // projeto utilizável fora do Netlify (máquina local, demonstração, Railway)
  // sem precisar do segredo que dá acesso aos dados reais.
  if (process.env.NETLIFY || process.env.NETLIFY_DEV) return getStore('roldao-bi');
  return criarArmazenamentoLocal();
}
