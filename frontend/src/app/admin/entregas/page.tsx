'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { io, Socket } from 'socket.io-client';
import AdminLayout from '@/components/admin/AdminLayout';
import { adminGetEntregasAtivas } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { formatCurrency } from '@/lib/utils';
import type { EntregaAtiva } from '@/components/admin/MapaEntregasLoja';
import { Bike, MapPin, RefreshCw, Clock, WifiOff } from 'lucide-react';
import toast from 'react-hot-toast';

const MapaEntregasLoja = dynamic(() => import('@/components/admin/MapaEntregasLoja'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-gray-100 animate-pulse" />,
});

function minutosAtras(iso: string) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  return min < 1 ? 'agora' : `${min}min`;
}

export default function EntregasPage() {
  const [entregas, setEntregas] = useState<EntregaAtiva[]>([]);
  const [loading, setLoading] = useState(true);
  const [destacado, setDestacado] = useState<string | null>(null);
  const { usuario, token } = useAuthStore();

  const carregar = useCallback(async () => {
    try {
      setEntregas(await adminGetEntregasAtivas());
    } catch {
      toast.error('Erro ao carregar entregas');
    }
  }, []);

  useEffect(() => {
    carregar().finally(() => setLoading(false));
  }, [carregar]);

  // Posição chega por WebSocket na sala da loja. O refetch periódico é só uma rede de
  // segurança para quando o socket cai — a atualização normal é a de tempo real.
  useEffect(() => {
    const t = setInterval(carregar, 60_000);
    return () => clearInterval(t);
  }, [carregar]);

  useEffect(() => {
    if (!usuario?.loja_id || !token) return;
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
    const socket: Socket = io(wsUrl, { transports: ['websocket'], auth: { token } });

    socket.emit('entrar_loja');

    socket.on('motoboy:posicao_atualizada', (d: { pedido_id: string; lat: number; lng: number; atualizado_em: string }) => {
      setEntregas(prev => prev.map(e =>
        e.pedido_id === d.pedido_id
          ? { ...e, posicao: { lat: d.lat, lng: d.lng, atualizado_em: d.atualizado_em } }
          : e,
      ));
    });

    // Um pedido que sai de "em rota" (entregue/cancelado) deve sumir do mapa na hora.
    socket.on('pedido:status_changed', ({ pedido_id, status }: { pedido_id: string; status: string }) => {
      if (status !== 'saiu_para_entrega') {
        setEntregas(prev => prev.filter(e => e.pedido_id !== pedido_id));
      } else {
        carregar();
      }
    });

    return () => { socket.disconnect(); };
  }, [usuario?.loja_id, token, carregar]);

  const semSinal = entregas.filter(e => !e.posicao).length;

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
            <h1 className="text-page-title text-gray-900">Entregas em rota</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {entregas.length === 0
                ? 'Nenhuma entrega em rota agora'
                : `${entregas.length} entrega(s) acontecendo agora`}
            </p>
          </div>
          <button onClick={carregar}
            className="p-2 bg-white rounded-xl border border-gray-200 text-gray-500 hover:text-gray-800 transition-colors">
            <RefreshCw size={16} />
          </button>
        </div>

        {entregas.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
            <Bike size={32} className="mx-auto text-gray-300 mb-3" />
            <p className="font-semibold text-gray-700">Nenhum motoboy na rua no momento</p>
            <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">
              Quando um motoboy iniciar a corrida no app dele, o pedido aparece aqui no mapa
              e você acompanha o trajeto até a entrega.
            </p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1fr_340px] gap-4">
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden h-[560px]">
              <MapaEntregasLoja
                entregas={entregas}
                pedidoDestacado={destacado}
                onSelecionar={setDestacado}
              />
            </div>

            <div className="space-y-2 lg:max-h-[560px] lg:overflow-y-auto">
              {semSinal > 0 && (
                <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-800">
                  <WifiOff size={14} className="mt-0.5 flex-shrink-0" />
                  <span>
                    {semSinal} entrega(s) ainda sem sinal de GPS. A posição aparece assim que o
                    motoboy iniciar a corrida com a localização ativa no celular.
                  </span>
                </div>
              )}

              {entregas.map(e => (
                <button key={e.pedido_id}
                  onClick={() => setDestacado(e.pedido_id)}
                  className={`w-full text-left bg-white rounded-xl p-3 border transition-colors ${
                    destacado === e.pedido_id
                      ? 'border-[var(--admin-accent)]'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-gray-900 text-sm">#{e.numero_sequencial}</span>
                    <span className="font-semibold text-sm text-gray-900">
                      {formatCurrency(Number(e.total ?? 0))}
                    </span>
                  </div>

                  <p className="text-xs text-gray-600 flex items-center gap-1">
                    <Bike size={11} /> {e.motoboy_nome || 'Sem motoboy atribuído'}
                  </p>

                  {e.endereco_entrega && (
                    <p className="text-xs text-gray-400 flex items-start gap-1 mt-1">
                      <MapPin size={11} className="mt-0.5 flex-shrink-0" />
                      <span>
                        {e.endereco_entrega.rua}, {e.endereco_entrega.numero} — {e.endereco_entrega.bairro}
                      </span>
                    </p>
                  )}

                  <p className="text-xs mt-1.5">
                    {e.posicao ? (
                      <span className="text-green-600 font-medium inline-flex items-center gap-1">
                        <Clock size={10} /> GPS há {minutosAtras(e.posicao.atualizado_em)}
                      </span>
                    ) : (
                      <span className="text-gray-400 inline-flex items-center gap-1">
                        <WifiOff size={10} /> aguardando GPS
                      </span>
                    )}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
