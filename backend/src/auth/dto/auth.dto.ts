import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  senha: string;
}

export class RegistrarDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nome_loja: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  slug: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nome_admin: string;

  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72)
  senha: string;
}
