'use client';

import { useEffect } from 'react';

// Favicon da plataforma: motinha de entrega desenhada como SVG inline (data URI), então
// não depende de nenhum arquivo hospedado nem de request extra. Percent-encoded porque
// data URI não aceita "<", ">" e o emoji crus de forma confiável entre navegadores.
export const FAVICON_PECA_JA =
  "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20100%20100'%3E%3Ctext%20y='.9em'%20font-size='90'%3E%F0%9F%9B%B5%3C/text%3E%3C/svg%3E";

function aplicar(href: string) {
  // Removemos os ícones anteriores em vez de reaproveitar: o Next injeta o próprio
  // <link rel="icon"> e reusar a mesma tag faria a logo da loja "vazar" para as telas
  // da plataforma na navegação client-side.
  document.querySelectorAll("link[data-favicon-loja='1']").forEach(el => el.remove());

  const link = document.createElement('link');
  link.rel = 'icon';
  link.href = href;
  link.setAttribute('data-favicon-loja', '1');
  document.head.appendChild(link);
}

/**
 * Nas telas do cliente o favicon é a logo da loja — quem abre o link vê a marca do
 * restaurante na aba, não a nossa. Sem logo cadastrada, cai no ícone da plataforma.
 * Ao sair da tela o favicon do Peça Já é restaurado.
 */
export function useFaviconLoja(logoUrl?: string | null) {
  useEffect(() => {
    if (!logoUrl) return;
    aplicar(logoUrl);
    return () => aplicar(FAVICON_PECA_JA);
  }, [logoUrl]);
}
