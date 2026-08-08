import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CupomService } from './cupom.service';
import { LojaService } from '../loja/loja.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentLoja } from '../auth/decorators/current-loja.decorator';
import { AtualizarCupomDto, CriarCupomDto, ValidarCupomDto } from './dto/cupom.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin_loja', 'super_admin')
@Controller('admin/cupons')
export class CupomAdminController {
  constructor(private cupomService: CupomService) {}

  @Get()
  listar(@CurrentLoja() lojaId: string) {
    return this.cupomService.listar(lojaId);
  }

  @Post()
  criar(@CurrentLoja() lojaId: string, @Body() dto: CriarCupomDto) {
    return this.cupomService.criar(lojaId, dto);
  }

  @Get(':id/estatisticas')
  estatisticas(@CurrentLoja() lojaId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.cupomService.estatisticas(lojaId, id);
  }

  @Patch(':id')
  atualizar(
    @CurrentLoja() lojaId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarCupomDto,
  ) {
    return this.cupomService.atualizar(lojaId, id, dto);
  }

  @Delete(':id')
  remover(@CurrentLoja() lojaId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.cupomService.remover(lojaId, id);
  }
}

/**
 * Validação pública, usada pelo checkout antes de fechar o pedido.
 *
 * Com rate limit apertado: sem ele, este endpoint viraria um oráculo para descobrir
 * códigos de cupom por força bruta.
 */
@Controller('loja/:slug/cupom')
export class CupomPublicoController {
  constructor(
    private cupomService: CupomService,
    private lojaService: LojaService,
  ) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('validar')
  async validar(@Param('slug') slug: string, @Body() dto: ValidarCupomDto) {
    const loja = await this.lojaService.findBySlug(slug);
    return this.cupomService.previsualizar(loja.id, dto.codigo, dto.subtotal, dto.telefone);
  }
}
