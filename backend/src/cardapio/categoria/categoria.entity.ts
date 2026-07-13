import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Loja } from '../../loja/loja.entity';
import { Produto } from '../produto/produto.entity';

@Entity('categoria')
export class Categoria {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  loja_id: string;

  @ManyToOne(() => Loja)
  loja: Loja;

  @Column()
  nome: string;

  @Column({ default: 0 })
  ordem: number;

  @Column({ default: true })
  ativa: boolean;

  @Column({ nullable: true })
  foto_url: string;

  @OneToMany(() => Produto, p => p.categoria)
  produtos: Produto[];

  @CreateDateColumn()
  criado_em: Date;
}
