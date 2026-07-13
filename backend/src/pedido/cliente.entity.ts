import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Loja } from '../loja/loja.entity';

@Entity('cliente')
export class Cliente {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  loja_id: string;

  @ManyToOne(() => Loja)
  loja: Loja;

  @Column()
  nome: string;

  @Column()
  telefone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ type: 'date', nullable: true })
  data_nascimento: string;

  @CreateDateColumn()
  criado_em: Date;
}

@Entity('endereco')
export class Endereco {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  cliente_id: string;

  @ManyToOne(() => Cliente)
  cliente: Cliente;

  @Column()
  rua: string;

  @Column()
  numero: string;

  @Column({ nullable: true })
  complemento: string;

  @Column()
  bairro: string;

  @Column()
  cidade: string;

  @Column({ nullable: true })
  referencia: string;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  lat: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  lng: number;

  @CreateDateColumn()
  criado_em: Date;
}
