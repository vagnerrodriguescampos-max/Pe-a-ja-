import { MigrationInterface, QueryRunner } from 'typeorm';

export class LogisticaIA1700000000003 implements MigrationInterface {
  name = 'LogisticaIA1700000000003';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Motoboy no pedido
    await queryRunner.query(`
      ALTER TABLE "pedido"
        ADD COLUMN IF NOT EXISTS "motoboy_id" uuid REFERENCES "usuario"("id") ON DELETE SET NULL
    `);

    // Rastreamento GPS do motoboy
    await queryRunner.query(`
      CREATE TABLE "rastreamento_motoboy" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "pedido_id" uuid NOT NULL,
        "motoboy_id" uuid NOT NULL,
        "lat" numeric(10,7) NOT NULL,
        "lng" numeric(10,7) NOT NULL,
        "criado_em" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rastreamento_motoboy" PRIMARY KEY ("id"),
        CONSTRAINT "FK_rastreamento_pedido" FOREIGN KEY ("pedido_id") REFERENCES "pedido"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_rastreamento_motoboy" FOREIGN KEY ("motoboy_id") REFERENCES "usuario"("id") ON DELETE CASCADE
      )
    `);

    // Configuração IA por loja
    await queryRunner.query(`
      CREATE TABLE "config_ia" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "loja_id" uuid NOT NULL,
        "habilitada" boolean NOT NULL DEFAULT false,
        "nome_ia" varchar(50) NOT NULL DEFAULT 'Assistente',
        "sistema_prompt_extra" text,
        "modelo" varchar(50) NOT NULL DEFAULT 'claude-haiku-4-5-20251001',
        "delay_resposta_seg" integer NOT NULL DEFAULT 3,
        "criado_em" timestamptz NOT NULL DEFAULT now(),
        "atualizado_em" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_config_ia" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_config_ia_loja" UNIQUE ("loja_id"),
        CONSTRAINT "FK_config_ia_loja" FOREIGN KEY ("loja_id") REFERENCES "loja"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_rastreamento_pedido" ON "rastreamento_motoboy" ("pedido_id", "criado_em" DESC)`);
    await queryRunner.query(`CREATE INDEX "IDX_pedido_motoboy" ON "pedido" ("motoboy_id") WHERE "motoboy_id" IS NOT NULL`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "config_ia"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rastreamento_motoboy"`);
    await queryRunner.query(`ALTER TABLE "pedido" DROP COLUMN IF EXISTS "motoboy_id"`);
  }
}
