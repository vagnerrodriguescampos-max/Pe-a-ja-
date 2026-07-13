import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/' })
export class ChatGateway {
  @WebSocketServer() server: Server;

  constructor(private chatService: ChatService) {
    chatService.onIaMensagem = (conversaId, lojaId, mensagem) => {
      this.emitNovaMensagem(conversaId, lojaId, mensagem, { nao_lidas: 0 });
    };
  }

  // Cliente ou atendente entra na sala da conversa
  @SubscribeMessage('entrar_conversa')
  async entrarConversa(@MessageBody() conversaId: string, @ConnectedSocket() client: Socket) {
    client.join(`conversa:${conversaId}`);
  }

  // Atendente entra na inbox da loja
  @SubscribeMessage('entrar_inbox')
  async entrarInbox(@MessageBody() lojaId: string, @ConnectedSocket() client: Socket) {
    client.join(`inbox:${lojaId}`);
  }

  // Atendente sinalizando que está digitando
  @SubscribeMessage('digitando')
  async digitando(
    @MessageBody() data: { conversaId: string; quem: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.to(`conversa:${data.conversaId}`).emit('digitando', { quem: data.quem });
  }

  // Emitir nova mensagem para todos na sala
  emitNovaMensagem(conversaId: string, lojaId: string, mensagem: any, conversaInfo: any) {
    this.server.to(`conversa:${conversaId}`).emit('mensagem:nova', mensagem);
    this.server.to(`inbox:${lojaId}`).emit('inbox:atualizar', {
      conversa_id: conversaId,
      ultima_mensagem: mensagem,
      nao_lidas: conversaInfo.nao_lidas,
    });
  }

  // Emitir quando status da conversa muda
  emitStatusConversa(conversaId: string, lojaId: string, status: string) {
    this.server.to(`inbox:${lojaId}`).emit('conversa:status', { conversa_id: conversaId, status });
  }
}
