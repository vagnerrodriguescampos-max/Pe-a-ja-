import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

const TIPOS_DESCONTO = ['percentual', 'valor'] as const;
const REGRAS = ['geral', 'primeira_compra', 'aniversario'] as const;

export class CriarCupomDto {
  // Só letras, números, hífen e underscore: o cliente digita esse código na mão, então
  // espaço e acento só geram erro de digitação.
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{3,30}$/, {
    message: 'Código deve ter de 3 a 30 caracteres, sem espaços ou acentos',
  })
  codigo: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  descricao?: string;

  @IsIn(TIPOS_DESCONTO)
  tipo_desconto: 'percentual' | 'valor';

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valor: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  desconto_maximo?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  pedido_minimo?: number;

  @IsIn(REGRAS)
  regra: 'geral' | 'primeira_compra' | 'aniversario';

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data inicial inválida' })
  valido_de?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Data final inválida' })
  valido_ate?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  limite_uso_total?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  limite_uso_por_cliente?: number;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

export class AtualizarCupomDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{3,30}$/)
  codigo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  descricao?: string;

  @IsOptional()
  @IsIn(TIPOS_DESCONTO)
  tipo_desconto?: 'percentual' | 'valor';

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  valor?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  desconto_maximo?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  pedido_minimo?: number;

  @IsOptional()
  @IsIn(REGRAS)
  regra?: 'geral' | 'primeira_compra' | 'aniversario';

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  valido_de?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  valido_ate?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  limite_uso_total?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  limite_uso_por_cliente?: number;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

export class ValidarCupomDto {
  @IsString()
  @MaxLength(30)
  codigo: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  subtotal: number;

  @IsOptional()
  @IsString()
  @MaxLength(25)
  telefone?: string;
}
