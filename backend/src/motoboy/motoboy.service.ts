import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { RastreamentoMotoboy } from './motoboy.entity';
import { Pedido } from '../pedido/pedido.entity';
import { Usuario } from '../auth/usuario.entity';

@Injectable()
export class MotoboyService {
  constructor(
    @InjectRepository(RastreamentoMotoboy) private rastreamentoRepo: Repository<RastreamentoMotoboy>,
    @InjectRepository(Pedido) private pedidoRepo: Repository<Pedido>,
    @InjectRepository(Usuario) private usuarioRepo: Repository<Usuario>,
  ) {}

  // Lista motoboys da loja
  async listarMotoboys(lojaId: string): Promise<Usuario[]> {
    return this.usuarioRepo.find({
      where: { loja_id: lojaId, papel: 'motoboy', ativo: true },
      select: ['id', 'nome', 'email'],
    });
  }

  // Atribuir motoboy a pedido
  async atribuirMotoboy(lojaId: string, pedidoId: string, motoboyId: string): Promise<Pedido> {
    const pedido = await this.pedidoRepo.findOne({ where: { id: pedidoId, loja_id: lojaId } });
    if (!pedido) throw new NotFoundException('Pedido não encontrado');
    const motoboy = await this.usuarioRepo.findOne({ where: { id: motoboyId, loja_id: lojaId, papel: 'motoboy' } });
    if (!motoboy) throw new NotFoundException('Motoboy não encontrado');
    await this.pedidoRepo.update(pedidoId, { motoboy_id: motoboyId } as any);
    return { ...pedido, motoboy_id: motoboyId } as any;
  }

  // Pedidos ativos do motoboy logado
  async getPedidosMotoboy(motoboyId: string): Promise<Pedido[]> {
    return this.pedidoRepo.find({
      where: {
        motoboy_id: motoboyId as any,
        status: In(['pronto', 'saiu_para_entrega']),
      },
      relations: ['itens'],
      order: { criado_em: 'DESC' },
    });
  }

  // Salvar posição GPS
  async salvarPosicao(pedidoId: string, motoboyId: string, lat: number, lng: number) {
    const rastreamento = this.rastreamentoRepo.create({ pedido_id: pedidoId, motoboy_id: motoboyId, lat, lng });
    await this.rastreamentoRepo.save(rastreamento);
    return { lat, lng, atualizado_em: rastreamento.criado_em };
  }

  // Última posição do motoboy num pedido
  async getUltimaPosicao(pedidoId: string) {
    return this.rastreamentoRepo.findOne({
      where: { pedido_id: pedidoId },
      order: { criado_em: 'DESC' },
    });
  }

  // Histórico de posições
  async getHistoricoPosicoes(pedidoId: string) {
    return this.rastreamentoRepo.find({
      where: { pedido_id: pedidoId },
      order: { criado_em: 'ASC' },
      take: 200,
    });
  }
}
