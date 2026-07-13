import { MigrationInterface, QueryRunner } from 'typeorm';

export class PushSubscriptions1700000000004 implements MigrationInterface {
  name = 'PushSubscriptions1700000000004';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "push_subscription" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "loja_id" uuid NOT NULL,
        "endpoint" text NOT NULL,
        "p256dh" text NOT NULL,
        "auth" text NOT NULL,
        "user_agent" varchar(300),
        "criado_em" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_push_subscription" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_push_loja_endpoint" UNIQUE ("loja_id", "endpoint"),
        CONSTRAINT "FK_push_loja" FOREIGN KEY ("loja_id") REFERENCES "loja"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_push_loja" ON "push_subscription" ("loja_id")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "push_subscription"`);
  }
}
