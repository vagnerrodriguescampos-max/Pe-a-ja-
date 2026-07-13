import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { MotoboyService } from './motoboy.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentLoja, CurrentUser } from '../auth/decorators/current-loja.decorator';

// Rotas do admin
@UseGuards(JwtAuthGuard)
@Controller('admin/motoboys')
export class MotoboyAdminController {
  constructor(private motoboyService: MotoboyService) {}

  @Get()
  listar(@CurrentLoja() lojaId: string) {
    return this.motoboyService.listarMotoboys(lojaId);
  }

  @Post('pedido/:pedidoId/atribuir')
  atribuir(
    @CurrentLoja() lojaId: string,
    @Param('pedidoId') pedidoId: string,
    @Body() body: { motoboy_id: string },
  ) {
    return this.motoboyService.atribuirMotoboy(lojaId, pedidoId, body.motoboy_id);
  }
}

// Rotas do motoboy (autenticado com papel=motoboy)
@UseGuards(JwtAuthGuard)
@Controller('motoboy')
export class MotoboyController {
  constructor(private motoboyService: MotoboyService) {}

  @Get('pedidos')
  getPedidos(@CurrentUser() user: any) {
    return this.motoboyService.getPedidosMotoboy(user.id);
  }

  @Get('pedidos/:id/posicao')
  getUltimaPosicao(@Param('id') pedidoId: string) {
    return this.motoboyService.getUltimaPosicao(pedidoId);
  }
}

// Rota pública para cliente ver posição do motoboy
@Controller('pedidos/:id/rastreamento')
export class RastreamentoPublicoController {
  constructor(private motoboyService: MotoboyService) {}

  @Get()
  getUltimaPosicao(@Param('id') pedidoId: string) {
    return this.motoboyService.getUltimaPosicao(pedidoId);
  }
}
