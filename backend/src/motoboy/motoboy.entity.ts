import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Pedido } from '../pedido/pedido.entity';
import { Usuario } from '../auth/usuario.entity';

@Entity('rastreamento_motoboy')
export class RastreamentoMotoboy {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() pedido_id: string;
  @ManyToOne(() => Pedido) pedido: Pedido;
  @Column() motoboy_id: string;
  @ManyToOne(() => Usuario) motoboy: Usuario;
  @Column({ type: 'decimal', precision: 10, scale: 7 }) lat: number;
  @Column({ type: 'decimal', precision: 10, scale: 7 }) lng: number;
  @CreateDateColumn() criado_em: Date;
}
