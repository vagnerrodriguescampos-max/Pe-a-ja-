import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Loja } from '../loja/loja.entity';

@Entity('push_subscription')
export class PushSubscription {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() loja_id: string;
  @ManyToOne(() => Loja) loja: Loja;
  @Column('text') endpoint: string;
  @Column('text') p256dh: string;
  @Column('text') auth: string;
  @Column({ nullable: true }) user_agent: string;
  @CreateDateColumn() criado_em: Date;
}
