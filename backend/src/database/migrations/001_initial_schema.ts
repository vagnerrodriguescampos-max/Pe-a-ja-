import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "loja" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "nome" varchar(255) NOT NULL,
        "slug" varchar(100) NOT NULL UNIQUE,
        "logo_url" varchar(500),
        "cor_primaria" varchar(7) NOT NULL DEFAULT '#FF6B00',
        "telefone" varchar(20),
        "endereco" varchar(500),
        "chave_pix" varchar(255),
        "tipo_chave_pix" varchar(20) CHECK ("tipo_chave_pix" IN ('cpf','cnpj','email','telefone','aleatoria')),
        "aberta" boolean NOT NULL DEFAULT false,
        "prazo_medio_min" integer NOT NULL DEFAULT 40,
        "mensagem_topo" varchar(500),
        "taxa_entrega_padrao" decimal(10,2) NOT NULL DEFAULT 0,
        "pedido_minimo" decimal(10,2) NOT NULL DEFAULT 0,
        "criado_em" timestamptz NOT NULL DEFAULT now(),
        "atualizado_em" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_loja" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "usuario" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "loja_id" uuid NOT NULL,
        "nome" varchar(255) NOT NULL,
        "email" varchar(255) NOT NULL,
        "senha_hash" varchar(255) NOT NULL,
        "papel" varchar(20) NOT NULL DEFAULT 'atendente' CHECK ("papel" IN ('super_admin','admin_loja','atendente','motoboy')),
        "ativo" boolean NOT NULL DEFAULT true,
        "criado_em" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_usuario" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_usuario_email_loja" UNIQUE ("email", "loja_id"),
        CONSTRAINT "FK_usuario_loja" FOREIGN KEY ("loja_id") REFERENCES "loja"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "categoria" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "loja_id" uuid NOT NULL,
        "nome" varchar(255) NOT NULL,
        "ordem" integer NOT NULL DEFAULT 0,
        "ativa" boolean NOT NULL DEFAULT true,
        "criado_em" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_categoria" PRIMARY KEY ("id"),
        CONSTRAINT "FK_categoria_loja" FOREIGN KEY ("loja_id") REFERENCES "loja"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "produto" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "loja_id" uuid NOT NULL,
        "categoria_id" uuid NOT NULL,
        "nome" varchar(255) NOT NULL,
        "descricao" text,
        "preco" decimal(10,2) NOT NULL,
        "preco_promocional" decimal(10,2),
        "imagem_url" varchar(500),
        "tempo_preparo_min" integer,
        "status" varchar(20) NOT NULL DEFAULT 'ativo' CHECK ("status" IN ('ativo','inativo','esgotado')),
        "destaque" boolean NOT NULL DEFAULT false,
        "ordem" integer NOT NULL DEFAULT 0,
        "criado_em" timestamptz NOT NULL DEFAULT now(),
        "atualizado_em" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_produto" PRIMARY KEY ("id"),
        CONSTRAINT "FK_produto_loja" FOREIGN KEY ("loja_id") REFERENCES "loja"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_produto_categoria" FOREIGN KEY ("categoria_id") REFERENCES "categoria"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "grupo_opcao" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "produto_id" uuid NOT NULL,
        "nome" varchar(255) NOT NULL,
        "tipo" varchar(10) NOT NULL DEFAULT 'unico' CHECK ("tipo" IN ('unico','multiplo')),
        "obrigatorio" boolean NOT NULL DEFAULT false,
        "min" integer NOT NULL DEFAULT 0,
        "max" integer,
        "ordem" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_grupo_opcao" PRIMARY KEY ("id"),
        CONSTRAINT "FK_grupo_opcao_produto" FOREIGN KEY ("produto_id") REFERENCES "produto"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "opcao" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "grupo_opcao_id" uuid NOT NULL,
        "nome" varchar(255) NOT NULL,
        "preco_adicional" decimal(10,2) NOT NULL DEFAULT 0,
        "ativa" boolean NOT NULL DEFAULT true,
        "ordem" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_opcao" PRIMARY KEY ("id"),
        CONSTRAINT "FK_opcao_grupo" FOREIGN KEY ("grupo_opcao_id") REFERENCES "grupo_opcao"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "cliente" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "loja_id" uuid NOT NULL,
        "nome" varchar(255) NOT NULL,
        "telefone" varchar(20) NOT NULL,
        "email" varchar(255),
        "data_nascimento" date,
        "criado_em" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_cliente" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_cliente_telefone_loja" UNIQUE ("telefone", "loja_id"),
        CONSTRAINT "FK_cliente_loja" FOREIGN KEY ("loja_id") REFERENCES "loja"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "endereco" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "cliente_id" uuid NOT NULL,
        "rua" varchar(255) NOT NULL,
        "numero" varchar(20) NOT NULL,
        "complemento" varchar(100),
        "bairro" varchar(100) NOT NULL,
        "cidade" varchar(100) NOT NULL,
        "referencia" varchar(255),
        "lat" decimal(10,7),
        "lng" decimal(10,7),
        "criado_em" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_endereco" PRIMARY KEY ("id"),
        CONSTRAINT "FK_endereco_cliente" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "pedido" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "loja_id" uuid NOT NULL,
        "cliente_id" uuid NOT NULL,
        "numero_sequencial" integer NOT NULL,
        "tipo" varchar(10) NOT NULL DEFAULT 'entrega' CHECK ("tipo" IN ('entrega','retirada')),
        "status" varchar(30) NOT NULL DEFAULT 'recebido' CHECK ("status" IN ('recebido','confirmado','em_producao','pronto','saiu_para_entrega','entregue','cancelado')),
        "subtotal" decimal(10,2) NOT NULL,
        "taxa_entrega" decimal(10,2) NOT NULL DEFAULT 0,
        "desconto" decimal(10,2) NOT NULL DEFAULT 0,
        "total" decimal(10,2) NOT NULL,
        "forma_pagamento" varchar(20) NOT NULL CHECK ("forma_pagamento" IN ('dinheiro','cartao_debito','cartao_credito','pix')),
        "troco_para" decimal(10,2),
        "observacoes" text,
        "endereco_entrega" jsonb,
        "criado_em" timestamptz NOT NULL DEFAULT now(),
        "atualizado_em" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pedido" PRIMARY KEY ("id"),
        CONSTRAINT "FK_pedido_loja" FOREIGN KEY ("loja_id") REFERENCES "loja"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_pedido_cliente" FOREIGN KEY ("cliente_id") REFERENCES "cliente"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE SEQUENCE IF NOT EXISTS pedido_numero_seq START 1;
    `);

    await queryRunner.query(`
      CREATE TABLE "pedido_item" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "pedido_id" uuid NOT NULL,
        "produto_id" uuid,
        "nome_snapshot" varchar(255) NOT NULL,
        "preco_unitario" decimal(10,2) NOT NULL,
        "quantidade" integer NOT NULL DEFAULT 1,
        "observacao" text,
        CONSTRAINT "PK_pedido_item" PRIMARY KEY ("id"),
        CONSTRAINT "FK_pedido_item_pedido" FOREIGN KEY ("pedido_id") REFERENCES "pedido"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_pedido_item_produto" FOREIGN KEY ("produto_id") REFERENCES "produto"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "pedido_item_opcao" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "pedido_item_id" uuid NOT NULL,
        "opcao_id" uuid,
        "nome_snapshot" varchar(255) NOT NULL,
        "preco_adicional_snapshot" decimal(10,2) NOT NULL DEFAULT 0,
        CONSTRAINT "PK_pedido_item_opcao" PRIMARY KEY ("id"),
        CONSTRAINT "FK_pedido_item_opcao_item" FOREIGN KEY ("pedido_item_id") REFERENCES "pedido_item"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_pedido_item_opcao_opcao" FOREIGN KEY ("opcao_id") REFERENCES "opcao"("id") ON DELETE SET NULL
      )
    `);

    // Índices para performance
    await queryRunner.query(`CREATE INDEX "IDX_produto_loja_status" ON "produto" ("loja_id", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_pedido_loja_status" ON "pedido" ("loja_id", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_pedido_loja_criado" ON "pedido" ("loja_id", "criado_em" DESC)`);
    await queryRunner.query(`CREATE INDEX "IDX_cliente_loja_telefone" ON "cliente" ("loja_id", "telefone")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "pedido_item_opcao"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pedido_item"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pedido"`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS pedido_numero_seq`);
    await queryRunner.query(`DROP TABLE IF EXISTS "endereco"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cliente"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "opcao"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "grupo_opcao"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "produto"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "categoria"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "usuario"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "loja"`);
  }
}
