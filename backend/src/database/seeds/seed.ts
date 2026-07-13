import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as path from 'path';

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL || 'postgresql://delivery_user:delivery_pass@localhost:5432/delivery_db',
  entities: [path.join(__dirname, '../../**/*.entity{.ts,.js}')],
  migrations: [path.join(__dirname, '../migrations/*{.ts,.js}')],
  synchronize: false,
});

async function seed() {
  await AppDataSource.initialize();
  const qr = AppDataSource.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();

  try {
    // Loja
    const [loja] = await qr.query(`
      INSERT INTO loja (nome, slug, cor_primaria, telefone, endereco, chave_pix, tipo_chave_pix,
        aberta, prazo_medio_min, mensagem_topo, taxa_entrega_padrao, pedido_minimo)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      ON CONFLICT (slug) DO UPDATE SET nome = EXCLUDED.nome
      RETURNING id
    `, [
      'Eu Pedi',
      'eu-pedi',
      '#E63946',
      '(11) 99999-0000',
      'Rua das Delícias, 100 - Centro',
      '11999990000',
      'telefone',
      true,
      30,
      'Bem-vindo ao Eu Pedi! 🛍️ Pedido mínimo R$ 25,00. Taxa de entrega a partir de R$ 5,00.',
      5.00,
      25.00,
    ]);
    const lojaId = loja.id;
    console.log('✅ Loja criada:', lojaId);

    // Admin
    const senhaHash = await bcrypt.hash('admin123', 10);
    await qr.query(`
      INSERT INTO usuario (loja_id, nome, email, senha_hash, papel)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (email, loja_id) DO NOTHING
    `, [lojaId, 'Admin', 'admin@eupedi.com', senhaHash, 'admin_loja']);
    console.log('✅ Admin criado: admin@eupedi.com / admin123');

    // Categorias
    const categorias = ['Shawarmas', 'Bebidas', 'Extras'];
    const catIds: Record<string, string> = {};
    for (let i = 0; i < categorias.length; i++) {
      const [cat] = await qr.query(`
        INSERT INTO categoria (loja_id, nome, ordem)
        VALUES ($1,$2,$3)
        ON CONFLICT DO NOTHING
        RETURNING id
      `, [lojaId, categorias[i], i]);
      if (cat) catIds[categorias[i]] = cat.id;
    }
    // Buscar ids se já existiam
    const existingCats = await qr.query(`SELECT id, nome FROM categoria WHERE loja_id = $1`, [lojaId]);
    for (const c of existingCats) catIds[c.nome] = c.id;
    console.log('✅ Categorias criadas');

    // Produto: Shawarma
    const [shawarma] = await qr.query(`
      INSERT INTO produto (loja_id, categoria_id, nome, descricao, preco, destaque, ordem)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT DO NOTHING
      RETURNING id
    `, [
      lojaId,
      catIds['Shawarmas'],
      'Shawarma',
      'Shawarma artesanal no pão sírio. Escolha o sabor e personalize com adicionais.',
      22.00,
      true,
      0,
    ]);
    let shawarmaId: string;
    if (shawarma) {
      shawarmaId = shawarma.id;
    } else {
      const [existing] = await qr.query(`SELECT id FROM produto WHERE loja_id=$1 AND nome='Shawarma'`, [lojaId]);
      shawarmaId = existing.id;
    }
    console.log('✅ Produto Shawarma criado:', shawarmaId);

    // Grupo Opcao: Sabor (único, obrigatório)
    let saborGrupoId: string;
    const [saborGrupo] = await qr.query(`
      INSERT INTO grupo_opcao (produto_id, nome, tipo, obrigatorio, min, max, ordem)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT DO NOTHING
      RETURNING id
    `, [shawarmaId, 'Sabor', 'unico', true, 1, 1, 0]);
    if (saborGrupo) {
      saborGrupoId = saborGrupo.id;
    } else {
      const [eg] = await qr.query(`SELECT id FROM grupo_opcao WHERE produto_id=$1 AND nome='Sabor'`, [shawarmaId]);
      saborGrupoId = eg.id;
    }

    const sabores = [
      { nome: 'Carne', preco: 0 },
      { nome: 'Frango', preco: 0 },
      { nome: 'Misto (Carne + Frango)', preco: 2 },
      { nome: 'Catufile (sem cheddar)', preco: 2 },
      { nome: 'Doritos', preco: 3 },
      { nome: 'Megabacon', preco: 4 },
      { nome: 'Vegetariano', preco: 0 },
      { nome: 'Fitness', preco: 0 },
    ];
    for (let i = 0; i < sabores.length; i++) {
      await qr.query(`
        INSERT INTO opcao (grupo_opcao_id, nome, preco_adicional, ordem)
        VALUES ($1,$2,$3,$4)
        ON CONFLICT DO NOTHING
      `, [saborGrupoId, sabores[i].nome, sabores[i].preco, i]);
    }
    console.log('✅ Sabores inseridos');

    // Grupo Opcao: Adicionais (múltiplo, opcional)
    let adicionaisGrupoId: string;
    const [adicionaisGrupo] = await qr.query(`
      INSERT INTO grupo_opcao (produto_id, nome, tipo, obrigatorio, min, max, ordem)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT DO NOTHING
      RETURNING id
    `, [shawarmaId, 'Adicionais', 'multiplo', false, 0, 6, 1]);
    if (adicionaisGrupo) {
      adicionaisGrupoId = adicionaisGrupo.id;
    } else {
      const [eg] = await qr.query(`SELECT id FROM grupo_opcao WHERE produto_id=$1 AND nome='Adicionais'`, [shawarmaId]);
      adicionaisGrupoId = eg.id;
    }

    const adicionais = [
      { nome: 'Molho Especial de Alho', preco: 3 },
      { nome: 'Bacon Extra', preco: 4 },
      { nome: 'Queijo Cheddar', preco: 3 },
      { nome: 'Queijo Prato', preco: 2.5 },
      { nome: 'Picles Extra', preco: 1 },
      { nome: 'Tomate Extra', preco: 1 },
    ];
    for (let i = 0; i < adicionais.length; i++) {
      await qr.query(`
        INSERT INTO opcao (grupo_opcao_id, nome, preco_adicional, ordem)
        VALUES ($1,$2,$3,$4)
        ON CONFLICT DO NOTHING
      `, [adicionaisGrupoId, adicionais[i].nome, adicionais[i].preco, i]);
    }
    console.log('✅ Adicionais inseridos');

    // Bebidas
    const bebidas = [
      { nome: 'Coca-Cola Lata 350ml', preco: 6 },
      { nome: 'Guaraná Antarctica Lata 350ml', preco: 5 },
      { nome: 'Água Mineral 500ml', preco: 3 },
      { nome: 'Suco Natural 300ml', preco: 8 },
    ];
    for (let i = 0; i < bebidas.length; i++) {
      await qr.query(`
        INSERT INTO produto (loja_id, categoria_id, nome, preco, ordem)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT DO NOTHING
      `, [lojaId, catIds['Bebidas'], bebidas[i].nome, bebidas[i].preco, i]);
    }
    console.log('✅ Bebidas inseridas');

    await qr.commitTransaction();
    console.log('\n🎉 Seed concluído com sucesso!');
    console.log('📌 Acesse o cardápio em: http://localhost:3000/loja/eu-pedi');
    console.log('🔑 Admin: admin@eupedi.com | Senha: admin123');
  } catch (err) {
    await qr.rollbackTransaction();
    console.error('❌ Erro no seed:', err);
    throw err;
  } finally {
    await qr.release();
    await AppDataSource.destroy();
  }
}

seed().catch(console.error);
