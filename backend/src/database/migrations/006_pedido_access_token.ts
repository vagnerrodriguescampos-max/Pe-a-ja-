import { MigrationInterface, QueryRunner } from 'typeorm';

export class PedidoAccessToken1700000000005 implements MigrationInterface {
  name = 'PedidoAccessToken1700000000005';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "token_acesso" varchar(64)`);

    // Backfill existing orders before making the public capability token mandatory.
    await queryRunner.query(`
      UPDATE "pedido"
      SET "token_acesso" = lower(
        replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
      )
      WHERE "token_acesso" IS NULL
    `);

    await queryRunner.query(`ALTER TABLE "pedido" ALTER COLUMN "token_acesso" SET NOT NULL`);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'UQ_pedido_token_acesso'
        ) THEN
          ALTER TABLE "pedido"
            ADD CONSTRAINT "UQ_pedido_token_acesso" UNIQUE ("token_acesso");
        END IF;
      END $$;
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pedido" DROP CONSTRAINT IF EXISTS "UQ_pedido_token_acesso"`);
    await queryRunner.query(`ALTER TABLE "pedido" DROP COLUMN IF EXISTS "token_acesso"`);
  }
}
