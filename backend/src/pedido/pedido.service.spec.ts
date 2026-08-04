import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PedidoService } from './pedido.service';

describe('PedidoService', () => {
  let pedidoService: PedidoService;
  let pedidoRepo: { findOne: jest.Mock; update: jest.Mock };
  let pedidoGateway: { emitStatusAtualizado: jest.Mock; emitNovoPedido: jest.Mock };
  let lojaService: { findById: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  beforeEach(() => {
    pedidoRepo = { findOne: jest.fn(), update: jest.fn() };
    pedidoGateway = { emitStatusAtualizado: jest.fn(), emitNovoPedido: jest.fn() };
    lojaService = { findById: jest.fn() };
    dataSource = { transaction: jest.fn() };

    pedidoService = new PedidoService(
      pedidoRepo as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      dataSource as any,
      pedidoGateway as any,
      lojaService as any,
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
