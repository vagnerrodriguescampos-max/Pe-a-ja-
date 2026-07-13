import { Injectable, NotFoundException, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Conversa, Mensagem } from './conversa.entity';
import { Cliente } from '../pedido/cliente.entity';
import { Pedido } from '../pedido/pedido.entity';
import { AiService } from '../ai/ai.service';

const RETENTION_DAYS = parseInt(process.env.CHAT_RETENTION_DAYS || '7', 10);

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  constructor(
    @InjectRepository(Conversa) private conversaRepo: Repository<Conversa>,
    @InjectRepository(Mensagem) private mensagemRepo: Repository<Mensagem>,
    @InjectRepository(Cliente) private clienteRepo: Repository<Cliente>,
    @InjectRepository(Pedido) private pedidoRepo: Repository<Pedido>,
    @Optional() private aiService: AiService,
  ) {}

  // Busca ou cria conversa para um cliente
  async upsertConversa(lojaId: string, clienteId: string): Promise<Conversa> {
    let conversa = await this.conversaRepo.findOne({
      where: { loja_id: lojaId, cliente_id: clienteId },
    });
    if (!conversa) {
      conversa = this.conversaRepo.create({
        loja_id: lojaId,
        cliente_id: clienteId,
        status: 'aberta',
        nao_lidas: 0,
      });
      conversa = await this.conversaRepo.save(conversa);
    }
    return conversa;
  }

  // Identificar cliente pelo telefone (usado no widget público)
  async identificarCliente(lojaId: string, nome: string, telefone: string): Promise<{ cliente: Cliente; conversa: Conversa }> {
    let cliente = await this.clienteRepo.findOne({ where: { loja_id: lojaId, telefone } });
    if (!cliente) {
      cliente = this.clienteRepo.create({ loja_id: lojaId, nome, telefone });
      cliente = await this.clienteRepo.save(cliente);
    } else {
      await this.clienteRepo.update(cliente.id, { nome });
      cliente.nome = nome;
    }
    const conversa = await this.upsertConversa(lojaId, cliente.id);
    return { cliente, conversa };
  }

  // Enviar mensagem
  async enviarMensagem(conversaId: string, autorTipo: string, conteudo: string, autorId?: string, pedidoId?: string): Promise<Mensagem> {
    const conversa = await this.conversaRepo.findOne({ where: { id: conversaId } });
    if (!conversa) throw new NotFoundException('Conversa não encontrada');

    const mensagem = this.mensagemRepo.create({
      conversa_id: conversaId,
      autor_tipo: autorTipo,
      autor_id: autorId || null,
      conteudo,
      tipo: 'texto',
      pedido_id: pedidoId || null,
      lida: autorTipo !== 'cliente',
    });
    const saved = await this.mensagemRepo.save(mensagem);

    // Atualizar conversa
    const updateData: Partial<Conversa> = { ultima_mensagem_em: new Date() };
    if (autorTipo === 'cliente') {
      updateData.nao_lidas = (conversa.nao_lidas || 0) + 1;
      if (conversa.status === 'resolvida') updateData.status = 'aberta';
    }
    await this.conversaRepo.update(conversaId, updateData);

    // Disparar resposta IA em background (apenas para mensagens do cliente)
    if (autorTipo === 'cliente' && this.aiService) {
      this.dispararRespostaIA(conversa, conteudo).catch(() => {});
    }

    return saved;
  }

  // Listar conversas da loja (inbox do atendente)
  async listarConversas(lojaId: string, filtro?: string) {
    const qb = this.conversaRepo.createQueryBuilder('c')
      .leftJoinAndSelect('c.atendente', 'atendente')
      .where('c.loja_id = :lojaId', { lojaId })
      .orderBy('c.ultima_mensagem_em', 'DESC', 'NULLS LAST');

    if (filtro && filtro !== 'todas') qb.andWhere('c.status = :filtro', { filtro });

    const conversas = await qb.getMany();

    // Enriquecer com dados do cliente e última mensagem
    const result = await Promise.all(conversas.map(async c => {
      const cliente = await this.clienteRepo.findOne({ where: { id: c.cliente_id } });
      const ultimaMensagem = await this.mensagemRepo.findOne({
        where: { conversa_id: c.id },
        order: { criado_em: 'DESC' },
      });
      return { ...c, cliente, ultima_mensagem: ultimaMensagem };
    }));

    return result;
  }

  // Histórico de mensagens (últimos N dias)
  async getMensagens(conversaId: string, lojaId: string) {
    const conversa = await this.conversaRepo.findOne({ where: { id: conversaId, loja_id: lojaId } });
    if (!conversa) throw new NotFoundException();

    const desde = new Date();
    desde.setDate(desde.getDate() - RETENTION_DAYS);

    const mensagens = await this.mensagemRepo.find({
      where: { conversa_id: conversaId, criado_em: MoreThan(desde) },
      order: { criado_em: 'ASC' },
    });

    return mensagens;
  }

  // Mensagens pelo cliente (acesso público)
  async getMensagensCliente(conversaId: string) {
    const desde = new Date();
    desde.setDate(desde.getDate() - RETENTION_DAYS);
    return this.mensagemRepo.find({
      where: { conversa_id: conversaId, criado_em: MoreThan(desde) },
      order: { criado_em: 'ASC' },
    });
  }

  // Marcar mensagens como lidas
  async marcarLidas(conversaId: string) {
    await this.mensagemRepo.update({ conversa_id: conversaId, lida: false }, { lida: true });
    await this.conversaRepo.update(conversaId, { nao_lidas: 0 });
  }

  // Atualizar status da conversa
  async atualizarStatus(lojaId: string, conversaId: string, status: string, atendenteId?: string) {
    const update: Partial<Conversa> = { status };
    if (atendenteId) update.atendente_id = atendenteId;
    await this.conversaRepo.update({ id: conversaId, loja_id: lojaId }, update);
    return this.conversaRepo.findOne({ where: { id: conversaId } });
  }

  // Callback para o gateway emitir mensagem da IA
  onIaMensagem?: (conversaId: string, lojaId: string, mensagem: Mensagem) => void;

  private async dispararRespostaIA(conversa: Conversa, mensagemCliente: string) {
    if (!this.aiService) return;
    const habilitada = await this.aiService.isHabilitada(conversa.loja_id);
    if (!habilitada) return;

    // Delay configurável antes de responder
    const config = await this.aiService.getConfig(conversa.loja_id);
    await new Promise(r => setTimeout(r, (config.delay_resposta_seg || 3) * 1000));

    // Buscar histórico recente para contexto
    const historico = await this.getMensagensCliente(conversa.id);
    const mensagensFormatadas = historico.slice(-10).map(m => ({
      role: (m.autor_tipo === 'cliente' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.conteudo,
    }));

    // Buscar info da loja
    const loja = await this.conversaRepo.manager.findOne('loja', { where: { id: conversa.loja_id } }) as any;
    const lojaInfo = loja ? `Endereço: ${loja.endereco || 'não informado'}\nHorário: ${loja.horario_funcionamento || 'não informado'}\nPIX: ${loja.chave_pix || 'não informado'}` : '';

    // Buscar cardápio resumido
    const produtos = await this.conversaRepo.manager
      .getRepository('produto')
      .find({ where: { loja_id: conversa.loja_id, status: 'ativo' as any } as any }) as any[];
    const cardapioTexto = produtos.map((p: any) => `- ${p.nome}: R$ ${p.preco}`).join('\n') || 'Cardápio não disponível';

    const resposta = await this.aiService.responder({
      lojaId: conversa.loja_id,
      lojaNome: loja?.nome || 'Loja',
      lojaInfo,
      cardapioTexto,
      historicoMensagens: mensagensFormatadas,
      mensagemAtual: mensagemCliente,
    });

    if (resposta) {
      const msg = await this.enviarMensagem(conversa.id, 'ia', resposta);
      if (this.onIaMensagem) this.onIaMensagem(conversa.id, conversa.loja_id, msg);
    }
  }

  // Histórico de pedidos do cliente (para o painel lateral)
  async getPedidosCliente(clienteId: string, lojaId: string) {
    return this.pedidoRepo.find({
      where: { cliente_id: clienteId, loja_id: lojaId },
      relations: ['itens'],
      order: { criado_em: 'DESC' },
      take: 20,
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async limparMensagensAntigas() {
    const limite = new Date();
    limite.setDate(limite.getDate() - RETENTION_DAYS);
    const result = await this.mensagemRepo
      .createQueryBuilder()
      .delete()
      .where('criado_em < :limite', { limite })
      .execute();
    this.logger.log(`Limpeza de mensagens: ${result.affected} removidas`);
  }
}
