'use client';

import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { adminGetPedidos, adminAtualizarStatus, adminGetLoja, adminListarMotoboys, adminAtribuirMotoboy } from '@/lib/api';
import { Pedido, Loja, StatusPedido } from '@/types';
import { formatCurrency, STATUS_LABELS, PAGAMENTO_LABELS } from '@/lib/utils';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAuthStore } from '@/stores/auth.store';
import { RefreshCw, Clock, ChevronRight, Bell, CheckCircle2, XCircle, Bike, ShoppingBag } from 'lucide-react';
import toast from 'react-hot-toast';

const COLUNAS: { status: StatusPedido; label: string; cor: string }[] = [
  { status: 'recebido', label: 'Recebidos', cor: 'border-yellow-400 bg-yellow-50' },
  { status: 'confirmado', label: 'Confirmados', cor: 'border-blue-400 bg-blue-50' },
  { status: 'em_producao', label: 'Em Produção', cor: 'border-orange-400 bg-orange-50' },
  { status: 'pronto', label: 'Prontos', cor: 'border-purple-400 bg-purple-50' },
  { status: 'saiu_para_entrega', label: 'Em Rota', cor: 'border-indigo-400 bg-indigo-50' },
  { status: 'entregue', label: 'Entregues', cor: 'border-green-400 bg-green-50' },
];

const PROXIMOS_STATUS: Record<string, StatusPedido[]> = {
  recebido: ['confirmado', 'cancelado'],
  confirmado: ['em_producao', 'cancelado'],
  em_producao: ['pronto', 'cancelado'],
  pronto: ['saiu_para_entrega', 'entregue', 'cancelado'],
  saiu_para_entrega: ['entregue', 'cancelado'],
};

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loja, setLoja] = useState<Loja | null>(null);
  const [loading, setLoading] = useState(true);
  const [pedidoAberto, setPedidoAberto] = useState<Pedido | null>(null);
  const [motoboys, setMotoboys] = useState<any[]>([]);
  const { usuario, token } = useAuthStore();

  const carregarPedidos = useCallback(async () => {
    try {
      const data = await adminGetPedidos();
      setPedidos(data);
    } catch { toast.error('Erro ao carregar pedidos'); }
  }, []);

  useEffect(() => {
    Promise.all([
      carregarPedidos(),
      adminGetLoja().then(setLoja),
      adminListarMotoboys().then(setMotoboys).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  // WebSocket — receber pedidos novos e atualizações
  useEffect(() => {
    if (!usuario?.loja_id || !token) return;
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
    const socket: Socket = io(wsUrl, { transports: ['websocket'], auth: { token } });

    socket.emit('entrar_loja');

    socket.on('pedido:novo', (pedido: Pedido) => {
      setPedidos(prev => [pedido, ...prev]);
      toast.success(`Novo pedido #${pedido.numero_sequencial}!`, { icon: <Bell size={18} /> });
      new Audio('/notification.mp3').play().catch(() => {});
    });

    socket.on('pedido:status_changed', ({ pedido_id, status }: any) => {
      setPedidos(prev => prev.map(p => p.id === pedido_id ? { ...p, status } : p));
    });

    return () => { socket.disconnect(); };
  }, [usuario?.loja_id, token]);

  async function atribuirMotoboy(pedidoId: string, motoboyId: string) {
    // O <select> tem uma opção vazia ("Selecionar motoboy..."); voltar pra ela não é
    // uma atribuição — a API responderia 404 tentando achar um motoboy sem id.
    if (!motoboyId) return;
    try {
      await adminAtribuirMotoboy(pedidoId, motoboyId);
      // Refletir no estado local: sem isso o modal reabre lendo o `pedidos` antigo e
      // o select volta pra "Selecionar motoboy...", dando a impressão de que não salvou.
      setPedidos(prev => prev.map(p => p.id === pedidoId ? { ...p, motoboy_id: motoboyId } : p));
      setPedidoAberto(prev => prev?.id === pedidoId ? { ...prev, motoboy_id: motoboyId } : prev);
      toast.success('Motoboy atribuído!');
    } catch { toast.error('Erro ao atribuir motoboy'); }
  }

  async function atualizarStatus(pedidoId: string, novoStatus: string) {
    try {
      await adminAtualizarStatus(pedidoId, novoStatus);
      setPedidos(prev => prev.map(p => p.id === pedidoId ? { ...p, status: novoStatus as StatusPedido } : p));
      if (pedidoAberto?.id === pedidoId) setPedidoAberto(prev => prev ? { ...prev, status: novoStatus as StatusPedido } : prev);
      toast.success(`Status atualizado: ${STATUS_LABELS[novoStatus]}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao atualizar status');
    }
  }

  const pedidosPorStatus = (status: StatusPedido) =>
    pedidos.filter(p => p.status === status).sort((a, b) =>
      new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime()
    );

  if (loading) return (
    <AdminLayout>
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-gray-200 border-t-[var(--admin-accent)] rounded-full" />
      </div>
    </AdminLayout>
  );

  return (
    <AdminLayout>
      <div className="p-4 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-page-title text-gray-900">Kanban de Pedidos</h1>
            <p className="text-sm text-gray-400 mt-0.5">{pedidos.filter(p => !['entregue','cancelado'].includes(p.status)).length} pedidos ativos</p>
          </div>
          <div className="flex items-center gap-3">
            {loja && (
              <span className={`px-3 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 ${loja.aberta ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {loja.aberta ? <><CheckCircle2 size={13} /> Aberta</> : <><XCircle size={13} /> Fechada</>}
              </span>
            )}
            <button onClick={carregarPedidos} className="p-2 bg-white rounded-xl border border-gray-200 text-gray-500 hover:text-gray-800 transition-colors">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Kanban horizontal scroll */}
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUNAS.map(({ status, label, cor }) => {
            const lista = pedidosPorStatus(status);
            return (
              <div key={status} className={`flex-shrink-0 w-72 rounded-2xl border-2 ${cor} p-3`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-gray-700 text-sm">{label}</span>
                  <span className="bg-white text-gray-600 text-xs font-bold px-2 py-0.5 rounded-full">
                    {lista.length}
                  </span>
                </div>
                <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
                  {lista.map(p => (
                    <PedidoCard key={p.id} pedido={p}
                      motoboyNome={motoboys.find((m: any) => m.id === p.motoboy_id)?.nome}
                      onClick={() => setPedidoAberto(p)}
                      onAvancar={() => {
                        const proximos = PROXIMOS_STATUS[p.status] || [];
                        if (proximos[0]) atualizarStatus(p.id, proximos[0]);
                      }} />
                  ))}
                  {lista.length === 0 && (
                    <p className="text-center text-xs text-gray-400 py-6">Nenhum pedido</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal detalhe do pedido */}
      {pedidoAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={e => e.target === e.currentTarget && setPedidoAberto(null)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900 text-lg">Pedido #{pedidoAberto.numero_sequencial}</h2>
              <button onClick={() => setPedidoAberto(null)} className="text-gray-400 hover:text-gray-700 text-xl">×</button>
            </div>

            <div className="space-y-1 text-sm mb-4">
              {pedidoAberto.itens.map(item => (
                <div key={item.id}>
                  <p className="font-medium">{item.quantidade}x {item.nome_snapshot} — {formatCurrency(Number(item.preco_unitario) * item.quantidade)}</p>
                  {item.opcoes.map(o => (
                    <p key={o.id} className="text-gray-400 text-xs ml-3">+ {o.nome_snapshot}</p>
                  ))}
                  {item.observacao && <p className="text-orange-500 text-xs ml-3">Obs: {item.observacao}</p>}
                </div>
              ))}
            </div>

            <div className="border-t border-gray-100 pt-3 mb-4 text-sm space-y-1 text-gray-600">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(Number(pedidoAberto.subtotal))}</span></div>
              {Number(pedidoAberto.taxa_entrega) > 0 && (
                <div className="flex justify-between"><span>Entrega</span><span>{formatCurrency(Number(pedidoAberto.taxa_entrega))}</span></div>
              )}
              <div className="flex justify-between font-bold text-gray-900 border-t pt-1">
                <span>Total</span><span>{formatCurrency(Number(pedidoAberto.total))}</span>
              </div>
              <p className="text-xs text-gray-400">{PAGAMENTO_LABELS[pedidoAberto.forma_pagamento]}
                {pedidoAberto.troco_para && ` — troco para ${formatCurrency(Number(pedidoAberto.troco_para))}`}
              </p>
            </div>

            {pedidoAberto.endereco_entrega && (
              <div className="bg-gray-50 rounded-xl p-3 text-sm mb-4">
                <p className="font-medium text-gray-700 mb-1">Endereço:</p>
                <p className="text-gray-600">
                  {pedidoAberto.endereco_entrega.rua}, {pedidoAberto.endereco_entrega.numero}
                  {pedidoAberto.endereco_entrega.complemento && `, ${pedidoAberto.endereco_entrega.complemento}`}
                  {' — '}{pedidoAberto.endereco_entrega.bairro}
                </p>
                {pedidoAberto.endereco_entrega.referencia && (
                  <p className="text-gray-400 text-xs mt-0.5">Ref: {pedidoAberto.endereco_entrega.referencia}</p>
                )}
              </div>
            )}

            {/* Atribuir motoboy */}
            {pedidoAberto.tipo === 'entrega' && motoboys.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Motoboy</p>
                <select
                  value={pedidoAberto.motoboy_id || ''}
                  onChange={e => atribuirMotoboy(pedidoAberto.id, e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]">
                  <option value="">Selecionar motoboy...</option>
                  {motoboys.map((m: any) => (
                    <option key={m.id} value={m.id}>{m.nome}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Ações de status */}
            {PROXIMOS_STATUS[pedidoAberto.status] && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ações</p>
                {PROXIMOS_STATUS[pedidoAberto.status].map(s => (
                  <button key={s} onClick={() => atualizarStatus(pedidoAberto.id, s)}
                    className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${
                      s === 'cancelado'
                        ? 'border border-red-200 text-red-600 hover:bg-red-50'
                        : 'bg-[var(--admin-accent)] text-white hover:bg-[var(--admin-accent-hover)]'
                    }`}>
                    {s === 'cancelado' ? 'Cancelar pedido' : `→ ${STATUS_LABELS[s]}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function PedidoCard({ pedido, motoboyNome, onClick, onAvancar }: {
  pedido: Pedido; motoboyNome?: string; onClick: () => void; onAvancar: () => void;
}) {
  const minAtras = Math.floor((Date.now() - new Date(pedido.criado_em).getTime()) / 60000);
  const temProximo = !!PROXIMOS_STATUS[pedido.status]?.filter(s => s !== 'cancelado').length;

  return (
    <div className="bg-white rounded-xl p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="font-bold text-gray-900 text-sm">#{pedido.numero_sequencial}</p>
          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
            <Clock size={11} /> {minAtras < 1 ? 'agora' : `${minAtras}min atrás`}
          </p>
        </div>
        <span className="text-gray-600 bg-gray-100 p-1 rounded-full inline-flex items-center justify-center">
          {pedido.tipo === 'entrega' ? <Bike size={12} /> : <ShoppingBag size={12} />}
        </span>
      </div>
      <p className="text-xs text-gray-600 line-clamp-2 mb-2">
        {pedido.itens.slice(0, 2).map(i => `${i.quantidade}x ${i.nome_snapshot}`).join(', ')}
        {pedido.itens.length > 2 && ` +${pedido.itens.length - 2} itens`}
      </p>
      {motoboyNome && (
        <p className="text-xs text-gray-500 flex items-center gap-1 mb-2">
          <Bike size={11} /> {motoboyNome}
        </p>
      )}
      <div className="flex items-center justify-between">
        <span className="font-bold text-sm text-gray-900">{formatCurrency(Number(pedido.total))}</span>
        {temProximo && (
          <button onClick={e => { e.stopPropagation(); onAvancar(); }}
            className="bg-[var(--admin-accent)] text-white text-xs px-3 py-1.5 rounded-lg font-medium hover:bg-[var(--admin-accent-hover)] transition-colors flex items-center gap-1">
            Avançar <ChevronRight size={12} />
          </button>
        )}
      </div>
    </div>
  );
}
