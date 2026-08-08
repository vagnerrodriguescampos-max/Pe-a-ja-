import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Endereço estruturado com CEP.
 *
 * A loja tinha só um campo `endereco` de texto livre, o que impede calcular distância,
 * agrupar por bairro e preencher automático pelo CEP. Aqui ele passa a ser o logradouro
 * e ganha bairro/cidade/estado/cep ao lado. O texto antigo é preservado como está —
 * nenhuma loja perde o endereço já cadastrado.
 *
 * No endereço do cliente faltavam estado e CEP, que agora vêm prontos do ViaCEP.
 */
export class EnderecoEstruturado1700000000008 implements MigrationInterface {
  name = 'EnderecoEstruturado1700000000008';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "loja" ADD COLUMN IF NOT EXISTS "bairro" varchar(100)`);
    await queryRunner.query(`ALTER TABLE "loja" ADD COLUMN IF NOT EXISTS "cidade" varchar(100)`);
    await queryRunner.query(`ALTER TABLE "loja" ADD COLUMN IF NOT EXISTS "estado" varchar(2)`);
    await queryRunner.query(`ALTER TABLE "loja" ADD COLUMN IF NOT EXISTS "cep" varchar(9)`);

    await queryRunner.query(`ALTER TABLE "endereco" ADD COLUMN IF NOT EXISTS "estado" varchar(2)`);
    await queryRunner.query(`ALTER TABLE "endereco" ADD COLUMN IF NOT EXISTS "cep" varchar(9)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "endereco" DROP COLUMN IF EXISTS "cep"`);
    await queryRunner.query(`ALTER TABLE "endereco" DROP COLUMN IF EXISTS "estado"`);
    await queryRunner.query(`ALTER TABLE "loja" DROP COLUMN IF EXISTS "cep"`);
    await queryRunner.query(`ALTER TABLE "loja" DROP COLUMN IF EXISTS "estado"`);
    await queryRunner.query(`ALTER TABLE "loja" DROP COLUMN IF EXISTS "cidade"`);
    await queryRunner.query(`ALTER TABLE "loja" DROP COLUMN IF EXISTS "bairro"`);
  }
}
