/**
 * Modelo de dados do Roldão BI.
 *
 * Filosofia: a planilha é a fonte da verdade. Nunca alteramos os valores
 * originais — cada linha bruta importada é preservada intacta em `raw/`.
 * Sobre essa base construímos uma camada "tratada" (FactRow) que reconhece
 * dimensões e métricas conhecidas por similaridade semântica de nome
 * (ver lib/mapping) e guarda tudo o que não foi reconhecido dentro de
 * `extras`, para que nenhuma informação da planilha seja descartada.
 */

/** Papel semântico de uma aba dentro do modelo de negócio do Roldão. */
export type SheetRole =
  | 'ORCADO_LOJA_DIA' // ORÇADO — orçamento diário por loja (mês corrente)
  | 'ORCADO_DIA' // Orçado dia — pivot: meta por loja em um dia + total por subcategoria
  | 'ORCADO_DIA_SUBCATEGORIA' // Orçado dia subcategoria
  | 'ORCADO_CATEGORIA' // Orçado de categoria — orçamento diário por loja x subcategoria
  | 'VENDAS_EXECUTIVO' // Vendas — painel mestre: venda, meta, aa%, canais, clientes, ticket
  | 'BASE_TELE_ECOMM' // BASE TELE E ECOMM — televendas/ecommerce diário e acumulado por loja
  | 'PISO' // Piso — piso de loja, acumulado, clientes, ticket, canais
  | 'BASE_VENDA_ACUMULADO' // BESE VENDA ACUMULADO — venda/clientes/ticket acumulados 2026x2025
  | 'BASE_VENDA_DIA' // BASE VENDA DIA — idem, mas do dia
  | 'BASE_DIARIA_LOJA' // base — fato diário granular por loja (+ canal)
  | 'SUBCATEGORIA' // Subcategoria — pivot venda bruta por subcategoria, ano x ano
  | 'SEGMENTO' // Segmento — pivot venda bruta por segmento, ano x ano
  | 'VENDA_POR_SEGMENTO' // Venda por Segmento — pivot venda (valor) por segmento
  | 'BASE_SEGMENTO' // Base Segmento — fato diário granular por segmento/seção x loja
  | 'BASE_SUBCATEGORIA' // Base de Subcategoria — fato diário granular por subcategoria x loja
  | 'BASE_LOJA' // Base loja — cadastro/dimensão de lojas
  | 'BASE_NOVA_REGIONAL' // Base nova regional — mapa loja -> regional vigente
  | 'PROCV_CATEGORIA' // Procv categoria — tabela de correspondência categoria/segmento/subcategoria
  | 'OUTRA'; // qualquer aba não reconhecida — ainda assim 100% importada

export type CanonicalField =
  // dimensões
  | 'empresa'
  | 'regional'
  | 'loja_codigo'
  | 'loja_nome'
  | 'categoria'
  | 'segmento'
  | 'subcategoria'
  | 'canal'
  | 'data'
  | 'ano'
  | 'mes'
  | 'dia'
  // métricas
  | 'venda_bruta'
  | 'venda_liquida'
  | 'orcamento'
  | 'venda_ano_anterior'
  | 'piso'
  | 'margem'
  | 'clientes'
  | 'ticket_medio'
  | 'crescimento_pct' // % vs ano anterior já calculado na própria planilha
  | 'atingimento_pct' // % vs orçamento já calculado na própria planilha
  | 'participacao_pct';

export interface ColumnMapping {
  originalHeader: string;
  field: CanonicalField | null;
  confidence: number; // 0..1
  sample?: string;
}

/** Uma linha de fato normalizada, no "grão" mais fino que a aba permitir. */
export interface FactRow {
  id: string;
  importId: string;
  sheetName: string;
  sheetRole: SheetRole;
  blockIndex: number; // sheets com múltiplos blocos lado a lado (ex.: "base")
  rowIndex: number; // posição na aba de origem, para auditoria

  // dimensões reconhecidas (undefined = não disponível nesta linha/aba)
  empresa?: string;
  regional?: string;
  loja_codigo?: string;
  loja_nome?: string;
  categoria?: string;
  segmento?: string;
  subcategoria?: string;
  canal?: string;
  data?: string; // ISO yyyy-mm-dd
  ano?: number;
  mes?: number;
  dia?: number;

  // métricas reconhecidas
  venda_bruta?: number;
  venda_liquida?: number;
  orcamento?: number;
  venda_ano_anterior?: number;
  piso?: number;
  margem?: number;
  clientes?: number;
  ticket_medio?: number;
  crescimento_pct?: number;
  atingimento_pct?: number;
  participacao_pct?: number;

  /** Tudo que não foi mapeado para um campo canônico — nada é descartado. */
  extras: Record<string, string | number | null>;
}

export interface SheetImportReport {
  sheetName: string;
  role: SheetRole;
  roleConfidence: number;
  blocks: number;
  headerRow: number;
  totalRows: number;
  validRows: number;
  errorRows: number;
  mappedColumns: ColumnMapping[];
  unmappedColumns: string[];
  warnings: string[];
}

export interface ImportRecord {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  importedAt: string; // ISO datetime
  importedBy: string;
  status: 'processando' | 'concluida' | 'concluida_com_avisos' | 'erro';
  sheets: SheetImportReport[];
  totalRecords: number;
  validRecords: number;
  errorRecords: number;
  periodoInicio: string | null;
  periodoFim: string | null;
  lojasIdentificadas: number;
  regionaisIdentificadas: number;
  categoriasIdentificadas: number;
  segmentosIdentificados: number;
  subcategoriasIdentificadas: number;
  errorMessage?: string;
  isActive: boolean;
}

export interface Registry {
  imports: ImportRecord[];
  activeImportId: string | null;
}

/** Opções disponíveis para os filtros globais, derivadas da base ativa. */
export interface DimensionOptions {
  empresas: string[];
  regionais: string[];
  lojas: { codigo: string; nome: string; regional: string | null; empresa: string | null }[];
  categorias: string[];
  segmentos: string[];
  subcategorias: string[];
  canais: string[];
  anos: number[];
  periodoMin: string | null;
  periodoMax: string | null;
}

export interface GlobalFilters {
  periodoInicio?: string;
  periodoFim?: string;
  ano?: number;
  mes?: number;
  dia?: number;
  loja?: string[];
  regional?: string[];
  empresa?: string[];
  categoria?: string[];
  segmento?: string[];
  subcategoria?: string[];
  canal?: string[];
}

/** Marca a origem de um indicador: dado oficial da planilha vs. calculado pelo BI. */
export type IndicatorSource = 'planilha' | 'calculado' | 'indisponivel';

export interface Indicator {
  value: number | null;
  source: IndicatorSource;
  label: string;
  formula?: string;
}
