import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHmac, timingSafeEqual } from 'crypto';
import { Loja } from '../loja/loja.entity';
import { Cliente } from '../pedido/cliente.entity';
import { ChatService } from '../chat/chat.service';

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v21.0';
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    @InjectRepository(Loja) private lojaRepo: Repository<Loja>,
    @InjectRepository(Cliente) private clienteRepo: Repository<Cliente>,
    private chatService: ChatService,
  ) {}

  async status(lojaId: string) {
    const loja = await this.lojaRepo.findOne({ where: { id: lojaId } });
    if (!loja) throw new NotFoundException('Loja não encontrada');
    return {
      conectado: !!loja.whatsapp_phone_number_id,
      numero: loja.whatsapp_numero_display || null,
      conectado_em: loja.whatsapp_conectado_em || null,
      integracao_configurada: Boolean(process.env.META_SYSTEM_USER_TOKEN),
    };
  }

  async conectar(lojaId: string, wabaId: string, phoneNumberId: string) {
    if (!wabaId?.trim() || !phoneNumberId?.trim()) {
      throw new BadRequestException('Dados de conexão do WhatsApp incompletos');
    }
    const token = process.env.META_SYSTEM_USER_TOKEN;
    if (!token) {
      throw new BadRequestException('A integração com o WhatsApp ainda não foi configurada no servidor');
    }

    const info = await this.graphGet(`/${phoneNumberId}`, token, { fields: 'display_phone_number,verified_name' });

    await this.lojaRepo.update(lojaId, {
      whatsapp_waba_id: wabaId,
      whatsapp_phone_number_id: phoneNumberId,
      whatsapp_numero_display: info.display_phone_number || info.verified_name || null,
      whatsapp_conectado_em: new Date(),
    });
    return this.status(lojaId);
  }

  async desconectar(lojaId: string) {
    await this.lojaRepo.update(lojaId, {
      whatsapp_waba_id: null,
      whatsapp_phone_number_id: null,
      whatsapp_numero_display: null,
      whatsapp_conectado_em: null,
    });
    return this.status(lojaId);
  }

  // Notificações automáticas (confirmação de pedido, mudança de status). Nunca deve
  // derrubar o fluxo do pedido — quem chama trata a falha como best-effort.
  async enviarTemplate(lojaId: string, telefoneDestino: string, templateName: string, parametros: string[] = []) {
    const token = process.env.META_SYSTEM_USER_TOKEN;
    if (!token) return;
    const loja = await this.lojaRepo.findOne({ where: { id: lojaId } });
    if (!loja?.whatsapp_phone_number_id) return;

    const numero = (telefoneDestino || '').replace(/\D/g, '');
    if (numero.length < 10) return;

    await this.graphPost(`/${loja.whatsapp_phone_number_id}/messages`, token, {
      messaging_product: 'whatsapp',
      to: numero,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'pt_BR' },
        components: parametros.length
          ? [{ type: 'body', parameters: parametros.map(texto => ({ type: 'text', text: texto })) }]
          : [],
      },
    });
  }

  assinaturaValida(rawBody: Buffer | undefined, headerAssinatura: string | string[] | undefined): boolean {
    const secret = process.env.META_APP_SECRET;
    if (!secret || !rawBody || typeof headerAssinatura !== 'string') return false;

    const esperada = 'sha256=' + createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(esperada);
    const b = Buffer.from(headerAssinatura);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  async processarWebhook(payload: any) {
    for (const entry of payload?.entry || []) {
      for (const change of entry?.changes || []) {
        const valor = change?.value;
        const nomeContato = valor?.contacts?.[0]?.profile?.name;
        for (const mensagem of valor?.messages || []) {
          await this.processarMensagemRecebida(valor?.metadata?.phone_number_id, mensagem, nomeContato);
        }
      }
    }
  }

  private async processarMensagemRecebida(phoneNumberId: string | undefined, mensagem: any, nomeContato?: string) {
    if (!phoneNumberId || mensagem?.type !== 'text') return;

    const loja = await this.lojaRepo.findOne({ where: { whatsapp_phone_number_id: phoneNumberId } });
    if (!loja) return;

    const telefone = (mensagem.from || '').replace(/\D/g, '');
    const texto = mensagem.text?.body?.trim();
    if (!telefone || !texto) return;

    const clienteExistente = await this.clienteRepo.findOne({ where: { loja_id: loja.id, telefone } });
    const nome = nomeContato?.trim() || clienteExistente?.nome || 'Cliente WhatsApp';

    const { conversa } = await this.chatService.identificarCliente(loja.id, nome, telefone);
    await this.chatService.enviarMensagem(conversa.id, 'cliente', texto);
  }

  private async graphGet(path: string, token: string, params: Record<string, string>) {
    const url = new URL(`${GRAPH_URL}${path}`);
    Object.entries(params).forEach(([chave, valor]) => url.searchParams.set(chave, valor));

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) {
      this.logger.error(`Graph API GET ${path}: ${JSON.stringify(data)}`);
      throw new BadRequestException(data?.error?.message || 'Falha ao consultar a API do WhatsApp');
    }
    return data;
  }

  private async graphPost(path: string, token: string, body: unknown) {
    const res = await fetch(`${GRAPH_URL}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      this.logger.error(`Graph API POST ${path}: ${JSON.stringify(data)}`);
      throw new BadRequestException(data?.error?.message || 'Falha ao enviar mensagem pelo WhatsApp');
    }
    return data;
  }
}
