import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Loja } from '../loja/loja.entity';

@Entity('config_ia')
export class ConfigIa {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() loja_id: string;
  @ManyToOne(() => Loja) loja: Loja;
  @Column({ default: false }) habilitada: boolean;
  @Column({ default: 'Assistente' }) nome_ia: string;
  @Column({ type: 'text', nullable: true }) sistema_prompt_extra: string;
  @Column({ default: 'claude-haiku-4-5-20251001' }) modelo: string;
  @Column({ default: 3 }) delay_resposta_seg: number;
  @CreateDateColumn() criado_em: Date;
  @UpdateDateColumn() atualizado_em: Date;
}
