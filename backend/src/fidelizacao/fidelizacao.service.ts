import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, IsNull, Not } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  ConfigFidelizacao, Carteira, TransacaoCarteira,
  CartaoFidelidade, CampanhaMarketing, LogCampanha,
} from './fidelizacao.entity';
import { Cliente } from '../pedido/cliente.entity';
import { Pedido } from '../pedido/pedido.entity';
import { Conversa } from '../chat/conversa.entity';
import { ChatService } from '../chat/chat.service';

export type NivelVip = 'bronze' | 'prata' | 'ouro';

@Injectable()
export class FidelizacaoService {
  private readonly logger = new Logger(FidelizacaoService.name);

  constructor(
    @InjectRepository(ConfigFidelizacao) private configRepo: Repository<ConfigFidelizacao>,
    @InjectRepository(Carteira) private carteiraRepo: Repository<Carteira>,
    @InjectRepository(TransacaoCarteira) private transacaoRepo: Repository<TransacaoCarteira>,
    @InjectRepository(CartaoFidelidade) private cartaoRepo: Repository<CartaoFidelidade>,
    @InjectRepository(CampanhaMarketing) private campanhaRepo: Repository<CampanhaMarketing>,
    @InjectRepository(LogCampanha) private logCampanhaRepo: Repository<LogCampanha>,
    @InjectRepository(Cliente) private clienteRepo: Repository<Cliente>,
    @InjectRepository(Pedido) private pedidoRepo: Repository<Pedido>,
    @InjectRepository(Conversa) private conversaRepo: Repository<Conversa>,
    private chatService: ChatService,
  ) {}

  // ── Config ─────────────────────────────────────────────────────────────────

  async getConfig(lojaId: string): Promise<ConfigFidelizacao> {
    let config = await this.configRepo.findOne({ where: { loja_id: lojaId } });
    if (!config) {
      config = this.configRepo.create({ loja_id: lojaId });
      config = await this.configRepo.save(config);
    }
    return config;
  }

  async updateConfig(lojaId: string, dto: Partial<ConfigFidelizacao>): Promise<ConfigFidelizacao> {
    let config = await this.configRepo.findOne({ where: { loja_id: lojaId } });
    if (!config) {
      config = this.configRepo.create({ loja_id: lojaId, ...dto });
    } else {
      Object.assign(config, dto);
    }
    return this.configRepo.save(config);
  }

  // ── Carteira ───────────────────────────────────────────────────────────────

  async getCarteira(lojaId: string, clienteId: string): Promise<Carteira> {
    let carteira = await this.carteiraRepo.findOne({ where: { loja_id: lojaId, cliente_id: clienteId } });
    if (!carteira) {
      carteira = this.carteiraRepo.create({ loja_id: lojaId, cliente_id: clienteId, saldo: 0 });
      carteira = await this.carteiraRepo.save(carteira);
    }
    return carteira;
  }

  async getExtrato(lojaId: string, clienteId: string, limit = 20): Promise<TransacaoCarteira[]> {
    const carteira = await this.getCarteira(lojaId, clienteId);
    return this.transacaoRepo.find({
      where: { carteira_id: carteira.id },
      order: { criado_em: 'DESC' },
      take: limit,
    });
  }

  private async creditarCarteira(lojaId: string, clienteId: string, valor: number, descricao: string, pedidoId?: string) {
    const carteira = await this.getCarteira(lojaId, clienteId);
    await this.carteiraRepo.update(carteira.id, { saldo: () => `saldo + ${valor}` });
    await this.transacaoRepo.save(this.transacaoRepo.create({
      carteira_id: carteira.id,
      tipo: 'credito',
      valor,
      descricao,
      pedido_id: pedidoId || null,
    }));
  }

  async debitarCarteira(lojaId: string, clienteId: string, valor: number, descricao: string, pedidoId?: string): Promise<void> {
    const carteira = await this.getCarteira(lojaId, clienteId);
    if (Number(carteira.saldo) < valor) throw new Error('Saldo insuficiente');
    await this.carteiraRepo.update(carteira.id, { saldo: () => `saldo - ${valor}` });
    await this.transacaoRepo.save(this.transacaoRepo.create({
      carteira_id: carteira.id,
      tipo: 'debito',
      valor,
      descricao,
      pedido_id: pedidoId || null,
    }));
  }

  // ── Selos ──────────────────────────────────────────────────────────────────

  async getCartaoFidelidade(lojaId: string, clienteId: string): Promise<CartaoFidelidade> {
    let cartao = await this.cartaoRepo.findOne({ where: { loja_id: lojaId, cliente_id: clienteId } });
    if (!cartao) {
      cartao = this.cartaoRepo.create({ loja_id: lojaId, cliente_id: clienteId });
      cartao = await this.cartaoRepo.save(cartao);
    }
    return cartao;
  }

  // ── Nível VIP ─────────────────────────────────────────────────────────────

  async calcularNivelVip(lojaId: string, clienteId: string): Promise<NivelVip> {
    const config = await this.getConfig(lojaId);
    const result = await this.pedidoRepo
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.total), 0)', 'total')
      .where('p.loja_id = :lojaId', { lojaId })
      .andWhere('p.cliente_id = :clienteId', { clienteId })
      .andWhere('p.status = :status', { status: 'entregue' })
      .getRawOne();
    const total = parseFloat(result.total);
    if (total >= Number(config.vip_ouro_gasto)) return 'ouro';
    if (total >= Number(config.vip_prata_gasto)) return 'prata';
    return 'bronze';
  }

  // ── Pós-entrega ────────────────────────────────────────────────────────────

  async processarPosEntrega(pedidoId: string): Promise<void> {
    const pedido = await this.pedidoRepo.findOne({ where: { id: pedidoId } });
    if (!pedido) return;

    const config = await this.getConfig(pedido.loja_id);
    if (!config.ativo) return;

    // 1. Cashback
    const nivel = await this.calcularNivelVip(pedido.loja_id, pedido.cliente_id);
    const percentual = Number(config.cashback_percentual) + (nivel !== 'bronze' ? Number(config.vip_cashback_extra) : 0);
    const valorCashback = Number(pedido.total) * (percentual / 100);
    await this.creditarCarteira(pedido.loja_id, pedido.cliente_id, valorCashback,
      `Cashback ${percentual}% do pedido #${pedido.numero_sequencial}`, pedidoId);

    // 2. Selos
    const cartao = await this.getCartaoFidelidade(pedido.loja_id, pedido.cliente_id);
    const novosSelos = cartao.selos_atuais + 1;
    if (novosSelos >= config.meta_selos) {
      // Ganhou recompensa!
      await this.cartaoRepo.update(cartao.id, {
        selos_atuais: 0,
        total_recompensas: cartao.total_recompensas + 1,
      });
      if (config.recompensa_tipo === 'desconto') {
        await this.creditarCarteira(pedido.loja_id, pedido.cliente_id, Number(config.recompensa_valor),
          `Recompensa fidelidade: ${config.meta_selos} pedidos completados`, pedidoId);
      }
      // Notificar via chat
      await this.notificarCliente(pedido.loja_id, pedido.cliente_id,
        `Parabéns! Você completou ${config.meta_selos} pedidos e ganhou sua recompensa de fidelidade! 🎉`);
    } else {
      await this.cartaoRepo.update(cartao.id, { selos_atuais: novosSelos });
    }

    // 3. Mensagem de boas-vindas (primeiro pedido)
    const totalPedidos = await this.pedidoRepo.count({
      where: { loja_id: pedido.loja_id, cliente_id: pedido.cliente_id, status: 'entregue' },
    });
    if (totalPedidos === 1) {
      const campanha = await this.campanhaRepo.findOne({
        where: { loja_id: pedido.loja_id, tipo: 'boas_vindas', ativa: true },
      });
      if (campanha) {
        const cliente = await this.clienteRepo.findOne({ where: { id: pedido.cliente_id } });
        const msg = campanha.mensagem.replace('{nome}', cliente?.nome || 'cliente');
        await this.notificarCliente(pedido.loja_id, pedido.cliente_id, msg);
        await this.registrarLogCampanha(campanha.id, pedido.cliente_id);
      }
    }
  }

  // ── Campanhas ──────────────────────────────────────────────────────────────

  async getCampanhas(lojaId: string): Promise<CampanhaMarketing[]> {
    return this.campanhaRepo.find({ where: { loja_id: lojaId } });
  }

  async upsertCampanha(lojaId: string, tipo: string, dto: Partial<CampanhaMarketing>): Promise<CampanhaMarketing> {
    let campanha = await this.campanhaRepo.findOne({ where: { loja_id: lojaId, tipo } });
    if (!campanha) {
      campanha = this.campanhaRepo.create({ loja_id: lojaId, tipo, ...dto });
    } else {
      Object.assign(campanha, dto);
    }
    return this.campanhaRepo.save(campanha);
  }

  private async registrarLogCampanha(campanhaId: string, clienteId: string) {
    await this.logCampanhaRepo.save(this.logCampanhaRepo.create({ campanha_id: campanhaId, cliente_id: clienteId }));
  }

  private async jaRecebeuCampanha(campanhaId: string, clienteId: string, diasJanela = 30): Promise<boolean> {
    const desde = new Date();
    desde.setDate(desde.getDate() - diasJanela);
    const log = await this.logCampanhaRepo.findOne({
      where: { campanha_id: campanhaId, cliente_id: clienteId },
      order: { enviado_em: 'DESC' },
    });
    if (!log) return false;
    return log.enviado_em > desde;
  }

  private async notificarCliente(lojaId: string, clienteId: string, mensagem: string) {
    try {
      const conversa = await this.conversaRepo.findOne({ where: { loja_id: lojaId, cliente_id: clienteId } });
      if (!conversa) return;
      await this.chatService.enviarMensagem(conversa.id, 'sistema', mensagem);
    } catch (e) {
      this.logger.warn(`Falha ao notificar cliente ${clienteId}: ${e.message}`);
    }
  }

  // Cron: rodar campanhas de recompra e aniversário diariamente
  @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async executarCampanhas() {
    this.logger.log('Executando campanhas de marketing...');

    const campanhas = await this.campanhaRepo.find({ where: { ativa: true } });
    for (const campanha of campanhas) {
      try {
        if (campanha.tipo === 'recompra') await this.executarCampanhaRecompra(campanha);
        if (campanha.tipo === 'aniversario') await this.executarCampanhaAniversario(campanha);
      } catch (e) {
        this.logger.error(`Erro na campanha ${campanha.id}: ${e.message}`);
      }
    }
  }

  private async executarCampanhaRecompra(campanha: CampanhaMarketing) {
    const dias = campanha.dias_sem_compra || 7;
    const limite = new Date();
    limite.setDate(limite.getDate() - dias);

    // Busca clientes da loja que tiveram pedido antes do limite e não pediram depois
    const clientes = await this.clienteRepo
      .createQueryBuilder('c')
      .where('c.loja_id = :lojaId', { lojaId: campanha.loja_id })
      .andWhere(qb => {
        const sub = qb.subQuery()
          .select('MAX(p.criado_em)')
          .from(Pedido, 'p')
          .where('p.cliente_id = c.id')
          .andWhere('p.loja_id = :lojaId')
          .getQuery();
        return `(${sub}) < :limite`;
      })
      .setParameter('limite', limite)
      .getMany();

    for (const cliente of clientes) {
      if (await this.jaRecebeuCampanha(campanha.id, cliente.id, dias)) continue;
      const msg = campanha.mensagem.replace('{nome}', cliente.nome || 'cliente');
      await this.notificarCliente(campanha.loja_id, cliente.id, msg);
      await this.registrarLogCampanha(campanha.id, cliente.id);
    }
    this.logger.log(`Recompra: ${clientes.length} clientes elegíveis`);
  }

  private async executarCampanhaAniversario(campanha: CampanhaMarketing) {
    const hoje = new Date();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');

    const clientes = await this.clienteRepo
      .createQueryBuilder('c')
      .where('c.loja_id = :lojaId', { lojaId: campanha.loja_id })
      .andWhere(`TO_CHAR(c.data_nascimento, 'MM-DD') = :hoje`, { hoje: `${mes}-${dia}` })
      .andWhere('c.data_nascimento IS NOT NULL')
      .getMany();

    for (const cliente of clientes) {
      if (await this.jaRecebeuCampanha(campanha.id, cliente.id, 365)) continue;
      const msg = campanha.mensagem.replace('{nome}', cliente.nome || 'cliente');
      await this.notificarCliente(campanha.loja_id, cliente.id, msg);
      await this.registrarLogCampanha(campanha.id, cliente.id);
    }
    this.logger.log(`Aniversário: ${clientes.length} aniversariantes hoje`);
  }

  // ── Dashboard de fidelização ───────────────────────────────────────────────

  async getStats(lojaId: string) {
    const [totalCarteiras, totalSelos, campanhasAtivas] = await Promise.all([
      this.carteiraRepo.createQueryBuilder('c')
        .select('COUNT(*)', 'total')
        .addSelect('COALESCE(SUM(c.saldo), 0)', 'saldo_total')
        .where('c.loja_id = :lojaId', { lojaId })
        .getRawOne(),
      this.cartaoRepo.createQueryBuilder('c')
        .select('COALESCE(SUM(c.total_recompensas), 0)', 'total_recompensas')
        .where('c.loja_id = :lojaId', { lojaId })
        .getRawOne(),
      this.campanhaRepo.count({ where: { loja_id: lojaId, ativa: true } }),
    ]);

    return {
      clientes_com_carteira: parseInt(totalCarteiras.total || '0'),
      saldo_total_emitido: parseFloat(totalCarteiras.saldo_total || '0'),
      total_recompensas_selos: parseInt(totalSelos.total_recompensas || '0'),
      campanhas_ativas: campanhasAtivas,
    };
  }
}
