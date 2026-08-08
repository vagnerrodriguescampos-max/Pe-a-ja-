import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { Pedido, PedidoItem, PedidoItemOpcao } from './pedido.entity';
import { Cliente, Endereco } from './cliente.entity';
import { PedidoGateway } from '../websocket/pedido.gateway';
import { LojaService } from '../loja/loja.service';
import { FidelizacaoService } from '../fidelizacao/fidelizacao.service';
import { PushService } from '../push/push.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { Produto } from '../cardapio/produto/produto.entity';
import { Opcao } from '../cardapio/grupo-opcao/opcao.entity';
import { Carteira, TransacaoCarteira } from '../fidelizacao/fidelizacao.entity';
import { CriarPedidoDto, PedidoItemDto } from './dto/criar-pedido.dto';
import { CupomService } from '../cupom/cupom.service';

const STATUS_TRANSITIONS: Record<string, string[]> = {
  recebido: ['confirmado', 'cancelado'],
  confirmado: ['em_producao', 'cancelado'],
  em_producao: ['pronto', 'cancelado'],
  pronto: ['saiu_para_entrega', 'entregue', 'cancelado'],
  saiu_para_entrega: ['entregue', 'cancelado'],
  entregue: [],
  cancelado: [],
};

interface ItemCalculado {
  produto: Produto;
  quantidade: number;
  observacao?: string;
  precoUnitarioCentavos: number;
  opcoes: Opcao[];
}

@Injectable()
export class PedidoService {
  constructor(
    @InjectRepository(Pedido) private pedidoRepo: Repository<Pedido>,
    @InjectRepository(PedidoItem) private itemRepo: Repository<PedidoItem>,
    @InjectRepository(PedidoItemOpcao) private opcaoRepo: Repository<PedidoItemOpcao>,
    @InjectRepository(Cliente) private clienteRepo: Repository<Cliente>,
    @InjectRepository(Endereco) private enderecoRepo: Repository<Endereco>,
    private dataSource: DataSource,
    private pedidoGateway: PedidoGateway,
    private lojaService: LojaService,
    private cupomService: CupomService,
    @Optional() private fidelizacaoService: FidelizacaoService,
    @Optional() private pushService: PushService,
    @Optional() private whatsappService: WhatsappService,
  ) {}

  /**
   * The browser only chooses product and option IDs. Names, prices and totals
   * are always resolved from the store's current catalog inside the transaction.
   */
  async criarPedido(lojaId: string, body: CriarPedidoDto) {
    const loja = await this.lojaService.findById(lojaId);

    if (!loja.aberta) throw new BadRequestException('Loja fechada no momento');

    const resultado = await this.dataSource.transaction(async manager => {
      const telefone = this.normalizarTelefone(body.cliente?.telefone);
      const nomeCliente = body.cliente?.nome?.trim();
      if (!nomeCliente || telefone.length < 8) {
        throw new BadRequestException('Dados do cliente inválidos');
      }

      const cliente = await this.resolverCliente(manager, lojaId, body, telefone, nomeCliente);
      const enderecoSnapshot = await this.salvarEnderecoSeNecessario(manager, cliente, body);
      const itens = await this.calcularItens(manager, lojaId, body.itens);

      const subtotalCentavos = itens.reduce(
        (total, item) => total + (item.precoUnitarioCentavos + item.opcoes.reduce(
          (opcoesTotal, opcao) => opcoesTotal + this.paraCentavos(opcao.preco_adicional, 'preço adicional'),
          0,
        )) * item.quantidade,
        0,
      );
      const pedidoMinimoCentavos = this.paraCentavos(loja.pedido_minimo, 'pedido mínimo');
      if (subtotalCentavos < pedidoMinimoCentavos) {
        throw new BadRequestException(
          `Pedido mínimo de R$ ${this.formatarValor(pedidoMinimoCentavos)} não atingido`,
        );
      }

      const taxaEntregaCentavos = body.tipo === 'entrega'
        ? this.paraCentavos(loja.taxa_entrega_padrao, 'taxa de entrega')
        : 0;

      // Cupom incide sobre os itens, nunca sobre a taxa de entrega — descontar o frete
      // sairia do bolso da loja sem o cliente perceber o que ganhou.
      // Revalidado aqui dentro da transação: a prévia do checkout é só informativa e
      // não pode ser a fonte de verdade do desconto.
      const cupomAplicado = body.cupom_codigo
        ? await this.cupomService.avaliar(manager, lojaId, body.cupom_codigo, cliente, subtotalCentavos)
        : null;
      const descontoCupomCentavos = cupomAplicado?.descontoCentavos ?? 0;

      const totalAntesDoDesconto = subtotalCentavos - descontoCupomCentavos + taxaEntregaCentavos;

      const { carteira, descontoCentavos } = await this.calcularDescontoCarteira(
        manager,
        lojaId,
        cliente,
        body,
        telefone,
        totalAntesDoDesconto,
      );
      const totalCentavos = totalAntesDoDesconto - descontoCentavos;
      const trocoParaCentavos = this.validarTroco(body, totalCentavos);

      const [{ nextval }] = await manager.query(`SELECT nextval('pedido_numero_seq') as nextval`);
      // Gerado numa variável local e nunca relido da entidade: token_acesso tem
      // select:false, e o reload que o TypeORM faz apos o INSERT usa o SELECT
      // padrao (sem esse campo), apagando o valor em memoria se a gente tentasse
      // ler de volta em savedPedido.token_acesso.
      const tokenAcesso = randomBytes(32).toString('hex');
      const pedido = manager.create(Pedido, {
        loja_id: lojaId,
        cliente_id: cliente.id,
        numero_sequencial: Number(nextval),
        tipo: body.tipo,
        status: 'recebido',
        subtotal: this.deCentavos(subtotalCentavos),
        taxa_entrega: this.deCentavos(taxaEntregaCentavos),
        desconto: this.deCentavos(descontoCentavos),
        cupom_id: cupomAplicado?.cupom.id ?? null,
        desconto_cupom: this.deCentavos(descontoCupomCentavos),
        total: this.deCentavos(totalCentavos),
        forma_pagamento: body.forma_pagamento,
        troco_para: trocoParaCentavos === null ? null : this.deCentavos(trocoParaCentavos),
        observacoes: body.observacoes?.trim() || null,
        endereco_entrega: enderecoSnapshot,
        token_acesso: tokenAcesso,
      });
      const savedPedido = await manager.save(pedido);

      for (const itemCalculado of itens) {
        const item = manager.create(PedidoItem, {
          pedido_id: savedPedido.id,
          produto_id: itemCalculado.produto.id,
          nome_snapshot: itemCalculado.produto.nome,
          preco_unitario: this.deCentavos(itemCalculado.precoUnitarioCentavos),
          quantidade: itemCalculado.quantidade,
          observacao: itemCalculado.observacao?.trim() || null,
        });
        const savedItem = await manager.save(item);

        for (const opcao of itemCalculado.opcoes) {
          await manager.save(manager.create(PedidoItemOpcao, {
            pedido_item_id: savedItem.id,
            opcao_id: opcao.id,
            nome_snapshot: opcao.nome,
            preco_adicional_snapshot: this.deCentavos(
              this.paraCentavos(opcao.preco_adicional, 'preço adicional'),
            ),
          }));
        }
      }

      if (carteira && descontoCentavos > 0) {
        const desconto = this.deCentavos(descontoCentavos);
        const debito = await manager
          .createQueryBuilder()
          .update(Carteira)
          .set({ saldo: () => `"saldo" - ${desconto.toFixed(2)}` })
          .where('id = :id', { id: carteira.id })
          .andWhere('saldo >= :desconto', { desconto })
          .execute();

        if (debito.affected !== 1) {
          throw new BadRequestException('Saldo da carteira indisponível');
        }

        await manager.save(manager.create(TransacaoCarteira, {
          carteira_id: carteira.id,
          tipo: 'debito',
          valor: desconto,
          descricao: `Desconto no pedido #${savedPedido.numero_sequencial}`,
          pedido_id: savedPedido.id,
        }));
      }

      // Registrado dentro da mesma transação do pedido: se o pedido falhar depois
      // daqui, o resgate do cupom volta atrás junto e o cliente não perde o benefício.
      if (cupomAplicado) {
        await this.cupomService.registrarUso(
          manager,
          cupomAplicado.cupom,
          cliente.id,
          savedPedido.id,
          descontoCupomCentavos,
        );
      }

      const pedidoCompleto = await manager.findOne(Pedido, {
        where: { id: savedPedido.id },
        relations: ['itens', 'itens.opcoes'],
      });
      if (!pedidoCompleto) throw new NotFoundException('Pedido não encontrado');

      return { pedido: pedidoCompleto, cliente, tokenAcesso };
    });

    // Eventos só são disparados após a transação confirmar o pedido e o débito.
    this.pedidoGateway.emitNovoPedido(lojaId, resultado.pedido);
    this.pushService?.enviarParaLoja(lojaId, {
      type: 'novo_pedido',
      title: `🔔 Pedido #${resultado.pedido.numero_sequencial}`,
      body: `${resultado.pedido.itens?.length || 0} itens — R$ ${Number(resultado.pedido.total).toFixed(2)}`,
      url: '/admin/pedidos',
    }).catch(() => {});
    this.whatsappService?.enviarTemplate(
      lojaId,
      resultado.cliente.telefone,
      'pedido_confirmado',
      [String(resultado.pedido.numero_sequencial)],
    ).catch(() => {});

    return {
      ...resultado.pedido,
      cliente: { nome: resultado.cliente.nome, telefone: resultado.cliente.telefone },
      token_acesso: resultado.tokenAcesso,
    };
  }

  async getPedido(id: string, tokenAcesso: string) {
    if (!/^[a-f0-9]{64}$/i.test(tokenAcesso || '')) {
      throw new NotFoundException('Pedido não encontrado');
    }

    const pedido = await this.pedidoRepo
      .createQueryBuilder('pedido')
      .addSelect('pedido.token_acesso')
      .leftJoinAndSelect('pedido.itens', 'itens')
      .leftJoinAndSelect('itens.opcoes', 'opcoes')
      .where('pedido.id = :id', { id })
      .andWhere('pedido.token_acesso = :tokenAcesso', { tokenAcesso })
      .getOne();

    if (!pedido) throw new NotFoundException('Pedido não encontrado');

    const { loja_id, cliente_id, motoboy_id, token_acesso, ...pedidoPublico } = pedido;
    return pedidoPublico;
  }

  async listarPedidos(lojaId: string, status?: string) {
    const where: any = { loja_id: lojaId };
    if (status) where.status = status;
    return this.pedidoRepo.find({
      where,
      relations: ['itens', 'itens.opcoes'],
      order: { criado_em: 'DESC' },
      take: 100,
    });
  }

  async atualizarStatus(lojaId: string, id: string, novoStatus: string, motoboyId?: string) {
    const pedido = await this.pedidoRepo.findOne({ where: { id, loja_id: lojaId } });
    if (!pedido) throw new NotFoundException('Pedido não encontrado');
    if (motoboyId && pedido.motoboy_id !== motoboyId) {
      throw new NotFoundException('Pedido não encontrado');
    }

    const permitidos = STATUS_TRANSITIONS[pedido.status] || [];
    if (!permitidos.includes(novoStatus)) {
      throw new BadRequestException(`Transição inválida: ${pedido.status} → ${novoStatus}`);
    }

    await this.pedidoRepo.update(id, { status: novoStatus });
    this.pedidoGateway.emitStatusAtualizado(lojaId, id, novoStatus);

    if (novoStatus === 'entregue' && this.fidelizacaoService) {
      this.fidelizacaoService.processarPosEntrega(id).catch(() => {});
    }

    // Um único aviso de status via WhatsApp por pedido, além da confirmação: "pronto"
    // para retirada, "saiu para entrega" para entrega — mantém o custo em 2 msgs/pedido.
    const statusNotificavel = pedido.tipo === 'retirada' ? 'pronto' : 'saiu_para_entrega';
    if (this.whatsappService && novoStatus === statusNotificavel) {
      this.notificarStatusWhatsapp(lojaId, pedido, novoStatus).catch(() => {});
    }

    return { id, status: novoStatus };
  }

  private async notificarStatusWhatsapp(lojaId: string, pedido: Pedido, novoStatus: string) {
    const cliente = await this.clienteRepo.findOne({ where: { id: pedido.cliente_id } });
    if (!cliente) return;
    const template = novoStatus === 'saiu_para_entrega' ? 'pedido_saiu_entrega' : 'pedido_pronto';
    await this.whatsappService?.enviarTemplate(lojaId, cliente.telefone, template, [String(pedido.numero_sequencial)]);
  }

  private async resolverCliente(
    manager: EntityManager,
    lojaId: string,
    body: CriarPedidoDto,
    telefone: string,
    nomeCliente: string,
  ): Promise<Cliente> {
    const email = body.cliente.email?.trim() || null;
    const dataNascimento = body.cliente.data_nascimento || null;

    // Aniversário só é gravado quando vem preenchido. Um pedido posterior sem o campo
    // não pode apagar a data que o cliente já informou — é ela que alimenta o cupom
    // de aniversário.
    const dadosCliente = dataNascimento
      ? { nome: nomeCliente, email, data_nascimento: dataNascimento }
      : { nome: nomeCliente, email };

    if (body.usar_carteira) {
      if (!body.cliente_id_fidelizacao) {
        throw new BadRequestException('Cliente da carteira não informado');
      }

      const clienteDaCarteira = await manager.findOne(Cliente, {
        where: { id: body.cliente_id_fidelizacao, loja_id: lojaId },
      });
      if (!clienteDaCarteira || this.normalizarTelefone(clienteDaCarteira.telefone) !== telefone) {
        throw new BadRequestException('Cliente da carteira não confere com o telefone informado');
      }

      await manager.update(Cliente, clienteDaCarteira.id, dadosCliente);
      return { ...clienteDaCarteira, ...dadosCliente };
    }

    let cliente = await manager.findOne(Cliente, {
      where: { loja_id: lojaId, telefone },
    });
    if (!cliente) {
      cliente = manager.create(Cliente, {
        loja_id: lojaId,
        telefone,
        ...dadosCliente,
      });
      return manager.save(cliente);
    }

    await manager.update(Cliente, cliente.id, dadosCliente);
    return { ...cliente, ...dadosCliente };
  }

  private async salvarEnderecoSeNecessario(
    manager: EntityManager,
    cliente: Cliente,
    body: CriarPedidoDto,
  ) {
    if (body.tipo !== 'entrega') return null;

    const endereco = body.endereco;
    if (!endereco?.rua?.trim() || !endereco.numero?.trim() || !endereco.bairro?.trim() || !endereco.cidade?.trim()) {
      throw new BadRequestException('Endereço de entrega incompleto');
    }

    const snapshot = {
      rua: endereco.rua.trim(),
      numero: endereco.numero.trim(),
      complemento: endereco.complemento?.trim() || null,
      bairro: endereco.bairro.trim(),
      cidade: endereco.cidade.trim(),
      estado: endereco.estado?.trim().toUpperCase() || null,
      cep: endereco.cep?.replace(/\D/g, '') || null,
      referencia: endereco.referencia?.trim() || null,
      lat: endereco.lat ?? null,
      lng: endereco.lng ?? null,
    };
    await manager.save(manager.create(Endereco, { cliente_id: cliente.id, ...snapshot }));
    return snapshot;
  }

  private async calcularItens(
    manager: EntityManager,
    lojaId: string,
    itensSolicitados: PedidoItemDto[],
  ): Promise<ItemCalculado[]> {
    if (!Array.isArray(itensSolicitados) || itensSolicitados.length === 0 || itensSolicitados.length > 50) {
      throw new BadRequestException('Informe entre 1 e 50 itens');
    }

    const itens: ItemCalculado[] = [];
    for (const itemSolicitado of itensSolicitados) {
      if (!Number.isInteger(itemSolicitado.quantidade) || itemSolicitado.quantidade < 1 || itemSolicitado.quantidade > 50) {
        throw new BadRequestException('Quantidade de item inválida');
      }

      const produto = await manager.findOne(Produto, {
        where: { id: itemSolicitado.produto_id, loja_id: lojaId, status: 'ativo' },
        relations: ['categoria', 'grupos_opcao', 'grupos_opcao.opcoes'],
      });
      if (!produto || !produto.categoria?.ativa) {
        throw new BadRequestException('Um dos produtos não está disponível nesta loja');
      }

      const idsDasOpcoes = (itemSolicitado.opcoes || []).map(opcao => opcao.opcao_id);
      if (new Set(idsDasOpcoes).size !== idsDasOpcoes.length) {
        throw new BadRequestException(`Uma opção foi repetida em "${produto.nome}"`);
      }

      const opcoesPorId = new Map<string, Opcao>();
      const opcoesPorGrupo = new Map<string, Opcao[]>();
      for (const grupo of produto.grupos_opcao || []) {
        for (const opcao of grupo.opcoes || []) {
          opcoesPorId.set(opcao.id, opcao);
        }
      }

      const opcoesSelecionadas: Opcao[] = [];
      for (const opcaoId of idsDasOpcoes) {
        const opcao = opcoesPorId.get(opcaoId);
        if (!opcao || !opcao.ativa) {
          throw new BadRequestException(`Opção inválida para "${produto.nome}"`);
        }
        opcoesSelecionadas.push(opcao);
        const selecionadasDoGrupo = opcoesPorGrupo.get(opcao.grupo_opcao_id) || [];
        selecionadasDoGrupo.push(opcao);
        opcoesPorGrupo.set(opcao.grupo_opcao_id, selecionadasDoGrupo);
      }

      for (const grupo of produto.grupos_opcao || []) {
        const quantidadeSelecionada = (opcoesPorGrupo.get(grupo.id) || []).length;
        const min = Math.max(Number(grupo.min) || 0, grupo.obrigatorio ? 1 : 0);
        const maxConfigurado = grupo.max === null || grupo.max === undefined
          ? Number.POSITIVE_INFINITY
          : Number(grupo.max);
        const max = grupo.tipo === 'unico' ? Math.min(maxConfigurado, 1) : maxConfigurado;

        if (!Number.isFinite(max) && max !== Number.POSITIVE_INFINITY) {
          throw new BadRequestException(`Configuração inválida do grupo "${grupo.nome}"`);
        }
        if (min > max || quantidadeSelecionada < min || quantidadeSelecionada > max) {
          throw new BadRequestException(`Seleção inválida no grupo "${grupo.nome}"`);
        }
      }

      const precoBase = produto.preco_promocional === null || produto.preco_promocional === undefined
        ? produto.preco
        : produto.preco_promocional;
      itens.push({
        produto,
        quantidade: itemSolicitado.quantidade,
        observacao: itemSolicitado.observacao,
        precoUnitarioCentavos: this.paraCentavos(precoBase, `preço de ${produto.nome}`),
        opcoes: opcoesSelecionadas,
      });
    }

    return itens;
  }

  private async calcularDescontoCarteira(
    manager: EntityManager,
    lojaId: string,
    cliente: Cliente,
    body: CriarPedidoDto,
    telefone: string,
    totalAntesDoDesconto: number,
  ): Promise<{ carteira: Carteira | null; descontoCentavos: number }> {
    if (!body.usar_carteira) return { carteira: null, descontoCentavos: 0 };

    if (!body.cliente_id_fidelizacao || body.cliente_id_fidelizacao !== cliente.id
      || this.normalizarTelefone(cliente.telefone) !== telefone) {
      throw new BadRequestException('Cliente da carteira inválido');
    }

    const carteira = await manager
      .getRepository(Carteira)
      .createQueryBuilder('carteira')
      .setLock('pessimistic_write')
      .where('carteira.loja_id = :lojaId', { lojaId })
      .andWhere('carteira.cliente_id = :clienteId', { clienteId: cliente.id })
      .getOne();

    if (!carteira) {
      throw new BadRequestException('Carteira do cliente não encontrada');
    }

    const saldoCentavos = this.paraCentavos(carteira.saldo, 'saldo da carteira');
    return {
      carteira,
      descontoCentavos: Math.min(saldoCentavos, totalAntesDoDesconto),
    };
  }

  private validarTroco(body: CriarPedidoDto, totalCentavos: number): number | null {
    const trocoPara = body.troco_para;
    if (trocoPara === null || trocoPara === undefined) return null;

    if (body.forma_pagamento !== 'dinheiro') {
      throw new BadRequestException('Troco só pode ser informado para pagamento em dinheiro');
    }

    const trocoParaCentavos = this.paraCentavos(trocoPara, 'valor para troco');
    if (trocoParaCentavos < totalCentavos) {
      throw new BadRequestException('O valor para troco não pode ser menor que o total do pedido');
    }
    return trocoParaCentavos;
  }

  private normalizarTelefone(telefone: string | undefined): string {
    return (telefone || '').replace(/\D/g, '');
  }

  private paraCentavos(valor: unknown, campo: string): number {
    const numero = Number(valor);
    if (!Number.isFinite(numero) || numero < 0 || numero > 100000) {
      throw new BadRequestException(`${campo} inválido`);
    }
    return Math.round((numero + Number.EPSILON) * 100);
  }

  private deCentavos(centavos: number): number {
    return centavos / 100;
  }

  private formatarValor(centavos: number): string {
    return this.deCentavos(centavos).toFixed(2).replace('.', ',');
  }
}
