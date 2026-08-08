import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Cupom, CupomUso } from './cupom.entity';
import { Cliente } from '../pedido/cliente.entity';
import { Pedido } from '../pedido/pedido.entity';
import { CriarCupomDto, AtualizarCupomDto } from './dto/cupom.dto';

/** Quantos dias antes/depois do aniversário o cupom de aniversário continua válido. */
const JANELA_ANIVERSARIO_DIAS = 7;

export type CupomAplicado = { cupom: Cupom; descontoCentavos: number };

@Injectable()
export class CupomService {
  constructor(
    @InjectRepository(Cupom) private cupomRepo: Repository<Cupom>,
    @InjectRepository(CupomUso) private usoRepo: Repository<CupomUso>,
    @InjectRepository(Cliente) private clienteRepo: Repository<Cliente>,
    @InjectRepository(Pedido) private pedidoRepo: Repository<Pedido>,
  ) {}

  // ---------- CRUD do painel ----------

  listar(lojaId: string) {
    return this.cupomRepo.find({ where: { loja_id: lojaId }, order: { criado_em: 'DESC' } });
  }

  async criar(lojaId: string, dto: CriarCupomDto) {
    const codigo = this.normalizarCodigo(dto.codigo);
    const jaExiste = await this.cupomRepo.findOne({ where: { loja_id: lojaId, codigo } });
    if (jaExiste) throw new ConflictException('Já existe um cupom com esse código');

    this.validarConfiguracao(dto);
    return this.cupomRepo.save(this.cupomRepo.create({ ...dto, codigo, loja_id: lojaId }));
  }

  async atualizar(lojaId: string, id: string, dto: AtualizarCupomDto) {
    const cupom = await this.cupomRepo.findOne({ where: { id, loja_id: lojaId } });
    if (!cupom) throw new NotFoundException('Cupom não encontrado');

    if (dto.codigo) {
      const codigo = this.normalizarCodigo(dto.codigo);
      const conflito = await this.cupomRepo.findOne({ where: { loja_id: lojaId, codigo } });
      if (conflito && conflito.id !== id) {
        throw new ConflictException('Já existe um cupom com esse código');
      }
      dto = { ...dto, codigo };
    }

    this.validarConfiguracao({ ...cupom, ...dto } as CriarCupomDto);
    await this.cupomRepo.update(id, dto as any);
    return this.cupomRepo.findOne({ where: { id } });
  }

  async remover(lojaId: string, id: string) {
    const cupom = await this.cupomRepo.findOne({ where: { id, loja_id: lojaId } });
    if (!cupom) throw new NotFoundException('Cupom não encontrado');
    // Desativa em vez de apagar: os pedidos que já usaram este cupom precisam continuar
    // apontando para um registro existente no histórico.
    await this.cupomRepo.update(id, { ativo: false });
    return { ok: true };
  }

  /** Quantos clientes distintos já resgataram — usado no painel. */
  async estatisticas(lojaId: string, id: string) {
    const cupom = await this.cupomRepo.findOne({ where: { id, loja_id: lojaId } });
    if (!cupom) throw new NotFoundException('Cupom não encontrado');

    const usos = await this.usoRepo.find({ where: { cupom_id: id } });
    const totalDescontado = usos.reduce((soma, u) => soma + Number(u.valor_desconto), 0);
    return {
      resgates: usos.length,
      clientes_distintos: new Set(usos.map(u => u.cliente_id)).size,
      total_descontado: totalDescontado,
    };
  }

  // ---------- Validação ----------

  /**
   * Prévia para o checkout: diz se o código vale e quanto desconta, antes de fechar
   * o pedido. Identifica o cliente pelo telefone porque nessa hora ele ainda pode não
   * existir na base.
   */
  async previsualizar(lojaId: string, codigo: string, subtotal: number, telefone?: string) {
    const cliente = telefone
      ? await this.clienteRepo.findOne({
          where: { loja_id: lojaId, telefone: this.normalizarTelefone(telefone) },
        })
      : null;

    const { cupom, descontoCentavos } = await this.avaliar(
      this.cupomRepo.manager,
      lojaId,
      codigo,
      cliente,
      Math.round(Number(subtotal) * 100),
    );

    return {
      codigo: cupom.codigo,
      descricao: cupom.descricao,
      tipo_desconto: cupom.tipo_desconto,
      valor: Number(cupom.valor),
      desconto: descontoCentavos / 100,
    };
  }

  /**
   * Avalia o cupom dentro da transação do pedido. Lança BadRequest com a razão exata
   * para o cliente entender por que o cupom não passou.
   */
  async avaliar(
    manager: EntityManager,
    lojaId: string,
    codigoInformado: string,
    cliente: Cliente | null,
    subtotalCentavos: number,
  ): Promise<CupomAplicado> {
    const codigo = this.normalizarCodigo(codigoInformado);
    const cupom = await manager.findOne(Cupom, { where: { loja_id: lojaId, codigo } });

    if (!cupom || !cupom.ativo) throw new BadRequestException('Cupom inválido');

    const hoje = this.hojeISO();
    if (cupom.valido_de && hoje < cupom.valido_de) {
      throw new BadRequestException('Este cupom ainda não está valendo');
    }
    if (cupom.valido_ate && hoje > cupom.valido_ate) {
      throw new BadRequestException('Este cupom expirou');
    }

    const minimoCentavos = Math.round(Number(cupom.pedido_minimo) * 100);
    if (subtotalCentavos < minimoCentavos) {
      throw new BadRequestException(
        `Este cupom vale a partir de R$ ${(minimoCentavos / 100).toFixed(2).replace('.', ',')}`,
      );
    }

    if (cupom.limite_uso_total != null && cupom.usos >= cupom.limite_uso_total) {
      throw new BadRequestException('Este cupom já atingiu o limite de usos');
    }

    await this.validarRegra(manager, cupom, cliente);

    if (cliente) {
      const usosDoCliente = await manager.count(CupomUso, {
        where: { cupom_id: cupom.id, cliente_id: cliente.id },
      });
      if (usosDoCliente >= cupom.limite_uso_por_cliente) {
        throw new BadRequestException('Você já utilizou este cupom');
      }
    }

    return { cupom, descontoCentavos: this.calcularDesconto(cupom, subtotalCentavos) };
  }

  /** Registra o resgate. Chamado dentro da transação do pedido, depois do pedido salvo. */
  async registrarUso(
    manager: EntityManager,
    cupom: Cupom,
    clienteId: string,
    pedidoId: string,
    descontoCentavos: number,
  ) {
    await manager.save(manager.create(CupomUso, {
      cupom_id: cupom.id,
      cliente_id: clienteId,
      pedido_id: pedidoId,
      valor_desconto: descontoCentavos / 100,
    }));
    // Incremento no banco (e não usos+1 em memória) para não perder contagem quando
    // dois clientes resgatam o mesmo cupom ao mesmo tempo.
    await manager.increment(Cupom, { id: cupom.id }, 'usos', 1);
  }

  // ---------- Regras internas ----------

  private async validarRegra(manager: EntityManager, cupom: Cupom, cliente: Cliente | null) {
    if (cupom.regra === 'geral') return;

    if (!cliente) {
      // Sem cliente identificado não dá para provar "primeira compra" nem aniversário.
      // Deixar passar aqui abriria brecha para reuso trocando o telefone.
      throw new BadRequestException(
        cupom.regra === 'primeira_compra'
          ? 'Informe seu telefone para usar este cupom'
          : 'Informe seu telefone para validarmos seu aniversário',
      );
    }

    if (cupom.regra === 'primeira_compra') {
      const pedidosAnteriores = await manager.count(Pedido, { where: { cliente_id: cliente.id } });
      if (pedidosAnteriores > 0) {
        throw new BadRequestException('Este cupom é válido apenas na primeira compra');
      }
      return;
    }

    if (cupom.regra === 'aniversario') {
      if (!cliente.data_nascimento) {
        throw new BadRequestException('Cadastre sua data de nascimento para usar este cupom');
      }
      if (!this.estaNaJanelaDeAniversario(cliente.data_nascimento)) {
        throw new BadRequestException('Este cupom vale somente na semana do seu aniversário');
      }
    }
  }

  /**
   * Compara só dia/mês — o ano do nascimento é irrelevante. A janela cobre os dias ao
   * redor da data para o cliente não perder o benefício por ter pedido um dia antes.
   */
  private estaNaJanelaDeAniversario(dataNascimento: string) {
    const [, mes, dia] = dataNascimento.split('-').map(Number);
    if (!mes || !dia) return false;

    const hoje = new Date();
    const aniversarioEsteAno = new Date(hoje.getFullYear(), mes - 1, dia);
    const diffDias = Math.abs(
      (aniversarioEsteAno.getTime() - new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime())
      / 86_400_000,
    );
    // Aniversário em 1º de janeiro visto de 31 de dezembro (e vice-versa) precisa do
    // ajuste pela volta do ano, senão a diferença daria ~364 dias.
    const diffCircular = Math.min(diffDias, 365 - diffDias);
    return diffCircular <= JANELA_ANIVERSARIO_DIAS;
  }

  private calcularDesconto(cupom: Cupom, subtotalCentavos: number) {
    let desconto: number;

    if (cupom.tipo_desconto === 'percentual') {
      desconto = Math.round(subtotalCentavos * (Number(cupom.valor) / 100));
      if (cupom.desconto_maximo != null) {
        desconto = Math.min(desconto, Math.round(Number(cupom.desconto_maximo) * 100));
      }
    } else {
      desconto = Math.round(Number(cupom.valor) * 100);
    }

    // O desconto nunca pode passar do subtotal — senão o pedido ficaria negativo.
    return Math.max(0, Math.min(desconto, subtotalCentavos));
  }

  private validarConfiguracao(dto: CriarCupomDto) {
    if (dto.tipo_desconto === 'percentual' && Number(dto.valor) > 100) {
      throw new BadRequestException('Desconto percentual não pode passar de 100%');
    }
    if (dto.valido_de && dto.valido_ate && dto.valido_de > dto.valido_ate) {
      throw new BadRequestException('A data inicial não pode ser depois da data final');
    }
  }

  private normalizarCodigo(codigo: string) {
    return (codigo || '').trim().toUpperCase();
  }

  private normalizarTelefone(telefone: string) {
    return (telefone || '').replace(/\D/g, '');
  }

  private hojeISO() {
    return new Date().toISOString().slice(0, 10);
  }
}
