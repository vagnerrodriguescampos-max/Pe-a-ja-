import { BadRequestException } from '@nestjs/common';
import { CupomService } from './cupom.service';

/** Monta um cupom válido; cada teste sobrescreve só o que importa para o caso. */
function cupomBase(over: Partial<any> = {}) {
  return {
    id: 'cupom-1',
    loja_id: 'loja-1',
    codigo: 'TESTE',
    tipo_desconto: 'percentual',
    valor: 10,
    desconto_maximo: null,
    pedido_minimo: 0,
    regra: 'geral',
    valido_de: null,
    valido_ate: null,
    limite_uso_total: null,
    limite_uso_por_cliente: 1,
    usos: 0,
    ativo: true,
    ...over,
  };
}

/** Data ISO deslocada N dias a partir de hoje. */
function emDias(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Nascimento em ano antigo, mas com dia/mês deslocados N dias de hoje. */
function nascimentoDeslocado(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `1990-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe('CupomService', () => {
  let service: CupomService;
  let manager: { findOne: jest.Mock; count: jest.Mock };

  beforeEach(() => {
    manager = { findOne: jest.fn(), count: jest.fn().mockResolvedValue(0) };
    service = new CupomService({} as any, {} as any, {} as any, {} as any);
  });

  const avaliar = (cupom: any, cliente: any, subtotalCentavos: number) => {
    manager.findOne.mockResolvedValue(cupom);
    return service.avaliar(manager as any, 'loja-1', 'TESTE', cliente, subtotalCentavos);
  };

  describe('cálculo do desconto', () => {
    it('aplica percentual sobre o subtotal', async () => {
      const { descontoCentavos } = await avaliar(cupomBase({ valor: 10 }), null, 10_000);
      expect(descontoCentavos).toBe(1_000);
    });

    it('aplica valor fixo', async () => {
      const r = await avaliar(cupomBase({ tipo_desconto: 'valor', valor: 15 }), null, 10_000);
      expect(r.descontoCentavos).toBe(1_500);
    });

    it('respeita o teto de desconto do percentual', async () => {
      const r = await avaliar(cupomBase({ valor: 50, desconto_maximo: 20 }), null, 10_000);
      expect(r.descontoCentavos).toBe(2_000);
    });

    it('nunca desconta mais que o subtotal', async () => {
      const r = await avaliar(cupomBase({ tipo_desconto: 'valor', valor: 100 }), null, 3_000);
      expect(r.descontoCentavos).toBe(3_000);
    });
  });

  describe('validade e limites', () => {
    it('rejeita cupom inativo', async () => {
      await expect(avaliar(cupomBase({ ativo: false }), null, 10_000)).rejects.toThrow(BadRequestException);
    });

    it('rejeita cupom que ainda não começou', async () => {
      await expect(avaliar(cupomBase({ valido_de: emDias(5) }), null, 10_000))
        .rejects.toThrow('Este cupom ainda não está valendo');
    });

    it('rejeita cupom expirado', async () => {
      await expect(avaliar(cupomBase({ valido_ate: emDias(-1) }), null, 10_000))
        .rejects.toThrow('Este cupom expirou');
    });

    it('rejeita quando o subtotal não atinge o pedido mínimo', async () => {
      await expect(avaliar(cupomBase({ pedido_minimo: 50 }), null, 3_000))
        .rejects.toThrow(/vale a partir de/);
    });

    it('rejeita quando o limite total de usos foi atingido', async () => {
      await expect(avaliar(cupomBase({ limite_uso_total: 5, usos: 5 }), null, 10_000))
        .rejects.toThrow('Este cupom já atingiu o limite de usos');
    });

    it('rejeita quando o cliente já usou o cupom', async () => {
      manager.count.mockResolvedValue(1);
      await expect(avaliar(cupomBase(), { id: 'cli-1' }, 10_000))
        .rejects.toThrow('Você já utilizou este cupom');
    });
  });

  describe('regra primeira compra', () => {
    const cupom = cupomBase({ regra: 'primeira_compra' });

    it('exige cliente identificado', async () => {
      await expect(avaliar(cupom, null, 10_000)).rejects.toThrow(/Informe seu telefone/);
    });

    it('rejeita quem já tem pedido', async () => {
      manager.count.mockResolvedValue(1);
      await expect(avaliar(cupom, { id: 'cli-1' }, 10_000))
        .rejects.toThrow('Este cupom é válido apenas na primeira compra');
    });

    it('aceita cliente sem pedidos anteriores', async () => {
      manager.count.mockResolvedValue(0);
      await expect(avaliar(cupom, { id: 'cli-1' }, 10_000)).resolves.toMatchObject({ descontoCentavos: 1_000 });
    });
  });

  describe('regra aniversário', () => {
    const cupom = cupomBase({ regra: 'aniversario' });

    it('exige data de nascimento cadastrada', async () => {
      await expect(avaliar(cupom, { id: 'cli-1', data_nascimento: null }, 10_000))
        .rejects.toThrow(/Cadastre sua data de nascimento/);
    });

    it('aceita no dia do aniversário', async () => {
      await expect(avaliar(cupom, { id: 'cli-1', data_nascimento: nascimentoDeslocado(0) }, 10_000))
        .resolves.toMatchObject({ descontoCentavos: 1_000 });
    });

    it('aceita dentro da janela de 7 dias', async () => {
      await expect(avaliar(cupom, { id: 'cli-1', data_nascimento: nascimentoDeslocado(5) }, 10_000))
        .resolves.toBeDefined();
    });

    it('rejeita fora da janela', async () => {
      await expect(avaliar(cupom, { id: 'cli-1', data_nascimento: nascimentoDeslocado(60) }, 10_000))
        .rejects.toThrow(/semana do seu aniversário/);
    });

    // Aniversário em 1º de janeiro visto de 31 de dezembro precisa dar 1 dia de
    // diferença, não 364 — é o caso que a comparação circular resolve.
    it('trata a virada do ano como distância curta', async () => {
      const trintaEUmDez = new Date(new Date().getFullYear(), 11, 31);
      jest.useFakeTimers().setSystemTime(trintaEUmDez);
      try {
        await expect(avaliar(cupom, { id: 'cli-1', data_nascimento: '1990-01-01' }, 10_000))
          .resolves.toBeDefined();
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
