import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Loja } from '../loja/loja.entity';

@Entity('usuario')
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  loja_id: string;

  @ManyToOne(() => Loja)
  loja: Loja;

  @Column()
  nome: string;

  @Column()
  email: string;

  @Column()
  senha_hash: string;

  @Column({ default: 'atendente' })
  papel: string;

  @Column({ default: true })
  ativo: boolean;

  @CreateDateColumn()
  criado_em: Date;
}
