/** Normalização textual usada em todo o motor de mapeamento semântico. */
export function normalize(text: string): string {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .toLowerCase()
    .replace(/[º°]/g, '')
    .replace(/[^a-z0-9%]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Versão "compacta" sem espaços, para comparação de aliases. */
export function compact(text: string): string {
  return normalize(text).replace(/\s+/g, '');
}
