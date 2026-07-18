import { IsBoolean, IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

// O admin da loja só pode criar estes perfis — super_admin fica reservado ao sistema.
export const PAPEIS_GERENCIAVEIS = ['admin_loja', 'atendente', 'motoboy'] as const;

export class CriarUsuarioDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  nome: string;

  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(6, { message: 'A senha deve ter pelo menos 6 caracteres' })
  @MaxLength(100)
  senha: string;

  @IsIn(PAPEIS_GERENCIAVEIS, { message: 'Perfil inválido' })
  papel: string;
}

export class AtualizarUsuarioDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  nome?: string;

  @IsOptional()
  @IsIn(PAPEIS_GERENCIAVEIS, { message: 'Perfil inválido' })
  papel?: string;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'A senha deve ter pelo menos 6 caracteres' })
  @MaxLength(100)
  senha?: string;
}
