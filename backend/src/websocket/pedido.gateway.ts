import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { Pedido } from '../pedido/pedido.entity';
import { getSocketCorsOptions } from '../config/cors';
import { usuarioAutenticado } from './socket-auth.util';

@WebSocketGateway({ cors: getSocketCorsOptions(), namespace: '/' })
export class PedidoGateway {
  @WebSocketServer()
  server: Server;

  constructor(
    @InjectRepository(Pedido) private pedidoRepo: Repository<Pedido>,
    private jwtService: JwtService,
  ) {}

  // Cliente entra na sala do seu pedido para acompanhar — exige o token de acesso do próprio pedido.
  @SubscribeMessage('entrar_pedido')
  async entrarPedido(@MessageBody() data: { pedidoId?: string; token?: string }, @ConnectedSocket() client: Socket) {
    const pedidoId = data?.pedidoId;
    if (!pedidoId || !(await this.tokenPertenceAoPedido(pedidoId, data?.token))) return;
    client.join(`pedido:${pedidoId}`);
  }

  // Admin entra na sala da loja para receber novos pedidos — exige um JWT válido daquela loja.
  @SubscribeMessage('entrar_loja')
  async entrarLoja(@ConnectedSocket() client: Socket) {
    const usuario = usuarioAutenticado(client, this.jwtService);
    if (!usuario?.loja_id) return;
    client.join(`loja:${usuario.loja_id}`);
  }

  async tokenPertenceAoPedido(pedidoId: string, token: string | undefined): Promise<boolean> {
    if (!/^[a-f0-9]{64}$/i.test(token || '')) return false;
    const total = await this.pedidoRepo.count({ where: { id: pedidoId, token_acesso: token } });
    return total > 0;
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
