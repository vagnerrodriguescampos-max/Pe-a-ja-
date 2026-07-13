'use client';

import { useEffect, useState, useCallback } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAuthStore } from '@/stores/auth.store';
import { Search, ChevronRight, X, Phone, ShoppingBag, DollarSign } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Cliente = {
  id: string;
  nome: string;
  telefone: string;
  criado_em: string;
  total_pedidos: number;
  total_gasto: number;
  ticket_medio: number;
  ultimo_pedido: string | null;
};

type Pedido = {
  id: string;
  numero_sequencial: number;
  status: string;
  total: number;
  forma_pagamento: string;
  criado_em: string;
  itens: { id: string; nome_snapshot: string; quantidade: number; preco_unitario: number }[];
};

const STATUS_COR: Record<string, string> = {
  entregue: 'bg-green-100 text-green-700',
  cancelado: 'bg-red-100 text-red-700',
  recebido: 'bg-gray-100 text-gray-600',
  em_producao: 'bg-yellow-100 text-yellow-700',
  pronto: 'bg-blue-100 text-blue-700',
  saiu_para_entrega: 'bg-purple-100 text-purple-700',
};

export default function ClientesPage() {
  const { token } = useAuthStore();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);
  const [clienteSel, setClienteSel] = useState<Cliente | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loadingPedidos, setLoadingPedidos] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };
  const LIMIT = 20;

  const carregar = useCallback(async (p: number, b: string) => {
    setLoading(true);
    const r = await fetch(`${API}/admin/clientes?page=${p}&limit=${LIMIT}&busca=${encodeURIComponent(b)}`, { headers });
    if (r.ok) {
      const data = await r.json();
      setClientes(data.clientes);
      setTotal(data.total);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { carregar(page, busca); }, [page]);

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); carregar(1, busca); }, 400);
    return () => clearTimeout(t);
  }, [busca]);

  const abrirCliente = async (c: Cliente) => {
    setClienteSel(c);
    setLoadingPedidos(true);
    const r = await fetch(`${API}/admin/clientes/${c.id}/pedidos`, { headers });
    if (r.ok) setPedidos(await r.json());
    setLoadingPedidos(false);
  };

  const fmtMoeda = (v: number) => `R$ ${Number(v).toFixed(2)}`;
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <AdminLayout>
      <div className="flex h-screen">
        {/* Lista */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-6 border-b bg-white">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Clientes</h1>
            <div className="relative max-w-md">
              <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
              <input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar por nome ou telefone..."
                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-500" />
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b sticky top-0">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">Cliente</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Telefone</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Pedidos</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Total gasto</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Ticket médio</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Último pedido</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {clientes.map(c => (
                    <tr key={c.id}
                      onClick={() => abrirCliente(c)}
                      className={`cursor-pointer hover:bg-gray-50 transition-colors ${clienteSel?.id === c.id ? 'bg-red-50' : ''}`}>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-400 to-orange-400 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                            {c.nome?.[0]?.toUpperCase() || '?'}
                          </div>
                          <span className="font-medium text-gray-900 text-sm">{c.nome}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{c.telefone}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">{c.total_pedidos}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">{fmtMoeda(c.total_gasto)}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-600">{fmtMoeda(c.ticket_medio)}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-400">
                        {c.ultimo_pedido ? new Date(c.ultimo_pedido).toLocaleDateString('pt-BR') : '-'}
                      </td>
                      <td className="px-3 py-3">
                        <ChevronRight size={16} className="text-gray-400" />
                      </td>
                    </tr>
                  ))}
                  {clientes.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-12 text-gray-400">Nenhum cliente encontrado</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="border-t bg-white px-6 py-3 flex items-center justify-between">
              <p className="text-sm text-gray-500">{total} clientes no total</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                  Anterior
                </button>
                <span className="text-sm text-gray-600">{page} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                  Próxima
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Painel lateral do cliente */}
        {clienteSel && (
          <div className="w-96 border-l bg-white flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-400 to-orange-400 flex items-center justify-center text-white font-bold">
                  {clienteSel.nome?.[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{clienteSel.nome}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <Phone size={10} /> {clienteSel.telefone}
                  </p>
                </div>
              </div>
              <button onClick={() => setClienteSel(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 p-4 border-b">
              {[
                { icon: ShoppingBag, label: 'Pedidos', value: clienteSel.total_pedidos, cor: 'text-blue-600' },
                { icon: DollarSign, label: 'Total gasto', value: fmtMoeda(clienteSel.total_gasto), cor: 'text-green-600' },
                { icon: DollarSign, label: 'Ticket médio', value: fmtMoeda(clienteSel.ticket_medio), cor: 'text-purple-600' },
              ].map(({ icon: Icon, label, value, cor }) => (
                <div key={label} className="text-center">
                  <Icon size={16} className={`${cor} mx-auto mb-1`} />
                  <p className="text-sm font-bold text-gray-900">{value}</p>
                  <p className="text-xs text-gray-400">{label}</p>
                </div>
              ))}
            </div>

            {/* Pedidos */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <h3 className="font-semibold text-sm text-gray-700">Histórico de pedidos</h3>
              {loadingPedidos ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-500" />
                </div>
              ) : pedidos.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">Sem pedidos</p>
              ) : (
                pedidos.map(p => (
                  <div key={p.id} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm text-gray-800">#{p.numero_sequencial}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COR[p.status] || 'bg-gray-100 text-gray-600'}`}>
                        {p.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="space-y-1 mb-2">
                      {p.itens?.slice(0, 3).map(item => (
                        <p key={item.id} className="text-xs text-gray-600">
                          {item.quantidade}x {item.nome_snapshot}
                        </p>
                      ))}
                      {p.itens?.length > 3 && <p className="text-xs text-gray-400">+{p.itens.length - 3} itens</p>}
                    </div>
                    <div className="flex items-center justify-between border-t pt-2">
                      <span className="text-xs text-gray-400">{new Date(p.criado_em).toLocaleDateString('pt-BR')}</span>
                      <span className="text-sm font-bold text-gray-900">{fmtMoeda(p.total)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
