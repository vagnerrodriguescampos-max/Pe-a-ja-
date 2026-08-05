import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pedido } from '../pedido/pedido.entity';
import { Cliente } from '../pedido/cliente.entity';

@Injectable()
export class RelatoriosService {
  constructor(
    @InjectRepository(Pedido) private pedidoRepo: Repository<Pedido>,
    @InjectRepository(Cliente) private clienteRepo: Repository<Cliente>,
  ) {}

  async getResumo(lojaId: string, dias = 30) {
    const desde = new Date();
    desde.setDate(desde.getDate() - dias);

    const result = await this.pedidoRepo
      .createQueryBuilder('p')
      .select([
        'COUNT(*) FILTER (WHERE p.status != \'cancelado\') AS total_pedidos',
        'COALESCE(SUM(p.total) FILTER (WHERE p.status != \'cancelado\'), 0) AS receita_total',
        'COALESCE(AVG(p.total) FILTER (WHERE p.status != \'cancelado\'), 0) AS ticket_medio',
        'COUNT(*) FILTER (WHERE p.status = \'cancelado\') AS cancelados',
      ])
      .where('p.loja_id = :lojaId', { lojaId })
      .andWhere('p.criado_em >= :desde', { desde })
      .getRawOne();

    return {
      total_pedidos: parseInt(result.total_pedidos || '0'),
      receita_total: parseFloat(result.receita_total || '0'),
      ticket_medio: parseFloat(result.ticket_medio || '0'),
      cancelados: parseInt(result.cancelados || '0'),
    };
  }

  async getReceitaPorDia(lojaId: string, dias = 30) {
    const desde = new Date();
    desde.setDate(desde.getDate() - dias);

    const rows = await this.pedidoRepo
      .createQueryBuilder('p')
      .select([
        // TO_CHAR (não DATE) para sempre voltar string 'YYYY-MM-DD' — o driver pg
        // converte DATE em objeto Date, que vira ISO datetime completo no JSON e
        // quebra o parse feito no frontend (Dashboard).
        "TO_CHAR(p.criado_em AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS dia",
        'COUNT(*) AS pedidos',
        'COALESCE(SUM(p.total), 0) AS receita',
      ])
      .where('p.loja_id = :lojaId', { lojaId })
      .andWhere('p.status != :status', { status: 'cancelado' })
      .andWhere('p.criado_em >= :desde', { desde })
      .groupBy('dia')
      .orderBy('dia', 'ASC')
      .getRawMany();

    return rows.map(r => ({
      dia: r.dia,
      pedidos: parseInt(r.pedidos),
      receita: parseFloat(r.receita),
    }));
  }

  async getReceitaPorFormaPagamento(lojaId: string, dias = 30) {
    const desde = new Date();
    desde.setDate(desde.getDate() - dias);

    const rows = await this.pedidoRepo
      .createQueryBuilder('p')
      .select([
        'p.forma_pagamento AS forma',
        'COUNT(*) AS pedidos',
        'COALESCE(SUM(p.total), 0) AS receita',
      ])
      .where('p.loja_id = :lojaId', { lojaId })
      .andWhere('p.status != :status', { status: 'cancelado' })
      .andWhere('p.criado_em >= :desde', { desde })
      .groupBy('p.pagamento')
      .getRawMany();

    return rows.map(r => ({
      forma: r.forma,
      pedidos: parseInt(r.pedidos),
      receita: parseFloat(r.receita),
    }));
  }

  async getProdutosMaisVendidos(lojaId: string, dias = 30, limit = 10) {
    const desde = new Date();
    desde.setDate(desde.getDate() - dias);

    const rows = await this.pedidoRepo
      .createQueryBuilder('p')
      .innerJoin('p.itens', 'item')
      .select([
        'item.nome_snapshot AS nome',
        'SUM(item.quantidade) AS quantidade',
        'SUM(item.preco_unitario * item.quantidade) AS receita',
      ])
      .where('p.loja_id = :lojaId', { lojaId })
      .andWhere('p.status != :status', { status: 'cancelado' })
      .andWhere('p.criado_em >= :desde', { desde })
      .groupBy('item.nome_snapshot')
      .orderBy('quantidade', 'DESC')
      .limit(limit)
      .getRawMany();

    return rows.map(r => ({
      nome: r.nome,
      quantidade: parseInt(r.quantidade),
      receita: parseFloat(r.receita),
    }));
  }

  async getHeatmapHorario(lojaId: string, dias = 30) {
    const desde = new Date();
    desde.setDate(desde.getDate() - dias);

    const rows = await this.pedidoRepo
      .createQueryBuilder('p')
      .select([
        "EXTRACT(DOW FROM p.criado_em AT TIME ZONE 'America/Sao_Paulo') AS dia_semana",
        "EXTRACT(HOUR FROM p.criado_em AT TIME ZONE 'America/Sao_Paulo') AS hora",
        'COUNT(*) AS pedidos',
      ])
      .where('p.loja_id = :lojaId', { lojaId })
      .andWhere('p.status != :status', { status: 'cancelado' })
      .andWhere('p.criado_em >= :desde', { desde })
      .groupBy('dia_semana, hora')
      .orderBy('dia_semana', 'ASC')
      .addOrderBy('hora', 'ASC')
      .getRawMany();

    return rows.map(r => ({
      dia_semana: parseInt(r.dia_semana),
      hora: parseInt(r.hora),
      pedidos: parseInt(r.pedidos),
    }));
  }

  async getClientes(lojaId: string, page = 1, limit = 20, busca?: string) {
    const qb = this.clienteRepo
      .createQueryBuilder('c')
      .where('c.loja_id = :lojaId', { lojaId });

    if (busca) {
      qb.andWhere('(c.nome ILIKE :busca OR c.telefone ILIKE :busca)', { busca: `%${busca}%` });
    }

    const [clientes, total] = await qb
      .orderBy('c.criado_em', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const enriched = await Promise.all(clientes.map(async c => {
      const stats = await this.pedidoRepo
        .createQueryBuilder('p')
        .select([
          'COUNT(*) AS total_pedidos',
          'COALESCE(SUM(p.total), 0) AS total_gasto',
          'MAX(p.criado_em) AS ultimo_pedido',
        ])
        .where('p.cliente_id = :clienteId', { clienteId: c.id })
        .andWhere('p.loja_id = :lojaId', { lojaId })
        .andWhere('p.status != :status', { status: 'cancelado' })
        .getRawOne();

      return {
        ...c,
        total_pedidos: parseInt(stats.total_pedidos || '0'),
        total_gasto: parseFloat(stats.total_gasto || '0'),
        ultimo_pedido: stats.ultimo_pedido,
        ticket_medio: parseInt(stats.total_pedidos || '0') > 0
          ? parseFloat(stats.total_gasto || '0') / parseInt(stats.total_pedidos)
          : 0,
      };
    }));

    return { clientes: enriched, total, page, limit };
  }

  async getClientePedidos(clienteId: string, lojaId: string) {
    return this.pedidoRepo.find({
      where: { cliente_id: clienteId, loja_id: lojaId },
      relations: ['itens'],
      order: { criado_em: 'DESC' },
      take: 50,
    });
  }
}
