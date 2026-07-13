import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Loja } from '../loja/loja.entity';
import { Usuario } from '../auth/usuario.entity';

@Entity('conversa')
export class Conversa {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  loja_id: string;

  @ManyToOne(() => Loja)
  loja: Loja;

  @Column()
  cliente_id: string;

  @Column({ nullable: true })
  atendente_id: string;

  @ManyToOne(() => Usuario, { nullable: true })
  atendente: Usuario;

  @Column({ default: 'aberta' })
  status: string;

  @Column({ default: 0 })
  nao_lidas: number;

  @Column({ type: 'timestamptz', nullable: true })
  ultima_mensagem_em: Date;

  @OneToMany(() => Mensagem, m => m.conversa)
  mensagens: Mensagem[];

  @CreateDateColumn()
  criado_em: Date;
}

@Entity('mensagem')
export class Mensagem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  conversa_id: string;

  @ManyToOne(() => Conversa, c => c.mensagens, { onDelete: 'CASCADE' })
  conversa: Conversa;

  @Column({ nullable: true })
  pedido_id: string;

  @Column()
  autor_tipo: string;

  @Column({ nullable: true })
  autor_id: string;

  @Column({ type: 'text' })
  conteudo: string;

  @Column({ default: 'texto' })
  tipo: string;

  @Column({ nullable: true })
  url_anexo: string;

  @Column({ default: false })
  lida: boolean;

  @CreateDateColumn()
  criado_em: Date;
}
