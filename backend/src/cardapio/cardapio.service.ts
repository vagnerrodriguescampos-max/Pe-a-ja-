import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Categoria } from './categoria/categoria.entity';
import { Produto } from './produto/produto.entity';
import { GrupoOpcao } from './grupo-opcao/grupo-opcao.entity';
import { Opcao } from './grupo-opcao/opcao.entity';
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

@Injectable()
export class CardapioService {
  constructor(
    @InjectRepository(Categoria) private catRepo: Repository<Categoria>,
    @InjectRepository(Produto) private prodRepo: Repository<Produto>,
    @InjectRepository(GrupoOpcao) private grupoRepo: Repository<GrupoOpcao>,
    @InjectRepository(Opcao) private opcaoRepo: Repository<Opcao>,
  ) {}

  async getCategorias(lojaId: string) {
    return this.catRepo.find({
      where: { loja_id: lojaId, ativa: true },
      order: { ordem: 'ASC' },
    });
  }

  async getCardapioCompleto(lojaId: string) {
    // One relational query avoids an additional product query for every category.
    return this.catRepo
      .createQueryBuilder('categoria')
      .leftJoinAndSelect(
        'categoria.produtos',
        'produto',
        'produto.loja_id = :lojaId AND produto.status = :status',
        { lojaId, status: 'ativo' },
      )
      .leftJoinAndSelect('produto.grupos_opcao', 'grupo')
      .leftJoinAndSelect('grupo.opcoes', 'opcao')
      .where('categoria.loja_id = :lojaId', { lojaId })
      .andWhere('categoria.ativa = :ativa', { ativa: true })
      .orderBy('categoria.ordem', 'ASC')
      .addOrderBy('produto.ordem', 'ASC')
      .addOrderBy('grupo.ordem', 'ASC')
      .addOrderBy('opcao.ordem', 'ASC')
      .getMany();
  }

  async getProduto(lojaId: string, id: string) {
    const produto = await this.prodRepo.findOne({
      where: { id, loja_id: lojaId },
      relations: ['grupos_opcao', 'grupos_opcao.opcoes'],
    });
    if (!produto) throw new NotFoundException('Produto não encontrado');
    return produto;
  }

  async getProdutosDestaque(lojaId: string) {
    return this.prodRepo.find({
      where: { loja_id: lojaId, destaque: true, status: 'ativo' },
      order: { ordem: 'ASC' },
      take: 8,
    });
  }

  // Admin: CRUD categorias
  async criarCategoria(lojaId: string, data: CriarCategoriaDto) {
    const categoria = this.catRepo.create({ ...data, loja_id: lojaId });
    return this.catRepo.save(categoria);
  }

  async atualizarCategoria(lojaId: string, id: string, data: AtualizarCategoriaDto) {
    await this.obterCategoriaDaLoja(lojaId, id);
    await this.catRepo.update({ id, loja_id: lojaId }, data);
    return this.obterCategoriaDaLoja(lojaId, id);
  }

  async deletarCategoria(lojaId: string, id: string) {
    await this.obterCategoriaDaLoja(lojaId, id);
    await this.catRepo.delete({ id, loja_id: lojaId });
    return { ok: true };
  }

  // Admin: CRUD produtos
  async criarProduto(lojaId: string, data: CriarProdutoDto) {
    await this.obterCategoriaDaLoja(lojaId, data.categoria_id);
    this.validarPrecoPromocional(data.preco, data.preco_promocional);
    const produto = this.prodRepo.create({ ...data, loja_id: lojaId });
    return this.prodRepo.save(produto);
  }

  async atualizarProduto(lojaId: string, id: string, data: AtualizarProdutoDto) {
    const produto = await this.obterProdutoDaLoja(lojaId, id);
    if (data.categoria_id) await this.obterCategoriaDaLoja(lojaId, data.categoria_id);

    const preco = data.preco === undefined ? Number(produto.preco) : data.preco;
    const precoPromocional = data.preco_promocional === undefined
      ? produto.preco_promocional
      : data.preco_promocional;
    this.validarPrecoPromocional(preco, precoPromocional);

    await this.prodRepo.update({ id, loja_id: lojaId }, data);
    return this.getProduto(lojaId, id);
  }

  async deletarProduto(lojaId: string, id: string) {
    await this.obterProdutoDaLoja(lojaId, id);
    await this.prodRepo.delete({ id, loja_id: lojaId });
    return { ok: true };
  }

  // Admin: CRUD grupos + opções. Every lookup joins back to produto.loja_id.
  async criarGrupo(produtoId: string, lojaId: string, data: CriarGrupoOpcaoDto) {
    await this.obterProdutoDaLoja(lojaId, produtoId);
    this.validarLimitesGrupo(data.tipo || 'unico', data.min ?? 0, data.max, data.obrigatorio || false);
    const grupo = this.grupoRepo.create({ ...data, produto_id: produtoId });
    return this.grupoRepo.save(grupo);
  }

  async atualizarGrupo(lojaId: string, id: string, data: AtualizarGrupoOpcaoDto) {
    const grupo = await this.obterGrupoDaLoja(lojaId, id);
    this.validarLimitesGrupo(
      data.tipo ?? grupo.tipo,
      data.min ?? grupo.min,
      data.max === undefined ? grupo.max : data.max,
      data.obrigatorio ?? grupo.obrigatorio,
    );
    await this.grupoRepo.update(id, data);
    return this.obterGrupoDaLoja(lojaId, id);
  }

  async deletarGrupo(lojaId: string, id: string) {
    await this.obterGrupoDaLoja(lojaId, id);
    await this.grupoRepo.delete(id);
    return { ok: true };
  }

  async criarOpcao(lojaId: string, grupoId: string, data: CriarOpcaoDto) {
    await this.obterGrupoDaLoja(lojaId, grupoId);
    const opcao = this.opcaoRepo.create({ ...data, grupo_opcao_id: grupoId });
    return this.opcaoRepo.save(opcao);
  }

  async atualizarOpcao(lojaId: string, id: string, data: AtualizarOpcaoDto) {
    await this.obterOpcaoDaLoja(lojaId, id);
    await this.opcaoRepo.update(id, data);
    return this.obterOpcaoDaLoja(lojaId, id);
  }

  async deletarOpcao(lojaId: string, id: string) {
    await this.obterOpcaoDaLoja(lojaId, id);
    await this.opcaoRepo.delete(id);
    return { ok: true };
  }

  private async obterCategoriaDaLoja(lojaId: string, id: string): Promise<Categoria> {
    const categoria = await this.catRepo.findOne({ where: { id, loja_id: lojaId } });
    if (!categoria) throw new NotFoundException('Categoria não encontrada');
    return categoria;
  }

  private async obterProdutoDaLoja(lojaId: string, id: string): Promise<Produto> {
    const produto = await this.prodRepo.findOne({ where: { id, loja_id: lojaId } });
    if (!produto) throw new NotFoundException('Produto não encontrado');
    return produto;
  }

  private async obterGrupoDaLoja(lojaId: string, id: string): Promise<GrupoOpcao> {
    const grupo = await this.grupoRepo
      .createQueryBuilder('grupo')
      .innerJoinAndSelect('grupo.produto', 'produto')
      .leftJoinAndSelect('grupo.opcoes', 'opcoes')
      .where('grupo.id = :id', { id })
      .andWhere('produto.loja_id = :lojaId', { lojaId })
      .getOne();
    if (!grupo) throw new NotFoundException('Grupo de opções não encontrado');
    return grupo;
  }

  private async obterOpcaoDaLoja(lojaId: string, id: string): Promise<Opcao> {
    const opcao = await this.opcaoRepo
      .createQueryBuilder('opcao')
      .innerJoinAndSelect('opcao.grupo_opcao', 'grupo')
      .innerJoin('grupo.produto', 'produto')
      .where('opcao.id = :id', { id })
      .andWhere('produto.loja_id = :lojaId', { lojaId })
      .getOne();
    if (!opcao) throw new NotFoundException('Opção não encontrada');
    return opcao;
  }

  private validarPrecoPromocional(preco: number, precoPromocional?: number) {
    if (precoPromocional !== null && precoPromocional !== undefined && Number(precoPromocional) > Number(preco)) {
      throw new BadRequestException('O preço promocional não pode ser maior que o preço normal');
    }
  }

  private validarLimitesGrupo(tipo: string, min: number, max: number | null | undefined, obrigatorio: boolean) {
    const minimo = Math.max(Number(min) || 0, obrigatorio ? 1 : 0);
    const maximo = max === null || max === undefined ? null : Number(max);

    if (tipo === 'unico' && (minimo > 1 || (maximo !== null && maximo > 1))) {
      throw new BadRequestException('Grupos de escolha única aceitam no máximo uma opção');
    }
    if (maximo !== null && (maximo < minimo || maximo < 1)) {
      throw new BadRequestException('O máximo de opções deve ser maior ou igual ao mínimo');
    }
  }
}
