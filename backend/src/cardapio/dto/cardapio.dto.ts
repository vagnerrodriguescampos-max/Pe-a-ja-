import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const STATUS_PRODUTO = ['ativo', 'inativo', 'esgotado'] as const;
const TIPOS_GRUPO = ['unico', 'multiplo'] as const;

export class CriarCategoriaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nome: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  ordem?: number;

  @IsOptional()
  @IsBoolean()
  ativa?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  foto_url?: string;
}

export class AtualizarCategoriaDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nome?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  ordem?: number;

  @IsOptional()
  @IsBoolean()
  ativa?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  foto_url?: string;
}

export class CriarProdutoDto {
  @IsUUID()
  categoria_id: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  nome: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descricao?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100000)
  preco: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100000)
  preco_promocional?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imagem_url?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  tempo_preparo_min?: number;

  @IsOptional()
  @IsIn(STATUS_PRODUTO)
  status?: (typeof STATUS_PRODUTO)[number];

  @IsOptional()
  @IsBoolean()
  destaque?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  ordem?: number;
}

export class AtualizarProdutoDto {
  @IsOptional()
  @IsUUID()
  categoria_id?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  nome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descricao?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100000)
  preco?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100000)
  preco_promocional?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imagem_url?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  tempo_preparo_min?: number;

  @IsOptional()
  @IsIn(STATUS_PRODUTO)
  status?: (typeof STATUS_PRODUTO)[number];

  @IsOptional()
  @IsBoolean()
  destaque?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  ordem?: number;
}

export class CriarGrupoOpcaoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nome: string;

  @IsOptional()
  @IsIn(TIPOS_GRUPO)
  tipo?: (typeof TIPOS_GRUPO)[number];

  @IsOptional()
  @IsBoolean()
  obrigatorio?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  min?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  max?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  ordem?: number;
}

export class AtualizarGrupoOpcaoDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nome?: string;

  @IsOptional()
  @IsIn(TIPOS_GRUPO)
  tipo?: (typeof TIPOS_GRUPO)[number];

  @IsOptional()
  @IsBoolean()
  obrigatorio?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(30)
  min?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  max?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  ordem?: number;
}

export class CriarOpcaoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nome: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100000)
  preco_adicional?: number;

  @IsOptional()
  @IsBoolean()
  ativa?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  ordem?: number;
}

export class AtualizarOpcaoDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nome?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100000)
  preco_adicional?: number;

  @IsOptional()
  @IsBoolean()
  ativa?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  ordem?: number;
}
