'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import dynamic from 'next/dynamic';
import { getPedido, getLoja } from '@/lib/api';
import { Pedido, Loja, StatusPedido } from '@/types';
import { formatCurrency, STATUS_LABELS, PAGAMENTO_LABELS } from '@/lib/utils';
import { useFaviconLoja } from '@/hooks/useFaviconLoja';
import { CheckCircle, Clock, ChefHat, Package, Bike, Home, XCircle, QrCode, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const MapaEntrega = dynamic(() => import('@/components/motoboy/MapaEntrega'), { ssr: false });

const STATUS_ICONS: Record<string, React.ReactNode> = {
  recebido: <Clock size={20} />,
  confirmado: <CheckCircle size={20} />,
  em_producao: <ChefHat size={20} />,
  pronto: <Package size={20} />,
  saiu_para_entrega: <Bike size={20} />,
  entregue: <Home size={20} />,
  cancelado: <XCircle size={20} />,
};

const FLUXO_ENTREGA: StatusPedido[] = ['recebido', 'confirmado', 'em_producao', 'pronto', 'saiu_para_entrega', 'entregue'];
const FLUXO_RETIRADA: StatusPedido[] = ['recebido', 'confirmado', 'em_producao', 'pronto', 'entregue'];

export default function AcompanharPedidoPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const id = params.id as string;

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [loja, setLoja] = useState<Loja | null>(null);
  const [loading, setLoading] = useState(true);
  const [posicaoMotoboy, setPosicaoMotoboy] = useState<{ lat: number; lng: number } | null>(null);
  const [tokenAcesso, setTokenAcesso] = useState('');
  const [tokenResolvido, setTokenResolvido] = useState(false);

  useFaviconLoja(loja?.logo_url);

  useEffect(() => {
    const tokenDaUrl = searchParams.get('token');
    const tokenSalvo = localStorage.getItem(`pedido_acesso_${id}`);
    const token = tokenDaUrl || tokenSalvo || '';
    if (tokenDaUrl) localStorage.setItem(`pedido_acesso_${id}`, tokenDaUrl);
    setTokenAcesso(token);
    setTokenResolvido(true);
  }, [id, searchParams]);

  useEffect(() => {
    if (!tokenResolvido) return;
    if (!tokenAcesso) {
      setLoading(false);
      return;
    }
    async function load() {
      try {
        const [pedidoData, lojaData] = await Promise.all([getPedido(id, tokenAcesso), getLoja(slug)]);
        setPedido(pedidoData);
        setLoja(lojaData);
        document.documentElement.style.setProperty('--color-primary', lojaData.cor_primaria);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, slug, tokenAcesso, tokenResolvido]);

  // WebSocket — ouvir mudanças de status
  useEffect(() => {
    if (!tokenAcesso) return;
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
    const socket: Socket = io(wsUrl, {
      transports: ['websocket'],
      auth: { trackingToken: tokenAcesso },
    });

    socket.emit('entrar_pedido', { pedidoId: id, token: tokenAcesso });
    socket.emit('motoboy:entrar_pedido', { pedidoId: id, token: tokenAcesso });

    socket.on('pedido:status_changed', (data: { pedido_id: string; status: string }) => {
      if (data.pedido_id === id) {
        setPedido(prev => prev ? { ...prev, status: data.status as StatusPedido } : prev);
      }
    });

    socket.on('motoboy:posicao_atualizada', (data: { pedido_id: string; lat: number; lng: number }) => {
      if (data.pedido_id === id) {
        setPosicaoMotoboy({ lat: data.lat, lng: data.lng });
      }
    });

    return () => { socket.disconnect(); };
  }, [id, tokenAcesso]);

  if (loading) return (
    <div className="min-h-screen bg-[#14110e] flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-4 border-white/10 border-t-[var(--color-primary)] rounded-full" />
    </div>
  );

  if (!tokenAcesso) return (
    <div className="min-h-screen bg-[#14110e] flex items-center justify-center px-6 text-center text-gray-400">
      Este pedido precisa ser aberto pelo link seguro enviado após a confirmação.
    </div>
  );

  if (!pedido || !loja) return null;

  const fluxo = pedido.tipo === 'retirada' ? FLUXO_RETIRADA : FLUXO_ENTREGA;
  const cancelado = pedido.status === 'cancelado';
  const idxAtual = fluxo.indexOf(pedido.status as StatusPedido);

  return (
    <div className="admin-dark min-h-screen bg-[#0d0b09] flex justify-center">
      <div className="w-full max-w-[500px] bg-[#14110e] min-h-screen">
        {/* Header */}
        <div className="px-4 pt-6 pb-8" style={{ background: `linear-gradient(160deg, ${loja.cor_primaria} 0%, #14110e 130%)` }}>
          <Link href={`/loja/${slug}`} className="inline-flex items-center gap-1.5 text-white/70 text-sm hover:text-white transition-colors">
            <ArrowLeft size={16} /> Voltar ao cardápio
          </Link>
          <h1 className="text-xl font-bold mt-3 text-white">{loja.nome}</h1>
          <p className="text-white/70 text-sm mt-0.5">Pedido #{pedido.numero_sequencial}</p>
        </div>

        <div className="px-4 -mt-4 pb-16 space-y-4">

          {/* Status atual */}
          <div className="bg-[#201d16] border border-white/5 rounded-2xl p-5">
            {cancelado ? (
              <div className="flex items-center gap-3 text-red-400">
                <XCircle size={32} />
                <div>
                  <p className="font-bold text-lg">Pedido Cancelado</p>
                  <p className="text-sm text-gray-500">Entre em contato com a loja para mais informações</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-5" style={{ color: loja.cor_primaria }}>
                  {STATUS_ICONS[pedido.status]}
                  <div>
                    <p className="font-bold text-lg text-white">{STATUS_LABELS[pedido.status]}</p>
                    {pedido.status !== 'entregue' && (
                      <p className="text-sm text-gray-500">Tempo estimado: {loja.prazo_medio_min} min</p>
                    )}
                  </div>
                </div>

                {/* Linha do tempo */}
                <div className="relative">
                  {fluxo.map((s, idx) => {
                    const passado = idx < idxAtual;
                    const atual = idx === idxAtual;
                    const futuro = idx > idxAtual;
                    return (
                      <div key={s} className="flex items-start gap-3 mb-4 last:mb-0">
                        <div className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm transition-all ${
                            passado ? 'bg-green-500 text-white' :
                            atual ? 'text-white' : 'bg-white/5 text-gray-600'
                          }`} style={atual ? { backgroundColor: loja.cor_primaria } : {}}>
                            {passado ? <CheckCircle size={16} /> : STATUS_ICONS[s]}
                          </div>
                          {idx < fluxo.length - 1 && (
                            <div className={`w-0.5 h-6 mt-1 ${passado ? 'bg-green-500/60' : 'bg-white/10'}`} />
                          )}
                        </div>
                        <div className="pt-1.5">
                          <p className={`text-sm font-medium ${atual ? 'text-white' : futuro ? 'text-gray-600' : 'text-gray-400'}`}>
                            {STATUS_LABELS[s]}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Mapa do motoboy */}
          {pedido.status === 'saiu_para_entrega' && (
            <div className="bg-[#201d16] border border-white/5 rounded-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/8">
                <Bike size={16} style={{ color: loja.cor_primaria }} />
                <span className="font-semibold text-white text-sm">Motoboy a caminho</span>
                {posicaoMotoboy && (
                  <span className="ml-auto text-xs text-green-400 font-medium animate-pulse">● Ao vivo</span>
                )}
              </div>
              <div className="h-52">
                <MapaEntrega posicaoMotoboy={posicaoMotoboy} enderecoEntrega={pedido.endereco_entrega} />
              </div>
            </div>
          )}

          {/* PIX — exibir chave se pagamento for PIX */}
          {pedido.forma_pagamento === 'pix' && loja.chave_pix && pedido.status !== 'entregue' && (
            <div className="bg-[#201d16] border border-blue-400/20 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <QrCode size={18} className="text-blue-400" />
                <span className="font-bold text-blue-300">Pagamento via PIX</span>
              </div>
              <p className="text-xs text-gray-500 mb-2">Copie a chave abaixo e realize o pagamento:</p>
              <div className="bg-blue-500/10 rounded-xl p-3">
                <p className="text-sm font-mono text-blue-300 break-all select-all">{loja.chave_pix}</p>
              </div>
              <p className="text-xs text-blue-400/80 mt-2">
                Após pagar, envie o comprovante para {loja.telefone || 'a loja'}
              </p>
            </div>
          )}

          {/* Detalhes do pedido */}
          <div className="bg-[#201d16] border border-white/5 rounded-2xl p-4">
            <h2 className="font-bold text-white mb-3">Detalhes do pedido</h2>
            <div className="space-y-2">
              {pedido.itens.map(item => (
                <div key={item.id}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-200">{item.quantidade}x {item.nome_snapshot}</span>
                    <span className="text-gray-400">
                      {formatCurrency(Number(item.preco_unitario) * item.quantidade)}
                    </span>
                  </div>
                  {item.opcoes.length > 0 && (
                    <p className="text-xs text-gray-500 ml-4">
                      {item.opcoes.map(o => `${o.nome_snapshot}${Number(o.preco_adicional_snapshot) > 0 ? ` (+${formatCurrency(Number(o.preco_adicional_snapshot))})` : ''}`).join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-white/8 mt-3 pt-3 space-y-1 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span>
                <span>{formatCurrency(Number(pedido.subtotal))}</span>
              </div>
              {Number(pedido.taxa_entrega) > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Entrega</span>
                  <span>{formatCurrency(Number(pedido.taxa_entrega))}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-white border-t border-white/8 pt-1">
                <span>Total</span>
                <span>{formatCurrency(Number(pedido.total))}</span>
              </div>
              <p className="text-xs text-gray-500 pt-1">
                {PAGAMENTO_LABELS[pedido.forma_pagamento]}
                {pedido.troco_para && ` — troco para ${formatCurrency(Number(pedido.troco_para))}`}
              </p>
            </div>
          </div>

          {/* Endereço */}
          {pedido.endereco_entrega && (
            <div className="bg-[#201d16] border border-white/5 rounded-2xl p-4">
              <h2 className="font-bold text-white mb-2 flex items-center gap-2">
                <Bike size={16} /> Entrega em
              </h2>
              <p className="text-sm text-gray-400">
                {pedido.endereco_entrega.rua}, {pedido.endereco_entrega.numero}
                {pedido.endereco_entrega.complemento && `, ${pedido.endereco_entrega.complemento}`}
                {' — '}{pedido.endereco_entrega.bairro}, {pedido.endereco_entrega.cidade}
              </p>
              {pedido.endereco_entrega.referencia && (
                <p className="text-xs text-gray-500 mt-1">Ref: {pedido.endereco_entrega.referencia}</p>
              )}
            </div>
          )}

          <div className="text-center">
            <Link href={`/loja/${slug}`}
              className="text-sm font-medium hover:underline" style={{ color: loja.cor_primaria }}>
              Fazer outro pedido
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
