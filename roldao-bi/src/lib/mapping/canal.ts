import { normalize } from './normalize';

/**
 * Normaliza o rótulo de canal para uma grafia canônica única — a mesma
 * planilha às vezes escreve "TELEVENDAS", "Televendas" e "Tele vendas" em
 * abas diferentes; sem isso cada variação viraria uma linha própria nos
 * rankings/gráficos por canal.
 */
const CANONICAL_CANAIS: [string, string][] = [
  ['televendas', 'Televendas'],
  ['tele vendas', 'Televendas'],
  ['ecommerce', 'E-commerce'],
  ['e commerce', 'E-commerce'],
  ['ifood', 'iFood'],
  ['loja fisica', 'Loja Física'],
  ['loja', 'Loja Física'],
  ['app', 'App'],
  ['site', 'Site'],
];

export function canonicalizeCanal(raw: string): string {
  const n = normalize(raw);
  for (const [key, label] of CANONICAL_CANAIS) {
    if (n === key) return label;
  }
  // sem correspondência conhecida: preserva o texto original (capitalizado),
  // sem inventar uma categoria — só padroniza a apresentação.
  return raw.trim();
}
