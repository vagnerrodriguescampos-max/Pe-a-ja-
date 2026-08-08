import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PedidoService } from './pedido.service';

describe('PedidoService', () => {
  let pedidoService: PedidoService;
  let pedidoRepo: { findOne: jest.Mock; update: jest.Mock };
  let pedidoGateway: { emitStatusAtualizado: jest.Mock; emitNovoPedido: jest.Mock };
  let lojaService: { findById: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let cupomService: { avaliar: jest.Mock; registrarUso: jest.Mock };

  beforeEach(() => {
    pedidoRepo = { findOne: jest.fn(), update: jest.fn() };
    pedidoGateway = { emitStatusAtualizado: jest.fn(), emitNovoPedido: jest.fn() };
    lojaService = { findById: jest.fn() };
    dataSource = { transaction: jest.fn() };
    cupomService = { avaliar: jest.fn(), registrarUso: jest.fn() };

    pedidoService = new PedidoService(
      pedidoRepo as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      dataSource as any,
      pedidoGateway as any,
      lojaService as any,
      cupomService as any,
      undefined,
      undefined,
      undefined,
    );
  });

  describe('atualizarStatus', () => {
    it('lança erro quando o pedido não existe', async () => {
      pedidoRepo.findOne.mockResolvedValue(null);

      await expect(pedidoService.atualizarStatus('loja1', 'pedido1', 'confirmado'))
        .rejects.toThrow(NotFoundException);
    });

    it('permite uma transição válida (recebido -> confirmado)', async () => {
      pedidoRepo.findOne.mockResolvedValue({ id: 'pedido1', status: 'recebido' });

      const resultado = await pedidoService.atualizarStatus('loja1', 'pedido1', 'confirmado');

      expect(resultado).toEqual({ id: 'pedido1', status: 'confirmado' });
      expect(pedidoRepo.update).toHaveBeenCalledWith('pedido1', { status: 'confirmado' });
      expect(pedidoGateway.emitStatusAtualizado).toHaveBeenCalledWith('loja1', 'pedido1', 'confirmado');
    });

    it('rejeita uma transição inválida (recebido -> entregue)', async () => {
      pedidoRepo.findOne.mockResolvedValue({ id: 'pedido1', status: 'recebido' });

      await expect(pedidoService.atualizarStatus('loja1', 'pedido1', 'entregue'))
        .rejects.toThrow(BadRequestException);
      expect(pedidoRepo.update).not.toHaveBeenCalled();
    });

    it('rejeita qualquer transição a partir de um status final (entregue)', async () => {
      pedidoRepo.findOne.mockResolvedValue({ id: 'pedido1', status: 'entregue' });

      await expect(pedidoService.atualizarStatus('loja1', 'pedido1', 'cancelado'))
        .rejects.toThrow(BadRequestException);
    });

    it('motoboy não pode alterar status de pedido atribuído a outro motoboy', async () => {
      pedidoRepo.findOne.mockResolvedValue({ id: 'pedido1', status: 'pronto', motoboy_id: 'motoboy-dono' });

      await expect(pedidoService.atualizarStatus('loja1', 'pedido1', 'saiu_para_entrega', 'motoboy-intruso'))
        .rejects.toThrow(NotFoundException);
      expect(pedidoRepo.update).not.toHaveBeenCalled();
    });

    it('motoboy pode alterar status do próprio pedido atribuído', async () => {
      pedidoRepo.findOne.mockResolvedValue({ id: 'pedido1', status: 'pronto', motoboy_id: 'motoboy-dono' });

      const resultado = await pedidoService.atualizarStatus('loja1', 'pedido1', 'saiu_para_entrega', 'motoboy-dono');

      expect(resultado).toEqual({ id: 'pedido1', status: 'saiu_para_entrega' });
      expect(pedidoRepo.update).toHaveBeenCalledWith('pedido1', { status: 'saiu_para_entrega' });
    });
  });

  describe('criarPedido', () => {
    it('rejeita pedido quando a loja está fechada', async () => {
      lojaService.findById.mockResolvedValue({ id: 'loja1', aberta: false });

      await expect(pedidoService.criarPedido('loja1', {} as any))
        .rejects.toThrow('Loja fechada no momento');
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });
});
