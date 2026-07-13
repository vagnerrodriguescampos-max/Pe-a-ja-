import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Loja } from '../../loja/loja.entity';
import { Categoria } from '../categoria/categoria.entity';
import { GrupoOpcao } from '../grupo-opcao/grupo-opcao.entity';

@Entity('produto')
export class Produto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  loja_id: string;

  @ManyToOne(() => Loja)
  loja: Loja;

  @Column()
  categoria_id: string;

  @ManyToOne(() => Categoria, c => c.produtos)
  categoria: Categoria;

  @Column()
  nome: string;

  @Column({ nullable: true, type: 'text' })
  descricao: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  preco: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  preco_promocional: number;

  @Column({ nullable: true })
  imagem_url: string;

  @Column({ nullable: true })
  tempo_preparo_min: number;

  @Column({ default: 'ativo' })
  status: string;

  @Column({ default: false })
  destaque: boolean;

  @Column({ default: 0 })
  ordem: number;

  @OneToMany(() => GrupoOpcao, g => g.produto, { eager: true })
  grupos_opcao: GrupoOpcao[];

  @CreateDateColumn()
  criado_em: Date;

  @UpdateDateColumn()
  atualizado_em: Date;
}
