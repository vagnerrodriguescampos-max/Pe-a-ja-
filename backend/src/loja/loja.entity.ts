import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// dia_semana: 0 = domingo ... 6 = sábado. abre/fecha em "HH:mm". Quando fecha < abre,
// o expediente cruza a meia-noite (ex: 18:00–02:00).
export interface HorarioDia {
  dia_semana: number;
  fechado: boolean;
  abre: string;
  fecha: string;
}

@Entity('loja')
export class Loja {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nome: string;

  @Column({ unique: true })
  slug: string;

  @Column({ nullable: true })
  logo_url: string;

  @Column({ nullable: true })
  banner_url: string;

  @Column({ default: 'imagem' })
  banner_tipo: string;

  @Column({ default: '#FF6B00' })
  cor_primaria: string;

  @Column({ nullable: true })
  telefone: string;

  // `endereco` é o logradouro (rua + número). Bairro/cidade/estado/CEP ficam separados
  // para permitir preenchimento automático via CEP e agrupamento por região.
  @Column({ nullable: true })
  endereco: string;

  @Column({ nullable: true })
  bairro: string;

  @Column({ nullable: true })
  cidade: string;

  @Column({ type: 'varchar', length: 2, nullable: true })
  estado: string;

  @Column({ type: 'varchar', length: 9, nullable: true })
  cep: string;

  @Column({ nullable: true })
  chave_pix: string;

  @Column({ nullable: true })
  tipo_chave_pix: string;

  @Column({ default: false })
  aberta: boolean;

  @Column({ default: 40 })
  prazo_medio_min: number;

  @Column({ nullable: true })
  mensagem_topo: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  taxa_entrega_padrao: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  pedido_minimo: number;

  @Column({ nullable: true })
  whatsapp_waba_id: string;

  @Column({ nullable: true, unique: true })
  whatsapp_phone_number_id: string;

  @Column({ nullable: true })
  whatsapp_numero_display: string;

  @Column({ type: 'timestamptz', nullable: true })
  whatsapp_conectado_em: Date;

  @Column({ default: false })
  horario_automatico: boolean;

  @Column({ type: 'jsonb', nullable: true })
  horarios: HorarioDia[];

  @Column({ default: false })
  onboarding_concluido: boolean;

  @CreateDateColumn()
  criado_em: Date;

  @UpdateDateColumn()
  atualizado_em: Date;
}
