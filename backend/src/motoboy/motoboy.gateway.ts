import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MotoboyService } from './motoboy.service';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/' })
export class MotoboyGateway {
  @WebSocketServer() server: Server;

  constructor(private motoboyService: MotoboyService) {}

  // Motoboy entra na sala do pedido para streaming de posição
  @SubscribeMessage('motoboy:entrar_pedido')
  async entrarPedido(@MessageBody() pedidoId: string, @ConnectedSocket() client: Socket) {
    client.join(`motoboy:${pedidoId}`);
  }

  // Motoboy atualiza posição GPS
  @SubscribeMessage('motoboy:posicao')
  async atualizarPosicao(
    @MessageBody() data: { pedidoId: string; motoboyId: string; lat: number; lng: number },
    @ConnectedSocket() client: Socket,
  ) {
    await this.motoboyService.salvarPosicao(data.pedidoId, data.motoboyId, data.lat, data.lng);
    // Emite para todos assistindo esse pedido (cliente + admin)
    this.server.to(`motoboy:${data.pedidoId}`).emit('motoboy:posicao_atualizada', {
      pedido_id: data.pedidoId,
      lat: data.lat,
      lng: data.lng,
      atualizado_em: new Date().toISOString(),
    });
    // Também emite para a sala do pedido (cliente acompanhando)
    this.server.to(`pedido:${data.pedidoId}`).emit('motoboy:posicao_atualizada', {
      pedido_id: data.pedidoId,
      lat: data.lat,
      lng: data.lng,
      atualizado_em: new Date().toISOString(),
    });
  }

  // Emitir para clientes quando motoboy é atribuído
  emitMotoboyAtribuido(pedidoId: string, motoboyNome: string) {
    this.server.to(`pedido:${pedidoId}`).emit('motoboy:atribuido', { pedido_id: pedidoId, motoboy_nome: motoboyNome });
  }
}
