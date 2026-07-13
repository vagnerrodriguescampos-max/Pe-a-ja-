import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { LojaService } from '../loja/loja.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentLoja, CurrentUser } from '../auth/decorators/current-loja.decorator';

// Rotas públicas — widget do cliente
@Controller('loja/:slug/chat')
export class ChatPublicoController {
  constructor(
    private chatService: ChatService,
    private chatGateway: ChatGateway,
    private lojaService: LojaService,
  ) {}

  @Post('identificar')
  async identificar(
    @Param('slug') slug: string,
    @Body() body: { nome: string; telefone: string },
  ) {
    const loja = await this.lojaService.findBySlug(slug);
    const { cliente, conversa } = await this.chatService.identificarCliente(loja.id, body.nome, body.telefone);
    return { cliente, conversa };
  }

  @Post(':conversaId/mensagens')
  async enviarMensagemCliente(
    @Param('slug') slug: string,
    @Param('conversaId') conversaId: string,
    @Body() body: { conteudo: string },
  ) {
    const loja = await this.lojaService.findBySlug(slug);
    const mensagem = await this.chatService.enviarMensagem(conversaId, 'cliente', body.conteudo);

    const conversas = await this.chatService.listarConversas(loja.id);
    const conv = conversas.find(c => c.id === conversaId);
    this.chatGateway.emitNovaMensagem(conversaId, loja.id, mensagem, { nao_lidas: conv?.nao_lidas || 1 });

    return mensagem;
  }

  @Get(':conversaId/mensagens')
  async getMensagensCliente(@Param('conversaId') conversaId: string) {
    return this.chatService.getMensagensCliente(conversaId);
  }
}

// Rotas admin — inbox do atendente
@UseGuards(JwtAuthGuard)
@Controller('admin/chat')
export class ChatAdminController {
  constructor(
    private chatService: ChatService,
    private chatGateway: ChatGateway,
  ) {}

  @Get('conversas')
  async listar(@CurrentLoja() lojaId: string) {
    return this.chatService.listarConversas(lojaId);
  }

  @Get('conversas/:id/mensagens')
  async getMensagens(@CurrentLoja() lojaId: string, @Param('id') id: string) {
    await this.chatService.marcarLidas(id);
    return this.chatService.getMensagens(id, lojaId);
  }

  @Get('conversas/:id/pedidos')
  async getPedidos(@Param('id') id: string, @CurrentLoja() lojaId: string) {
    const conversas = await this.chatService.listarConversas(lojaId);
    const conv = conversas.find(c => c.id === id);
    if (!conv) return [];
    return this.chatService.getPedidosCliente(conv.cliente_id, lojaId);
  }

  @Post('conversas/:id/mensagens')
  async enviarMensagem(
    @CurrentLoja() lojaId: string,
    @CurrentUser() user: any,
    @Param('id') conversaId: string,
    @Body() body: { conteudo: string; pedido_id?: string },
  ) {
    const mensagem = await this.chatService.enviarMensagem(
      conversaId, 'atendente', body.conteudo, user.id, body.pedido_id,
    );
    this.chatGateway.emitNovaMensagem(conversaId, lojaId, mensagem, { nao_lidas: 0 });
    return mensagem;
  }

  @Patch('conversas/:id/status')
  async atualizarStatus(
    @CurrentLoja() lojaId: string,
    @CurrentUser() user: any,
    @Param('id') conversaId: string,
    @Body() body: { status: string },
  ) {
    const conv = await this.chatService.atualizarStatus(lojaId, conversaId, body.status, user.id);
    this.chatGateway.emitStatusConversa(conversaId, lojaId, body.status);
    return conv;
  }
}
