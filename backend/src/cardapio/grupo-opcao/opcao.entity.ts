import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { GrupoOpcao } from './grupo-opcao.entity';

@Entity('opcao')
export class Opcao {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  grupo_opcao_id: string;

  @ManyToOne(() => GrupoOpcao, g => g.opcoes, { onDelete: 'CASCADE' })
  grupo_opcao: GrupoOpcao;

  @Column()
  nome: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  preco_adicional: number;

  @Column({ default: true })
  ativa: boolean;

  @Column({ default: 0 })
  ordem: number;
}
