import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const TIPOS_PEDIDO = ['entrega', 'retirada'] as const;
const FORMAS_PAGAMENTO = ['dinheiro', 'cartao_debito', 'cartao_credito', 'pix'] as const;

export class ClientePedidoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nome: string;

  @IsString()
  @Matches(/^\+?[\d\s().-]{8,25}$/)
  telefone: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  // Formato ISO (YYYY-MM-DD) para casar com a coluna `date` sem depender do fuso do
  // navegador. É o que permite disparar cupom de aniversário depois.
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data de nascimento inválida' })
  data_nascimento?: string;
}

export class EnderecoPedidoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  rua: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  numero: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  complemento?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  bairro: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  cidade: string;

  // Vêm preenchidos pela busca de CEP; opcionais para não quebrar quem digita o
  // endereço manualmente quando o CEP não é encontrado.
  @IsOptional()
  @IsString()
  @MaxLength(2)
  estado?: string;

  @IsOptional()
  @Matches(/^\d{5}-?\d{3}$/, { message: 'CEP inválido' })
  cep?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  referencia?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-180)
  @Max(180)
  lng?: number;
}

export class PedidoOpcaoDto {
  @IsUUID()
  opcao_id: string;
}

export class PedidoItemDto {
  @IsUUID()
  produto_id: string;

  @IsInt()
  @Min(1)
  @Max(50)
  quantidade: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacao?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => PedidoOpcaoDto)
  opcoes?: PedidoOpcaoDto[];
}

export class CriarPedidoDto {
  @IsIn(TIPOS_PEDIDO)
  tipo: (typeof TIPOS_PEDIDO)[number];

  @IsIn(FORMAS_PAGAMENTO)
  forma_pagamento: (typeof FORMAS_PAGAMENTO)[number];

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100000)
  troco_para?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacoes?: string;

  @IsOptional()
  @IsBoolean()
  usar_carteira?: boolean;

  @IsOptional()
  @IsUUID()
  cliente_id_fidelizacao?: string;

  @ValidateNested()
  @Type(() => ClientePedidoDto)
  cliente: ClientePedidoDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => EnderecoPedidoDto)
  endereco?: EnderecoPedidoDto;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => PedidoItemDto)
  itens: PedidoItemDto[];
}

export class AtualizarStatusPedidoDto {
  @IsIn(['confirmado', 'em_producao', 'pronto', 'saiu_para_entrega', 'entregue', 'cancelado'])
  status: string;
}
