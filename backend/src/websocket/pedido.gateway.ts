import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/',
})
export class PedidoGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    // cliente conectado
  }

  handleDisconnect(client: Socket) {
    // cliente desconectado
  }

  // Cliente entra na sala do seu pedido para acompanhar
  @SubscribeMessage('entrar_pedido')
  async entrarPedido(@MessageBody() pedidoId: string, @ConnectedSocket() client: Socket) {
    client.join(`pedido:${pedidoId}`);
  }

  // Admin entra na sala da loja para receber novos pedidos
  @SubscribeMessage('entrar_loja')
  async entrarLoja(@MessageBody() lojaId: string, @ConnectedSocket() client: Socket) {
    client.join(`loja:${lojaId}`);
  }

  emitStatusAtualizado(lojaId: string, pedidoId: string, status: string) {
    const payload = { pedido_id: pedidoId, status, atualizado_em: new Date().toISOString() };
    // Notifica o cliente que acompanha o pedido
    this.server.to(`pedido:${pedidoId}`).emit('pedido:status_changed', payload);
    // Notifica o painel admin
    this.server.to(`loja:${lojaId}`).emit('pedido:status_changed', payload);
  }

  emitNovoPedido(lojaId: string, pedido: any) {
    this.server.to(`loja:${lojaId}`).emit('pedido:novo', pedido);
  }
}
