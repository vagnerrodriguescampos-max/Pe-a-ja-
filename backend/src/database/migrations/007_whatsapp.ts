import { MigrationInterface, QueryRunner } from 'typeorm';

export class Whatsapp1700000000006 implements MigrationInterface {
  name = 'Whatsapp1700000000006';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "loja" ADD COLUMN IF NOT EXISTS "whatsapp_waba_id" varchar(64)`);
    await queryRunner.query(`ALTER TABLE "loja" ADD COLUMN IF NOT EXISTS "whatsapp_phone_number_id" varchar(64)`);
    await queryRunner.query(`ALTER TABLE "loja" ADD COLUMN IF NOT EXISTS "whatsapp_numero_display" varchar(40)`);
    await queryRunner.query(`ALTER TABLE "loja" ADD COLUMN IF NOT EXISTS "whatsapp_conectado_em" timestamptz`);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'UQ_loja_whatsapp_phone_number_id'
        ) THEN
          ALTER TABLE "loja"
            ADD CONSTRAINT "UQ_loja_whatsapp_phone_number_id" UNIQUE ("whatsapp_phone_number_id");
        END IF;
      END $$;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "loja" DROP CONSTRAINT IF EXISTS "UQ_loja_whatsapp_phone_number_id"`);
    await queryRunner.query(`ALTER TABLE "loja" DROP COLUMN IF EXISTS "whatsapp_conectado_em"`);
    await queryRunner.query(`ALTER TABLE "loja" DROP COLUMN IF EXISTS "whatsapp_numero_display"`);
    await queryRunner.query(`ALTER TABLE "loja" DROP COLUMN IF EXISTS "whatsapp_phone_number_id"`);
    await queryRunner.query(`ALTER TABLE "loja" DROP COLUMN IF EXISTS "whatsapp_waba_id"`);
  }
}
