import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Loja } from '../loja/loja.entity';

@Entity('pedido')
export class Pedido {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  loja_id: string;

  @ManyToOne(() => Loja)
  loja: Loja;

  @Column()
  cliente_id: string;

  @Column()
  numero_sequencial: number;

  @Column({ default: 'entrega' })
  tipo: string;

  @Column({ default: 'recebido' })
  status: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  taxa_entrega: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  desconto: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total: number;

  @Column()
  forma_pagamento: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  troco_para: number;

  @Column({ type: 'text', nullable: true })
  observacoes: string;

  @Column({ type: 'jsonb', nullable: true })
  endereco_entrega: any;

  // O token só é devolvido na criação do pedido e é exigido nas rotas públicas.
  @Column({ unique: true, select: false, length: 64 })
  token_acesso: string;

  @Column({ nullable: true })
  motoboy_id: string;

  @OneToMany(() => PedidoItem, i => i.pedido, { eager: true, cascade: true })
  itens: PedidoItem[];

  @CreateDateColumn()
  criado_em: Date;

  @UpdateDateColumn()
  atualizado_em: Date;
}

@Entity('pedido_item')
export class PedidoItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  pedido_id: string;

  @ManyToOne(() => Pedido, p => p.itens, { onDelete: 'CASCADE' })
  pedido: Pedido;

  @Column({ nullable: true })
  produto_id: string;

  @Column()
  nome_snapshot: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  preco_unitario: number;

  @Column({ default: 1 })
  quantidade: number;

  @Column({ type: 'text', nullable: true })
  observacao: string;

  @OneToMany(() => PedidoItemOpcao, o => o.pedido_item, { eager: true, cascade: true })
  opcoes: PedidoItemOpcao[];
}

@Entity('pedido_item_opcao')
export class PedidoItemOpcao {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  pedido_item_id: string;

  @ManyToOne(() => PedidoItem, i => i.opcoes, { onDelete: 'CASCADE' })
  pedido_item: PedidoItem;

  @Column({ nullable: true })
  opcao_id: string;

  @Column()
  nome_snapshot: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  preco_adicional_snapshot: number;
}
