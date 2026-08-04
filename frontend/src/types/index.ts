export interface HorarioDia {
  dia_semana: number;
  fechado: boolean;
  abre: string;
  fecha: string;
}

export interface Loja {
  id: string;
  nome: string;
  slug: string;
  logo_url?: string;
  banner_url?: string;
  banner_tipo?: string;
  cor_primaria: string;
  telefone?: string;
  endereco?: string;
  chave_pix?: string;
  tipo_chave_pix?: string;
  aberta: boolean;
  prazo_medio_min: number;
  mensagem_topo?: string;
  taxa_entrega_padrao: number;
  pedido_minimo: number;
  horario_automatico?: boolean;
  horarios?: HorarioDia[] | null;
  onboarding_concluido?: boolean;
}

export interface Opcao {
  id: string;
  grupo_opcao_id: string;
  nome: string;
  preco_adicional: number;
  ativa: boolean;
  ordem: number;
}

export interface GrupoOpcao {
  id: string;
  produto_id: string;
  nome: string;
  tipo: 'unico' | 'multiplo';
  obrigatorio: boolean;
  min: number;
  max?: number;
  ordem: number;
  opcoes: Opcao[];
}

export interface Produto {
  id: string;
  loja_id: string;
  categoria_id: string;
  nome: string;
  descricao?: string;
  preco: number;
  preco_promocional?: number;
  imagem_url?: string;
  tempo_preparo_min?: number;
  status: 'ativo' | 'inativo' | 'esgotado';
  destaque: boolean;
  ordem: number;
  grupos_opcao: GrupoOpcao[];
}

export interface Categoria {
  id: string;
  nome: string;
  ordem: number;
  ativa: boolean;
  foto_url?: string;
  produtos: Produto[];
}

export interface ItemCarrinho {
  id: string; // uuid local
  produto_id: string;
  nome_snapshot: string;
  preco_unitario: number;
  quantidade: number;
  observacao?: string;
  opcoes: {
    grupo_id: string;
    grupo_nome: string;
    opcao_id: string;
    nome_snapshot: string;
    preco_adicional: number;
  }[];
  total: number;
}

export interface EnderecoForm {
  rua: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  referencia?: string;
}

export type FormaPagamento = 'dinheiro' | 'cartao_debito' | 'cartao_credito' | 'pix';
export type TipoPedido = 'entrega' | 'retirada';
export type StatusPedido = 'recebido' | 'confirmado' | 'em_producao' | 'pronto' | 'saiu_para_entrega' | 'entregue' | 'cancelado';

export interface Pedido {
  id: string;
  numero_sequencial: number;
  tipo: TipoPedido;
  status: StatusPedido;
  subtotal: number;
  taxa_entrega: number;
  desconto: number;
  total: number;
  forma_pagamento: FormaPagamento;
  troco_para?: number;
  observacoes?: string;
  endereco_entrega?: EnderecoForm;
  itens: PedidoItem[];
  criado_em: string;
  cliente?: { nome: string; telefone: string };
  motoboy_id?: string;
}

export interface PedidoItem {
  id: string;
  nome_snapshot: string;
  preco_unitario: number;
  quantidade: number;
  observacao?: string;
  opcoes: PedidoItemOpcao[];
}

export interface PedidoItemOpcao {
  id: string;
  nome_snapshot: string;
  preco_adicional_snapshot: number;
}
