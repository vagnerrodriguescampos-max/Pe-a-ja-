import { MigrationInterface, QueryRunner } from 'typeorm';

export class HorarioOnboarding1700000000007 implements MigrationInterface {
  name = 'HorarioOnboarding1700000000007';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "loja" ADD COLUMN IF NOT EXISTS "horario_automatico" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "loja" ADD COLUMN IF NOT EXISTS "horarios" jsonb`);
    await queryRunner.query(`ALTER TABLE "loja" ADD COLUMN IF NOT EXISTS "onboarding_concluido" boolean NOT NULL DEFAULT false`);

    // Lojas que já existem antes desta feature já passaram do onboarding — não faz
    // sentido jogar quem já usa o sistema de volta pro assistente de primeiros passos.
    await queryRunner.query(`UPDATE "loja" SET "onboarding_concluido" = true`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "loja" DROP COLUMN IF EXISTS "onboarding_concluido"`);
    await queryRunner.query(`ALTER TABLE "loja" DROP COLUMN IF EXISTS "horarios"`);
    await queryRunner.query(`ALTER TABLE "loja" DROP COLUMN IF EXISTS "horario_automatico"`);
  }
}
