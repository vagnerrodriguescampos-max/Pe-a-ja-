import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { MotoboyService } from './motoboy.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentLoja, CurrentUser } from '../auth/decorators/current-loja.decorator';

// Rotas do admin
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin_loja', 'super_admin', 'atendente')
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
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('motoboy')
@Controller('motoboy')
export class MotoboyController {
  constructor(private motoboyService: MotoboyService) {}

  @Get('pedidos')
  getPedidos(@CurrentUser() user: any) {
    return this.motoboyService.getPedidosMotoboy(user.id);
  }

  @Get('pedidos/:id/posicao')
  getUltimaPosicao(@Param('id') pedidoId: string, @CurrentUser() user: any) {
    return this.motoboyService.getUltimaPosicaoParaMotoboy(pedidoId, user.id);
  }
}

// Rota pública para cliente ver posição do motoboy — exige o mesmo token_acesso do
// pedido, igual à rota pública de detalhes (GET /pedidos/:id).
@Controller('pedidos/:id/rastreamento')
export class RastreamentoPublicoController {
  constructor(private motoboyService: MotoboyService) {}

  @Get()
  getUltimaPosicao(@Param('id') pedidoId: string, @Query('token') token: string) {
    return this.motoboyService.getUltimaPosicaoPublica(pedidoId, token);
  }
}
