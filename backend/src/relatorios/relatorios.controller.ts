import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { RelatoriosService } from './relatorios.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentLoja } from '../auth/decorators/current-loja.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin_loja', 'super_admin')
@Controller('admin/relatorios')
export class RelatoriosController {
  constructor(private relatoriosService: RelatoriosService) {}

  @Get('resumo')
  getResumo(@CurrentLoja() lojaId: string, @Query('dias') dias?: string) {
    return this.relatoriosService.getResumo(lojaId, dias ? parseInt(dias) : 30);
  }

  @Get('receita-por-dia')
  getReceitaPorDia(@CurrentLoja() lojaId: string, @Query('dias') dias?: string) {
    return this.relatoriosService.getReceitaPorDia(lojaId, dias ? parseInt(dias) : 30);
  }

  @Get('por-pagamento')
  getPorPagamento(@CurrentLoja() lojaId: string, @Query('dias') dias?: string) {
    return this.relatoriosService.getReceitaPorFormaPagamento(lojaId, dias ? parseInt(dias) : 30);
  }

  @Get('produtos-mais-vendidos')
  getProdutos(@CurrentLoja() lojaId: string, @Query('dias') dias?: string) {
    return this.relatoriosService.getProdutosMaisVendidos(lojaId, dias ? parseInt(dias) : 30);
  }

  @Get('heatmap')
  getHeatmap(@CurrentLoja() lojaId: string, @Query('dias') dias?: string) {
    return this.relatoriosService.getHeatmapHorario(lojaId, dias ? parseInt(dias) : 30);
  }

  @Get('por-origem')
  getPorOrigem(@CurrentLoja() lojaId: string, @Query('dias') dias?: string) {
    return this.relatoriosService.getPedidosPorOrigem(lojaId, dias ? parseInt(dias) : 30);
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin_loja', 'super_admin', 'atendente')
@Controller('admin/clientes')
export class ClientesController {
  constructor(private relatoriosService: RelatoriosService) {}

  @Get()
  getClientes(
    @CurrentLoja() lojaId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('busca') busca?: string,
  ) {
    return this.relatoriosService.getClientes(
      lojaId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      busca,
    );
  }

  @Get(':id/pedidos')
  getClientePedidos(@Param('id') id: string, @CurrentLoja() lojaId: string) {
    return this.relatoriosService.getClientePedidos(id, lojaId);
  }
}
