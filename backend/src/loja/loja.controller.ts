import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { LojaService } from './loja.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentLoja } from '../auth/decorators/current-loja.decorator';

@Controller()
export class LojaController {
  constructor(private lojaService: LojaService) {}

  @Get('loja/:slug')
  async getBySlug(@Param('slug') slug: string) {
    return this.lojaService.findBySlug(slug);
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/loja')
  async getMyLoja(@CurrentLoja() lojaId: string) {
    return this.lojaService.findById(lojaId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('admin/loja')
  async updateLoja(@CurrentLoja() lojaId: string, @Body() body: any) {
    const allowed = ['nome', 'logo_url', 'cor_primaria', 'telefone', 'endereco',
      'chave_pix', 'tipo_chave_pix', 'aberta', 'prazo_medio_min',
      'mensagem_topo', 'taxa_entrega_padrao', 'pedido_minimo'];
    const data: any = {};
    for (const k of allowed) if (body[k] !== undefined) data[k] = body[k];
    return this.lojaService.update(lojaId, data);
  }
}
