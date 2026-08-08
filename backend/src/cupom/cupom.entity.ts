import { Column, CreateDateColumn, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Loja } from '../loja/loja.entity';

/** Como o desconto é calculado. */
export type TipoDesconto = 'percentual' | 'valor';

/**
 * Quem pode usar o cupom.
 * - `geral`: qualquer cliente.
 * - `primeira_compra`: só quem ainda não tem pedido nesta loja.
 * - `aniversario`: só na semana do aniversário do cliente (exige data de nascimento).
 */
export type RegraCupom = 'geral' | 'primeira_compra' | 'aniversario';

@Entity('cupom')
@Index(['loja_id', 'codigo'], { unique: true })
export class Cupom {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  loja_id: string;

  @ManyToOne(() => Loja)
  loja: Loja;

  /** Sempre gravado em maiúsculas para a comparação não depender de como o cliente digitou. */
  @Column({ type: 'varchar', length: 30 })
  codigo: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  descricao: string;

  @Column({ type: 'varchar', length: 20, default: 'percentual' })
  tipo_desconto: TipoDesconto;

  /** Percentual (10 = 10%) ou valor absoluto em reais, conforme `tipo_desconto`. */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  valor: number;

  /** Teto de desconto para cupons percentuais. Sem teto, 20% de um pedido grande vira prejuízo. */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  desconto_maximo: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  pedido_minimo: number;

  @Column({ type: 'varchar', length: 20, default: 'geral' })
  regra: RegraCupom;

  @Column({ type: 'date', nullable: true })
  valido_de: string;

  @Column({ type: 'date', nullable: true })
  valido_ate: string;

  /** Null = sem limite total. */
  @Column({ type: 'int', nullable: true })
  limite_uso_total: number;

  @Column({ type: 'int', default: 1 })
  limite_uso_por_cliente: number;

  /** Contador desnormalizado para checar o limite total sem varrer `cupom_uso`. */
  @Column({ type: 'int', default: 0 })
  usos: number;

  @Column({ default: true })
  ativo: boolean;

  @CreateDateColumn()
  criado_em: Date;
}

/** Um registro por aplicação de cupom — é o que sustenta o limite por cliente e o relatório. */
@Entity('cupom_uso')
@Index(['cupom_id', 'cliente_id'])
export class CupomUso {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  cupom_id: string;

  @Column()
  cliente_id: string;

  @Column({ nullable: true })
  pedido_id: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  valor_desconto: number;

  @CreateDateColumn()
  criado_em: Date;
}
