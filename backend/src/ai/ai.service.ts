import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigIa } from './ai.entity';
import Anthropic from '@anthropic-ai/sdk';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private client: Anthropic | null = null;

  constructor(
    @InjectRepository(ConfigIa) private configIaRepo: Repository<ConfigIa>,
  ) {
    if (process.env.ANTHROPIC_API_KEY) {
      this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    } else {
      this.logger.warn('ANTHROPIC_API_KEY não definida — IA desabilitada');
    }
  }

  async getConfig(lojaId: string): Promise<ConfigIa> {
    let config = await this.configIaRepo.findOne({ where: { loja_id: lojaId } });
    if (!config) {
      config = this.configIaRepo.create({ loja_id: lojaId });
      config = await this.configIaRepo.save(config);
    }
    return config;
  }

  async updateConfig(lojaId: string, dto: Partial<ConfigIa>): Promise<ConfigIa> {
    let config = await this.configIaRepo.findOne({ where: { loja_id: lojaId } });
    if (!config) {
      config = this.configIaRepo.create({ loja_id: lojaId, ...dto });
    } else {
      Object.assign(config, dto);
    }
    return this.configIaRepo.save(config);
  }

  async isHabilitada(lojaId: string): Promise<boolean> {
    if (!this.client) return false;
    const config = await this.getConfig(lojaId);
    return config.habilitada;
  }

  async responder(params: {
    lojaId: string;
    lojaNome: string;
    lojaInfo: string;
    cardapioTexto: string;
    historicoMensagens: { role: 'user' | 'assistant'; content: string }[];
    mensagemAtual: string;
  }): Promise<string | null> {
    if (!this.client) return null;

    const config = await this.getConfig(params.lojaId);
    if (!config.habilitada) return null;

    const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    const systemPrompt = `Você é ${config.nome_ia}, assistente virtual da loja "${params.lojaNome}".
Data/hora atual: ${agora}

Informações da loja:
${params.lojaInfo}

Cardápio disponível:
${params.cardapioTexto}

Instruções:
- Responda em português do Brasil, de forma amigável e concisa
- Ajude o cliente com dúvidas sobre o cardápio, preços, horários e formas de pagamento
- Ao montar um pedido, confirme itens, opções e total antes de finalizar
- Nunca invente itens que não estão no cardápio
- Se não souber responder, diga que vai chamar um atendente
- Mantenha respostas curtas (1-3 frases quando possível)
${config.sistema_prompt_extra ? `\nInstruções adicionais:\n${config.sistema_prompt_extra}` : ''}`;

    try {
      const response = await this.client.messages.create({
        model: config.modelo || 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: systemPrompt,
        messages: [
          ...params.historicoMensagens.slice(-10),
          { role: 'user', content: params.mensagemAtual },
        ],
      });

      const content = response.content[0];
      if (content.type === 'text') return content.text;
      return null;
    } catch (e) {
      this.logger.error(`Erro na chamada IA: ${e.message}`);
      return null;
    }
  }
}
