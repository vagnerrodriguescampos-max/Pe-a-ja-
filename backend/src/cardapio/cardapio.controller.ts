import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CardapioService } from './cardapio.service';
import { LojaService } from '../loja/loja.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentLoja } from '../auth/decorators/current-loja.decorator';
import {
  AtualizarCategoriaDto,
  AtualizarGrupoOpcaoDto,
  AtualizarOpcaoDto,
  AtualizarProdutoDto,
  CriarCategoriaDto,
  CriarGrupoOpcaoDto,
  CriarOpcaoDto,
  CriarProdutoDto,
} from './dto/cardapio.dto';

// Rotas públicas — acessadas pelo slug
@Controller('loja/:slug')
export class CardapioPublicoController {
  constructor(
    private cardapioService: CardapioService,
    private lojaService: LojaService,
  ) {}

  @Get('cardapio')
  async getCardapio(@Param('slug') slug: string) {
    const loja = await this.lojaService.findBySlug(slug);
    return this.cardapioService.getCardapioCompleto(loja.id);
  }

  @Get('destaque')
  async getDestaque(@Param('slug') slug: string) {
    const loja = await this.lojaService.findBySlug(slug);
    return this.cardapioService.getProdutosDestaque(loja.id);
  }

  @Get('produto/:id')
  async getProduto(@Param('slug') slug: string, @Param('id') id: string) {
    const loja = await this.lojaService.findBySlug(slug);
    return this.cardapioService.getProduto(loja.id, id);
  }
}

// Rotas admin (protegidas por JWT)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin_loja', 'super_admin', 'atendente')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('admin')
export class CardapioAdminController {
  constructor(private cardapioService: CardapioService) {}

  @Get('cardapio')
  async getCardapio(@CurrentLoja() lojaId: string) {
    return this.cardapioService.getCardapioCompleto(lojaId);
  }

  @Post('categorias')
  async criarCategoria(@CurrentLoja() lojaId: string, @Body() body: CriarCategoriaDto) {
    return this.cardapioService.criarCategoria(lojaId, body);
  }

  @Patch('categorias/:id')
  async atualizarCategoria(
    @CurrentLoja() lojaId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: AtualizarCategoriaDto,
  ) {
    return this.cardapioService.atualizarCategoria(lojaId, id, body);
  }

  @Delete('categorias/:id')
  async deletarCategoria(@CurrentLoja() lojaId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.cardapioService.deletarCategoria(lojaId, id);
  }

  @Post('produtos')
  async criarProduto(@CurrentLoja() lojaId: string, @Body() body: CriarProdutoDto) {
    return this.cardapioService.criarProduto(lojaId, body);
  }

  @Patch('produtos/:id')
  async atualizarProduto(
    @CurrentLoja() lojaId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: AtualizarProdutoDto,
  ) {
    return this.cardapioService.atualizarProduto(lojaId, id, body);
  }

  @Delete('produtos/:id')
  async deletarProduto(@CurrentLoja() lojaId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.cardapioService.deletarProduto(lojaId, id);
  }

  @Post('produtos/:produtoId/grupos')
  async criarGrupo(
    @CurrentLoja() lojaId: string,
    @Param('produtoId', new ParseUUIDPipe()) produtoId: string,
    @Body() body: CriarGrupoOpcaoDto,
  ) {
    return this.cardapioService.criarGrupo(produtoId, lojaId, body);
  }

  @Patch('grupos/:id')
  async atualizarGrupo(
    @CurrentLoja() lojaId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: AtualizarGrupoOpcaoDto,
  ) {
    return this.cardapioService.atualizarGrupo(lojaId, id, body);
  }

  @Delete('grupos/:id')
  async deletarGrupo(@CurrentLoja() lojaId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.cardapioService.deletarGrupo(lojaId, id);
  }

  @Post('grupos/:grupoId/opcoes')
  async criarOpcao(
    @CurrentLoja() lojaId: string,
    @Param('grupoId', new ParseUUIDPipe()) grupoId: string,
    @Body() body: CriarOpcaoDto,
  ) {
    return this.cardapioService.criarOpcao(lojaId, grupoId, body);
  }

  @Patch('opcoes/:id')
  async atualizarOpcao(
    @CurrentLoja() lojaId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: AtualizarOpcaoDto,
  ) {
    return this.cardapioService.atualizarOpcao(lojaId, id, body);
  }

  @Delete('opcoes/:id')
  async deletarOpcao(@CurrentLoja() lojaId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.cardapioService.deletarOpcao(lojaId, id);
  }
}
