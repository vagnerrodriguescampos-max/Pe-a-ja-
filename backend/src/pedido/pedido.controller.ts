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
import { PedidoService } from './pedido.service';
import { LojaService } from '../loja/loja.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentLoja } from '../auth/decorators/current-loja.decorator';
import { AtualizarStatusPedidoDto, CriarPedidoDto } from './dto/criar-pedido.dto';

@Controller()
export class PedidoPublicoController {
  constructor(
    private pedidoService: PedidoService,
    private lojaService: LojaService,
  ) {}

  // Criar pedido — recebe slug da loja na URL
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

@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('admin/pedidos')
export class PedidoAdminController {
  constructor(private pedidoService: PedidoService) {}

  @Get()
  async listar(@CurrentLoja() lojaId: string, @Query('status') status?: string) {
    return this.pedidoService.listarPedidos(lojaId, status);
  }

  @Patch(':id/status')
  async atualizarStatus(
    @CurrentLoja() lojaId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: AtualizarStatusPedidoDto,
  ) {
    return this.pedidoService.atualizarStatus(lojaId, id, body.status);
  }
}
