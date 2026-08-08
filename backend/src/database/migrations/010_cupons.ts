import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cupons de desconto.
 *
 * `cupom_uso` existe separada do contador `usos` de propósito: o contador resolve o
 * limite total com uma leitura barata, enquanto a tabela guarda quem usou o quê — é ela
 * que permite o limite por cliente e o relatório de resgates.
 *
 * O pedido guarda cupom_id + desconto_cupom para o histórico continuar correto mesmo
 * que o cupom seja editado ou desativado depois.
 */
export class Cupons1700000000009 implements MigrationInterface {
  name = 'Cupons1700000000009';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cupom" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "loja_id" uuid NOT NULL REFERENCES "loja"("id") ON DELETE CASCADE,
        "codigo" varchar(30) NOT NULL,
        "descricao" varchar(150),
        "tipo_desconto" varchar(20) NOT NULL DEFAULT 'percentual',
        "valor" numeric(10,2) NOT NULL,
        "desconto_maximo" numeric(10,2),
        "pedido_minimo" numeric(10,2) NOT NULL DEFAULT 0,
        "regra" varchar(20) NOT NULL DEFAULT 'geral',
        "valido_de" date,
        "valido_ate" date,
        "limite_uso_total" int,
        "limite_uso_por_cliente" int NOT NULL DEFAULT 1,
        "usos" int NOT NULL DEFAULT 0,
        "ativo" boolean NOT NULL DEFAULT true,
        "criado_em" timestamptz NOT NULL DEFAULT now()
      )
    `);

    // Um código não pode se repetir dentro da mesma loja, mas lojas diferentes podem
    // ter o mesmo "PRIMEIRACOMPRA".
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_cupom_loja_codigo"
      ON "cupom" ("loja_id", "codigo")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cupom_uso" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "cupom_id" uuid NOT NULL REFERENCES "cupom"("id") ON DELETE CASCADE,
        "cliente_id" uuid NOT NULL REFERENCES "cliente"("id") ON DELETE CASCADE,
        "pedido_id" uuid REFERENCES "pedido"("id") ON DELETE SET NULL,
        "valor_desconto" numeric(10,2) NOT NULL,
        "criado_em" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cupom_uso_cupom_cliente"
      ON "cupom_uso" ("cupom_id", "cliente_id")
    `);

    await queryRunner.query(`ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "cupom_id" uuid`);
    await queryRunner.query(`ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "desconto_cupom" numeric(10,2) NOT NULL DEFAULT 0`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pedido" DROP COLUMN IF EXISTS "desconto_cupom"`);
    await queryRunner.query(`ALTER TABLE "pedido" DROP COLUMN IF EXISTS "cupom_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cupom_uso"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cupom"`);
  }
}
