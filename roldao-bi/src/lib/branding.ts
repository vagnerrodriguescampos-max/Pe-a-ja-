/**
 * Identidade visível do BI: nome da rede e nome do produto.
 *
 * Estava fixa no código, em quatro lugares diferentes (cabeçalho, rodapé,
 * título da aba do navegador e tela de "nenhuma base importada"). Isso tem
 * dois custos: instalar o mesmo BI para outro cliente exige caçar e editar
 * essas ocorrências, e uma demonstração feita para um prospecto carrega o
 * nome de outra empresa na tela inteira.
 *
 * Aqui a identidade vira configuração de implantação — é fixa durante a
 * execução, então variável de ambiente é o lugar certo (e não a configuração
 * em disco, que existe para o que o usuário muda no dia a dia, como as faixas
 * de atingimento).
 *
 * Para trocar, antes do build:
 *
 *     NEXT_PUBLIC_BI_EMPRESA="Atacado Exemplo"
 *     NEXT_PUBLIC_BI_PRODUTO="BI de Performance Comercial"
 *
 * As referências a `process.env.NEXT_PUBLIC_*` precisam ser literais e
 * completas: o Next substitui o texto no build, e um acesso dinâmico
 * (`process.env[chave]`) chegaria ao navegador como `undefined`.
 */
export const MARCA = {
  empresa: process.env.NEXT_PUBLIC_BI_EMPRESA?.trim() || 'Prima Atacadista',
  produto: process.env.NEXT_PUBLIC_BI_PRODUTO?.trim() || 'BI de Performance Comercial',
} as const;

/** "Prima Atacadista · BI de Performance Comercial" */
export function marcaCompleta(): string {
  return `${MARCA.empresa} · ${MARCA.produto}`;
}
