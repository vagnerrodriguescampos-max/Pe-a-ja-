import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ConectarWhatsappDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  waba_id: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  phone_number_id: string;
}
