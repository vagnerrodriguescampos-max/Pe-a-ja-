import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { MotoboyService } from './motoboy.service';
import { Pedido } from '../pedido/pedido.entity';
import { getSocketCorsOptions } from '../config/cors';
import { usuarioAutenticado } from '../websocket/socket-auth.util';

@WebSocketGateway({ cors: getSocketCorsOptions(), namespace: '/' })
export class MotoboyGateway {
  @WebSocketServer() server: Server;

  constructor(
    private motoboyService: MotoboyService,
    @InjectRepository(Pedido) private pedidoRepo: Repository<Pedido>,
    private jwtService: JwtService,
  ) {}

  // O motoboy dono da entrega (JWT) ou o cliente com o token do pedido podem entrar para acompanhar.
  @SubscribeMessage('motoboy:entrar_pedido')
  async entrarPedido(
    @MessageBody() data: string | { pedidoId?: string; token?: string },
    @ConnectedSocket() client: Socket,
  ) {
    const pedidoId = typeof data === 'string' ? data : data?.pedidoId;
    if (!pedidoId) return;

    const usuario = usuarioAutenticado(client, this.jwtService);
    if (usuario) {
      const pedido = await this.pedidoRepo.findOne({ where: { id: pedidoId } });
      if (pedido?.motoboy_id !== usuario.sub) return;
    } else {
      const token = typeof data === 'string' ? undefined : data?.token;
      if (!/^[a-f0-9]{64}$/i.test(token || '')) return;
      const total = await this.pedidoRepo.count({ where: { id: pedidoId, token_acesso: token } });
      if (total === 0) return;
    }

    client.join(`motoboy:${pedidoId}`);
  }

  // Só o motoboy realmente atribuído ao pedido (JWT verificado) pode publicar sua posição.
  @SubscribeMessage('motoboy:posicao')
  async atualizarPosicao(
    @MessageBody() data: { pedidoId: string; lat: number; lng: number },
    @ConnectedSocket() client: Socket,
  ) {
    const usuario = usuarioAutenticado(client, this.jwtService);
    if (!usuario || !data?.pedidoId) return;

    const pedido = await this.pedidoRepo.findOne({ where: { id: data.pedidoId } });
    if (pedido?.motoboy_id !== usuario.sub) return;

    await this.motoboyService.salvarPosicao(data.pedidoId, usuario.sub, data.lat, data.lng);
    const payload = {
      pedido_id: data.pedidoId,
      lat: data.lat,
      lng: data.lng,
      atualizado_em: new Date().toISOString(),
    };
    // Emite para todos assistindo esse pedido (cliente + admin)
    this.server.to(`motoboy:${data.pedidoId}`).emit('motoboy:posicao_atualizada', payload);
    // Também emite para a sala do pedido (cliente acompanhando)
    this.server.to(`pedido:${data.pedidoId}`).emit('motoboy:posicao_atualizada', payload);
    // E para a sala da loja, onde o painel acompanha todas as entregas num mapa só —
    // sem isso o restaurante teria que entrar na sala de cada pedido em rota.
    if (pedido.loja_id) {
      this.server.to(`loja:${pedido.loja_id}`).emit('motoboy:posicao_atualizada', payload);
    }
  }

  // Emitir para clientes quando motoboy é atribuído
  emitMotoboyAtribuido(pedidoId: string, motoboyNome: string) {
    this.server.to(`pedido:${pedidoId}`).emit('motoboy:atribuido', { pedido_id: pedidoId, motoboy_nome: motoboyNome });
  }
}
