import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChatERelatorios1700000000001 implements MigrationInterface {
  name = 'ChatERelatorios1700000000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "conversa" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "loja_id" uuid NOT NULL,
        "cliente_id" uuid NOT NULL,
        "atendente_id" uuid,
        "status" varchar(20) NOT NULL DEFAULT 'aberta'
          CHECK ("status" IN ('aberta','em_atendimento','resolvida')),
        "nao_lidas" integer NOT NULL DEFAULT 0,
        "ultima_mensagem_em" timestamptz,
        "criada_em" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_conversa" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_conversa_cliente_loja" UNIQUE ("loja_id", "cliente_id"),
        CONSTRAINT "FK_conversa_loja" FOREIGN KEY ("loja_id") REFERENCES "loja"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_conversa_cliente" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_conversa_atendente" FOREIGN KEY ("atendente_id") REFERENCES "usuario"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "mensagem" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "conversa_id" uuid NOT NULL,
        "pedido_id" uuid,
        "autor_tipo" varchar(20) NOT NULL
          CHECK ("autor_tipo" IN ('cliente','atendente','ia','sistema')),
        "autor_id" uuid,
        "conteudo" text NOT NULL,
        "tipo" varchar(10) NOT NULL DEFAULT 'texto'
          CHECK ("tipo" IN ('texto','imagem')),
        "url_anexo" varchar(500),
        "lida" boolean NOT NULL DEFAULT false,
        "criada_em" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_mensagem" PRIMARY KEY ("id"),
        CONSTRAINT "FK_mensagem_conversa" FOREIGN KEY ("conversa_id") REFERENCES "conversa"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_mensagem_pedido" FOREIGN KEY ("pedido_id") REFERENCES "pedido"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`CREATE INDEX "IDX_conversa_loja_ultima_msg" ON "conversa" ("loja_id", "ultima_mensagem_em" DESC)`);
    await queryRunner.query(`CREATE INDEX "IDX_mensagem_conversa_criada" ON "mensagem" ("conversa_id", "criada_em")`);
    await queryRunner.query(`CREATE INDEX "IDX_mensagem_criada" ON "mensagem" ("criada_em")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "mensagem"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "conversa"`);
  }
}
