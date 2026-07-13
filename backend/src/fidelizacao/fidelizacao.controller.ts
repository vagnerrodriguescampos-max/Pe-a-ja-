import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { FidelizacaoService } from './fidelizacao.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentLoja } from '../auth/decorators/current-loja.decorator';

// Rotas admin
@UseGuards(JwtAuthGuard)
@Controller('admin/fidelizacao')
export class FidelizacaoAdminController {
  constructor(private fidelizacaoService: FidelizacaoService) {}

  @Get('config')
  getConfig(@CurrentLoja() lojaId: string) {
    return this.fidelizacaoService.getConfig(lojaId);
  }

  @Patch('config')
  updateConfig(@CurrentLoja() lojaId: string, @Body() body: any) {
    return this.fidelizacaoService.updateConfig(lojaId, body);
  }

  @Get('stats')
  getStats(@CurrentLoja() lojaId: string) {
    return this.fidelizacaoService.getStats(lojaId);
  }

  @Get('campanhas')
  getCampanhas(@CurrentLoja() lojaId: string) {
    return this.fidelizacaoService.getCampanhas(lojaId);
  }

  @Post('campanhas/:tipo')
  upsertCampanha(
    @CurrentLoja() lojaId: string,
    @Param('tipo') tipo: string,
    @Body() body: any,
  ) {
    return this.fidelizacaoService.upsertCampanha(lojaId, tipo, body);
  }

  @Get('clientes/:clienteId/carteira')
  getCarteira(@CurrentLoja() lojaId: string, @Param('clienteId') clienteId: string) {
    return this.fidelizacaoService.getCarteira(lojaId, clienteId);
  }

  @Get('clientes/:clienteId/extrato')
  getExtrato(@CurrentLoja() lojaId: string, @Param('clienteId') clienteId: string) {
    return this.fidelizacaoService.getExtrato(lojaId, clienteId);
  }

  @Get('clientes/:clienteId/vip')
  getNivelVip(@CurrentLoja() lojaId: string, @Param('clienteId') clienteId: string) {
    return this.fidelizacaoService.calcularNivelVip(lojaId, clienteId).then(nivel => ({ nivel }));
  }
}

// Rotas públicas (cliente via widget/checkout)
@Controller('loja/:slug/fidelizacao')
export class FidelizacaoPublicoController {
  constructor(private fidelizacaoService: FidelizacaoService) {}

  @Get('cliente/:clienteId')
  async getDadosCliente(
    @Param('slug') slug: string,
    @Param('clienteId') clienteId: string,
    @Query('lojaId') lojaId: string,
  ) {
    const [carteira, cartao, nivel] = await Promise.all([
      this.fidelizacaoService.getCarteira(lojaId, clienteId),
      this.fidelizacaoService.getCartaoFidelidade(lojaId, clienteId),
      this.fidelizacaoService.calcularNivelVip(lojaId, clienteId),
    ]);
    const config = await this.fidelizacaoService.getConfig(lojaId);
    return {
      carteira: { saldo: carteira.saldo },
      selos: { atuais: cartao.selos_atuais, meta: config.meta_selos, total_recompensas: cartao.total_recompensas },
      nivel,
    };
  }
}
