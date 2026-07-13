import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('loja')
export class Loja {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nome: string;

  @Column({ unique: true })
  slug: string;

  @Column({ nullable: true })
  logo_url: string;

  @Column({ nullable: true })
  banner_url: string;

  @Column({ default: 'imagem' })
  banner_tipo: string;

  @Column({ default: '#FF6B00' })
  cor_primaria: string;

  @Column({ nullable: true })
  telefone: string;

  @Column({ nullable: true })
  endereco: string;

  @Column({ nullable: true })
  chave_pix: string;

  @Column({ nullable: true })
  tipo_chave_pix: string;

  @Column({ default: false })
  aberta: boolean;

  @Column({ default: 40 })
  prazo_medio_min: number;

  @Column({ nullable: true })
  mensagem_topo: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  taxa_entrega_padrao: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  pedido_minimo: number;

  @CreateDateColumn()
  criado_em: Date;

  @UpdateDateColumn()
  atualizado_em: Date;
}
