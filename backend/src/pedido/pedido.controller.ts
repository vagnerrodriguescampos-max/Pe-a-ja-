import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PedidoService } from './pedido.service';
import { LojaService } from '../loja/loja.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentLoja, CurrentUser } from '../auth/decorators/current-loja.decorator';
import { AtualizarStatusPedidoDto, CriarPedidoDto } from './dto/criar-pedido.dto';

@Controller()
export class PedidoPublicoController {
  constructor(
    private pedidoService: PedidoService,
    private lojaService: LojaService,
  ) {}

  // Criar pedido — recebe slug da loja na URL. Limite estrito: dificulta spam/abuso de pedidos falsos.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('loja/:slug/pedidos')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async criarPedido(@Param('slug') slug: string, @Body() body: CriarPedidoDto) {
    const loja = await this.lojaService.findBySlug(slug);
    return this.pedidoService.criarPedido(loja.id, body);
  }

  // O ID sozinho não concede acesso ao pedido: o cliente precisa do token gerado na criação.
  @Get('pedidos/:id')
  async getPedido(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('token') token: string,
  ) {
    return this.pedidoService.getPedido(id, token);
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin_loja', 'super_admin', 'atendente')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('admin/pedidos')
export class PedidoAdminController {
  constructor(private pedidoService: PedidoService) {}

  @Get()
  async listar(@CurrentLoja() lojaId: string, @Query('status') status?: string) {
    return this.pedidoService.listarPedidos(lojaId, status);
  }

  /**
   * Pedido lançado à mão pelo balcão (chegou por telefone/WhatsApp).
   *
   * Separado da rota pública porque o contexto é outro: aqui já há sessão
   * autenticada (sem rate limit de antispam), a loja pode estar fechada, e a
   * origem é fixada no servidor para o relatório de divulgação não ser
   * contaminado por um valor vindo do formulário.
   */
  @Post()
  async criarManual(@CurrentLoja() lojaId: string, @Body() body: CriarPedidoDto) {
    return this.pedidoService.criarPedido(
      lojaId,
      { ...body, origem: 'manual' },
      { ignorarLojaFechada: true },
    );
  }

  // O app do motoboy usa esta mesma rota para marcar "entregue" — por isso o papel motoboy também entra.
  @Roles('admin_loja', 'super_admin', 'atendente', 'motoboy')
  @Patch(':id/status')
  async atualizarStatus(
    @CurrentLoja() lojaId: string,
    @CurrentUser() usuario: { id: string; papel: string },
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: AtualizarStatusPedidoDto,
  ) {
    // Motoboy só pode avançar o status de entregas atribuídas a ele mesmo — as demais
    // roles administram qualquer pedido da loja.
    const motoboyId = usuario.papel === 'motoboy' ? usuario.id : undefined;
    return this.pedidoService.atualizarStatus(lojaId, id, body.status, motoboyId);
  }
}
