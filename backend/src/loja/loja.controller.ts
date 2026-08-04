import { BadRequestException, Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { LojaService } from './loja.service';
import { HorarioDia } from './loja.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentLoja } from '../auth/decorators/current-loja.decorator';

@Controller()
export class LojaController {
  constructor(private lojaService: LojaService) {}

  @Get('loja/:slug')
  async getBySlug(@Param('slug') slug: string) {
    return this.lojaService.findBySlug(slug);
  }

  // Leitura liberada ao atendente: a tela de pedidos usa isto para mostrar o status da loja.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin_loja', 'super_admin', 'atendente')
  @Get('admin/loja')
  async getMyLoja(@CurrentLoja() lojaId: string) {
    return this.lojaService.findById(lojaId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin_loja', 'super_admin')
  @Patch('admin/loja')
  async updateLoja(@CurrentLoja() lojaId: string, @Body() body: any) {
    const allowed = ['nome', 'logo_url', 'cor_primaria', 'telefone', 'endereco',
      'chave_pix', 'tipo_chave_pix', 'aberta', 'prazo_medio_min',
      'mensagem_topo', 'taxa_entrega_padrao', 'pedido_minimo',
      'horario_automatico', 'horarios', 'onboarding_concluido'];
    const data: any = {};
    for (const k of allowed) if (body[k] !== undefined) data[k] = body[k];
    if (data.horarios !== undefined) data.horarios = this.validarHorarios(data.horarios);
    return this.lojaService.update(lojaId, data);
  }

  private validarHorarios(horarios: unknown): HorarioDia[] | null {
    if (horarios === null) return null;
    if (!Array.isArray(horarios) || horarios.length !== 7) {
      throw new BadRequestException('Configuração de horários inválida');
    }
    const horaValida = /^([01]\d|2[0-3]):[0-5]\d$/;
    return horarios.map((item: any) => {
      const diaSemana = Number(item?.dia_semana);
      const fechado = Boolean(item?.fechado);
      const abre = String(item?.abre || '');
      const fecha = String(item?.fecha || '');
      if (!Number.isInteger(diaSemana) || diaSemana < 0 || diaSemana > 6) {
        throw new BadRequestException('Dia da semana inválido nos horários');
      }
      if (!fechado && (!horaValida.test(abre) || !horaValida.test(fecha))) {
        throw new BadRequestException('Horário de abertura/fechamento inválido');
      }
      return { dia_semana: diaSemana, fechado, abre, fecha };
    });
  }
}
