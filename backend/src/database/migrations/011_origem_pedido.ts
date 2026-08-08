import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Origem do pedido (de onde veio o cliente).
 *
 * Preenchida pelo parâmetro `?origem=` do link de divulgação — cada canal (Instagram,
 * panfleto, QR na mesa) ganha o seu, e o dono da loja passa a saber qual divulgação
 * realmente traz pedido em vez de decidir no achismo.
 *
 * Guardada como texto livre curto em vez de tabela própria: o lojista cria canais na
 * hora, e uma FK aqui só criaria atrito sem melhorar o relatório.
 */
export class OrigemPedido1700000000010 implements MigrationInterface {
  name = 'OrigemPedido1700000000010';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pedido" ADD COLUMN IF NOT EXISTS "origem" varchar(50)`);
    // O relatório sempre filtra por loja + período e agrupa por origem.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_pedido_loja_origem"
      ON "pedido" ("loja_id", "origem")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_pedido_loja_origem"`);
    await queryRunner.query(`ALTER TABLE "pedido" DROP COLUMN IF EXISTS "origem"`);
  }
}
