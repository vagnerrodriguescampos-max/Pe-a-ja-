import { MigrationInterface, QueryRunner } from 'typeorm';

export class Fidelizacao1700000000002 implements MigrationInterface {
  name = 'Fidelizacao1700000000002';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Configuração de fidelização por loja
    await queryRunner.query(`
      CREATE TABLE "config_fidelizacao" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "loja_id" uuid NOT NULL,
        "cashback_percentual" numeric(5,2) NOT NULL DEFAULT 5,
        "meta_selos" integer NOT NULL DEFAULT 10,
        "recompensa_tipo" varchar(20) NOT NULL DEFAULT 'desconto'
          CHECK ("recompensa_tipo" IN ('desconto','item_gratis')),
        "recompensa_valor" numeric(10,2) NOT NULL DEFAULT 10,
        "vip_prata_gasto" numeric(10,2) NOT NULL DEFAULT 200,
        "vip_ouro_gasto" numeric(10,2) NOT NULL DEFAULT 500,
        "vip_cashback_extra" numeric(5,2) NOT NULL DEFAULT 2,
        "ativo" boolean NOT NULL DEFAULT true,
        "criado_em" timestamptz NOT NULL DEFAULT now(),
        "atualizado_em" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_config_fidelizacao" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_config_fidelizacao_loja" UNIQUE ("loja_id"),
        CONSTRAINT "FK_config_fidelizacao_loja" FOREIGN KEY ("loja_id") REFERENCES "loja"("id") ON DELETE CASCADE
      )
    `);

    // Carteira interna por cliente/loja
    await queryRunner.query(`
      CREATE TABLE "carteira" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "loja_id" uuid NOT NULL,
        "cliente_id" uuid NOT NULL,
        "saldo" numeric(10,2) NOT NULL DEFAULT 0,
        "criado_em" timestamptz NOT NULL DEFAULT now(),
        "atualizado_em" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_carteira" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_carteira_cliente_loja" UNIQUE ("loja_id", "cliente_id"),
        CONSTRAINT "FK_carteira_loja" FOREIGN KEY ("loja_id") REFERENCES "loja"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_carteira_cliente" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE CASCADE
      )
    `);

    // Histórico de transações da carteira
    await queryRunner.query(`
      CREATE TABLE "transacao_carteira" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "carteira_id" uuid NOT NULL,
        "tipo" varchar(10) NOT NULL CHECK ("tipo" IN ('credito','debito')),
        "valor" numeric(10,2) NOT NULL,
        "descricao" varchar(200) NOT NULL,
        "pedido_id" uuid,
        "criado_em" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_transacao_carteira" PRIMARY KEY ("id"),
        CONSTRAINT "FK_transacao_carteira" FOREIGN KEY ("carteira_id") REFERENCES "carteira"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_transacao_pedido" FOREIGN KEY ("pedido_id") REFERENCES "pedido"("id") ON DELETE SET NULL
      )
    `);

    // Cartão de fidelidade (selos)
    await queryRunner.query(`
      CREATE TABLE "cartao_fidelidade" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "loja_id" uuid NOT NULL,
        "cliente_id" uuid NOT NULL,
        "selos_atuais" integer NOT NULL DEFAULT 0,
        "total_recompensas" integer NOT NULL DEFAULT 0,
        "criado_em" timestamptz NOT NULL DEFAULT now(),
        "atualizado_em" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_cartao_fidelidade" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_cartao_fidelidade_cliente_loja" UNIQUE ("loja_id", "cliente_id"),
        CONSTRAINT "FK_cartao_fidelidade_loja" FOREIGN KEY ("loja_id") REFERENCES "loja"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_cartao_fidelidade_cliente" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE CASCADE
      )
    `);

    // Campanhas de marketing automatizado
    await queryRunner.query(`
      CREATE TABLE "campanha_marketing" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "loja_id" uuid NOT NULL,
        "tipo" varchar(30) NOT NULL
          CHECK ("tipo" IN ('recompra','aniversario','boas_vindas')),
        "mensagem" text NOT NULL,
        "ativa" boolean NOT NULL DEFAULT true,
        "dias_sem_compra" integer DEFAULT 7,
        "criado_em" timestamptz NOT NULL DEFAULT now(),
        "atualizado_em" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_campanha_marketing" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_campanha_loja_tipo" UNIQUE ("loja_id", "tipo"),
        CONSTRAINT "FK_campanha_loja" FOREIGN KEY ("loja_id") REFERENCES "loja"("id") ON DELETE CASCADE
      )
    `);

    // Log de envio de campanhas (evitar envio duplicado)
    await queryRunner.query(`
      CREATE TABLE "log_campanha" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "campanha_id" uuid NOT NULL,
        "cliente_id" uuid NOT NULL,
        "enviado_em" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_log_campanha" PRIMARY KEY ("id"),
        CONSTRAINT "FK_log_campanha_campanha" FOREIGN KEY ("campanha_id") REFERENCES "campanha_marketing"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_log_campanha_cliente" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE CASCADE
      )
    `);

    // Coluna aniversario no cliente
    await queryRunner.query(`ALTER TABLE "cliente" ADD COLUMN IF NOT EXISTS "data_nascimento" date`);

    await queryRunner.query(`CREATE INDEX "IDX_carteira_cliente" ON "carteira" ("loja_id", "cliente_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_transacao_carteira" ON "transacao_carteira" ("carteira_id", "criado_em" DESC)`);
    await queryRunner.query(`CREATE INDEX "IDX_log_campanha" ON "log_campanha" ("campanha_id", "cliente_id", "enviado_em" DESC)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "log_campanha"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "campanha_marketing"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cartao_fidelidade"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "transacao_carteira"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "carteira"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "config_fidelizacao"`);
    await queryRunner.query(`ALTER TABLE "cliente" DROP COLUMN IF EXISTS "data_nascimento"`);
  }
}
