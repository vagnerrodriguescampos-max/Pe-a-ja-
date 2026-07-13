import {
  Column, CreateDateColumn, Entity, ManyToOne,
  PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { Loja } from '../loja/loja.entity';
import { Cliente } from '../pedido/cliente.entity';
import { Pedido } from '../pedido/pedido.entity';

@Entity('config_fidelizacao')
export class ConfigFidelizacao {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() loja_id: string;
  @ManyToOne(() => Loja) loja: Loja;
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 5 }) cashback_percentual: number;
  @Column({ default: 10 }) meta_selos: number;
  @Column({ default: 'desconto' }) recompensa_tipo: string;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 10 }) recompensa_valor: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 200 }) vip_prata_gasto: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 500 }) vip_ouro_gasto: number;
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 2 }) vip_cashback_extra: number;
  @Column({ default: true }) ativo: boolean;
  @CreateDateColumn() criado_em: Date;
  @UpdateDateColumn() atualizado_em: Date;
}

@Entity('carteira')
export class Carteira {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() loja_id: string;
  @Column() cliente_id: string;
  @ManyToOne(() => Cliente) cliente: Cliente;
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) saldo: number;
  @CreateDateColumn() criado_em: Date;
  @UpdateDateColumn() atualizado_em: Date;
}

@Entity('transacao_carteira')
export class TransacaoCarteira {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() carteira_id: string;
  @ManyToOne(() => Carteira) carteira: Carteira;
  @Column() tipo: string;
  @Column({ type: 'decimal', precision: 10, scale: 2 }) valor: number;
  @Column({ length: 200 }) descricao: string;
  @Column({ nullable: true }) pedido_id: string;
  @ManyToOne(() => Pedido, { nullable: true }) pedido: Pedido;
  @CreateDateColumn() criado_em: Date;
}

@Entity('cartao_fidelidade')
export class CartaoFidelidade {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() loja_id: string;
  @Column() cliente_id: string;
  @ManyToOne(() => Cliente) cliente: Cliente;
  @Column({ default: 0 }) selos_atuais: number;
  @Column({ default: 0 }) total_recompensas: number;
  @CreateDateColumn() criado_em: Date;
  @UpdateDateColumn() atualizado_em: Date;
}

@Entity('campanha_marketing')
export class CampanhaMarketing {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() loja_id: string;
  @ManyToOne(() => Loja) loja: Loja;
  @Column() tipo: string;
  @Column({ type: 'text' }) mensagem: string;
  @Column({ default: true }) ativa: boolean;
  @Column({ nullable: true }) dias_sem_compra: number;
  @CreateDateColumn() criado_em: Date;
  @UpdateDateColumn() atualizado_em: Date;
}

@Entity('log_campanha')
export class LogCampanha {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() campanha_id: string;
  @ManyToOne(() => CampanhaMarketing) campanha: CampanhaMarketing;
  @Column() cliente_id: string;
  @ManyToOne(() => Cliente) cliente: Cliente;
  @CreateDateColumn() enviado_em: Date;
}
