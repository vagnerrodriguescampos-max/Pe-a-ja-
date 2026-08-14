import type { CanonicalField, SheetRole } from '../types';
import { normalize } from './normalize';

/**
 * Dicionário de sinônimos por campo canônico.
 *
 * As listas abaixo foram construídas a partir dos cabeçalhos reais das abas
 * do "INFORMATIVO DE VENDAS - Lojas" do Roldão Atacadista (ORÇADO, Vendas,
 * Piso, BASE TELE E ECOMM, base, Base Segmento, Subcategoria, Segmento,
 * Venda por Segmento, Orçado de categoria, BESE VENDA ACUMULADO, BASE VENDA
 * DIA...), mais variações comuns ("Nº Loja", "Cod Loja", "Código Loja" etc.)
 * para que planilhas futuras com pequenas diferenças de nomenclatura ainda
 * sejam reconhecidas. Tudo que não bater aqui (nem por sinônimo, nem por
 * similaridade aproximada) permanece disponível em `extras` — nunca é
 * descartado.
 */
export const FIELD_ALIASES: Record<CanonicalField, string[]> = {
  empresa: ['empresa', 'razao social', 'bandeira', 'rede'],
  regional: ['regional', 'regiao', 'gerencia regional', 'diretoria regional'],
  loja_codigo: [
    'no loja', 'n loja', 'no', 'no correto', 'nocorreto', 'cod loja', 'codigo loja',
    'numero loja', 'loja no', 'id loja', 'cod', 'codigo', 'loja cod', 'n',
  ],
  loja_nome: ['loja', 'nome loja', 'unidade', 'filial', 'ponto de venda', 'pdv'],
  categoria: ['categoria', 'grupo'],
  // "Seção" no Roldão identifica o Segmento (ver aba "Base Segmento"), não a Categoria.
  segmento: ['segmento', 'secao', 'seçao'],
  subcategoria: ['sub categoria', 'subcategoria', 'sub cat', 'subcat'],
  canal: ['canal venda', 'canal', 'canal de venda'],
  // "dia" isolado fica de fora de propósito: colide com compostos como
  // "Venda Dia" (que é venda_bruta, não uma data) — ver dia/'dia do mes'.
  data: ['data', 'data venda', 'data referencia'],
  ano: ['ano'],
  mes: ['mes', 'mês'],
  dia: ['dia do mes'],
  venda_bruta: [
    'venda bruta', 'venda bruta r', 'soma de venda bruta r', 'vendas total lojas',
    'venda total', 'faturamento bruto', 'venda valor', 'soma de venda valor', 'venda valor r',
    'venda acumulada', 'venda dia',
  ],
  venda_liquida: ['venda liquida', 'faturamento liquido'],
  orcamento: [
    'orcado', 'orçado', 'meta', 'meta loja', 'meta vendas', 'orcamento',
    'meta por loja', 'total geral',
  ],
  // Sem "aa" isolado aqui de propósito: nas planilhas do Roldão "aa %"
  // significa "variação vs ano anterior" (crescimento_pct), não o valor em si.
  venda_ano_anterior: ['ano anterior', 'venda ano anterior'],
  piso: ['piso', 'piso de loja', 'piso loja'],
  margem: ['margem', 'margem bruta', 'margem r'],
  clientes: ['clientes', 'qtde clientes', 'cliente', 'qtd clientes', 'numero clientes'],
  ticket_medio: ['ticket', 'ticket medio', 'tcket', 'tiket'],
  crescimento_pct: ['aa %', 'crescimento', 'var %', 'variacao', 'crescimento %', '%'],
  atingimento_pct: ['meta %', 'atingimento', 'atingimento %', '% meta', 'perfomance vendas', 'performance vendas'],
  participacao_pct: ['part %', 'participacao', 'participacao %', '% part'],
};

const NORMALIZED_ALIASES: Record<CanonicalField, string[]> = Object.fromEntries(
  Object.entries(FIELD_ALIASES).map(([k, values]) => [k, values.map(normalize)])
) as Record<CanonicalField, string[]>;

export function getNormalizedAliases(field: CanonicalField): string[] {
  return NORMALIZED_ALIASES[field];
}

export const ALL_CANONICAL_FIELDS = Object.keys(FIELD_ALIASES) as CanonicalField[];

/** Sinônimos de nome de aba -> papel semântico da aba (SheetRole). */
export const SHEET_ROLE_ALIASES: Record<SheetRole, string[]> = {
  ORCADO_LOJA_DIA: ['orcado', 'orcado loja', 'budget loja'],
  ORCADO_DIA: ['orcado dia'],
  ORCADO_DIA_SUBCATEGORIA: ['orcado dia subcategoria'],
  ORCADO_CATEGORIA: ['orcado de categoria', 'orcado categoria'],
  VENDAS_EXECUTIVO: ['vendas', 'venda', 'informativo de vendas', 'painel vendas'],
  BASE_TELE_ECOMM: ['base tele e ecomm', 'tele e ecomm', 'televendas e ecommerce'],
  PISO: ['piso'],
  BASE_VENDA_ACUMULADO: ['bese venda acumulado', 'base venda acumulado', 'venda acumulada'],
  BASE_VENDA_DIA: ['base venda dia', 'venda dia'],
  BASE_DIARIA_LOJA: ['base'],
  SUBCATEGORIA: ['subcategoria', 'sub categoria'],
  SEGMENTO: ['segmento'],
  VENDA_POR_SEGMENTO: ['venda por segmento'],
  BASE_SEGMENTO: ['base segmento'],
  BASE_SUBCATEGORIA: ['base de subcategoria', 'base subcategoria'],
  BASE_LOJA: ['base loja', 'cadastro loja', 'lojas'],
  BASE_NOVA_REGIONAL: ['base nova regional', 'nova regional', 'regional'],
  PROCV_CATEGORIA: ['procv categoria', 'procv', 'de para categoria'],
  OUTRA: [],
};
