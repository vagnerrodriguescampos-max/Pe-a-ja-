import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Produto } from '../produto/produto.entity';
import { Opcao } from './opcao.entity';

@Entity('grupo_opcao')
export class GrupoOpcao {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  produto_id: string;

  @ManyToOne(() => Produto, p => p.grupos_opcao, { onDelete: 'CASCADE' })
  produto: Produto;

  @Column()
  nome: string;

  @Column({ default: 'unico' })
  tipo: string;

  @Column({ default: false })
  obrigatorio: boolean;

  @Column({ default: 0 })
  min: number;

  @Column({ nullable: true })
  max: number;

  @Column({ default: 0 })
  ordem: number;

  @OneToMany(() => Opcao, o => o.grupo_opcao, { eager: true })
  opcoes: Opcao[];
}
