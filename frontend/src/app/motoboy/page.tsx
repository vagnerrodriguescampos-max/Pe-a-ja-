'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { io, Socket } from 'socket.io-client';
import dynamic from 'next/dynamic';
import { MapPin, Navigation, CheckCircle, Package, LogOut, Bike } from 'lucide-react';
import toast from 'react-hot-toast';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const WS = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

// Leaflet precisa de importação dinâmica (SSR off)
const MapaEntrega = dynamic(() => import('@/components/motoboy/MapaEntrega'), { ssr: false });

type Pedido = {
  id: string;
  numero_sequencial: number;
  status: string;
  total: number;
  endereco_entrega: any;
  itens: { nome_snapshot: string; quantidade: number }[];
};

const STATUS_LABELS: Record<string, string> = {
  pronto: 'Aguardando retirada',
  saiu_para_entrega: 'Em entrega',
};

export default function MotoboyPage() {
  const { token, usuario, isAuthenticated, logout } = useAuthStore();
  const router = useRouter();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [pedidoAtivo, setPedidoAtivo] = useState<Pedido | null>(null);
  const [posicaoAtual, setPosicaoAtual] = useState<{ lat: number; lng: number } | null>(null);
  const [rastreando, setRastreando] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    if (!isAuthenticated() || usuario?.papel !== 'motoboy') {
      router.replace('/motoboy/login');
      return;
    }
    carregarPedidos();
    const socket = io(WS, { transports: ['websocket'], auth: { token } });
    socketRef.current = socket;
    return () => { socket.disconnect(); pararRastreamento(); };
  }, []);

  const carregarPedidos = async () => {
    const r = await fetch(`${API}/motoboy/pedidos`, { headers });
    if (r.ok) setPedidos(await r.json());
  };

  const iniciarRastreamento = (pedido: Pedido) => {
    setPedidoAtivo(pedido);
    setRastreando(true);
    socketRef.current?.emit('motoboy:entrar_pedido', pedido.id);

    if (!navigator.geolocation) { toast.error('GPS não disponível'); return; }

    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setPosicaoAtual({ lat, lng });
        socketRef.current?.emit('motoboy:posicao', {
          pedidoId: pedido.id,
          lat,
          lng,
        });
      },
      err => toast.error('Erro ao obter localização: ' + err.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
    );
  };

  const pararRastreamento = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setRastreando(false);
  };

  const marcarEntregue = async (pedidoId: string) => {
    const r = await fetch(`${API}/admin/pedidos/${pedidoId}/status`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ status: 'entregue' }),
    });
    if (r.ok) {
      toast.success('Pedido marcado como entregue!');
      pararRastreamento();
      setPedidoAtivo(null);
      carregarPedidos();
    }
  };

  if (!isAuthenticated() || usuario?.papel !== 'motoboy') return null;

  return (
    <div className="admin-dark min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 px-4 py-4 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-3">
          <Bike size={24} className="text-orange-400" />
          <div>
            <p className="font-bold">{usuario.nome}</p>
            <p className="text-xs text-gray-400">Motoboy</p>
          </div>
        </div>
        <button onClick={() => { logout(); router.push('/motoboy/login'); }}
          className="text-gray-400 hover:text-white">
          <LogOut size={20} />
        </button>
      </div>

      {/* Mapa (quando rastreando) */}
      {rastreando && pedidoAtivo && (
        <div className="h-64 relative">
          <MapaEntrega
            posicaoMotoboy={posicaoAtual}
            enderecoEntrega={pedidoAtivo.endereco_entrega}
          />
          <div className="absolute top-3 left-3 bg-orange-500 text-white px-3 py-1.5 rounded-full text-sm font-semibold flex items-center gap-1.5">
            <Navigation size={14} className="animate-pulse" />
            Rastreando em tempo real
          </div>
        </div>
      )}

      {/* Pedido ativo */}
      {pedidoAtivo && (
        <div className="mx-4 mt-4 bg-gray-800 rounded-2xl p-4 border border-orange-500/40">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-orange-400">Pedido #{pedidoAtivo.numero_sequencial}</h2>
            <span className="text-xs bg-orange-500/20 text-orange-300 px-2 py-1 rounded-full">
              {STATUS_LABELS[pedidoAtivo.status] || pedidoAtivo.status}
            </span>
          </div>

          {pedidoAtivo.endereco_entrega && (
            <div className="flex items-start gap-2 mb-3">
              <MapPin size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-300">
                {pedidoAtivo.endereco_entrega.rua}, {pedidoAtivo.endereco_entrega.numero}
                {pedidoAtivo.endereco_entrega.complemento ? ` - ${pedidoAtivo.endereco_entrega.complemento}` : ''}
                {' '}- {pedidoAtivo.endereco_entrega.bairro}
              </p>
            </div>
          )}

          <div className="flex gap-2 mt-3">
            {!rastreando ? (
              <button onClick={() => iniciarRastreamento(pedidoAtivo)}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2">
                <Navigation size={15} />
                Iniciar rastreamento
              </button>
            ) : (
              <button onClick={pararRastreamento}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2.5 rounded-xl text-sm font-medium">
                Pausar GPS
              </button>
            )}
            <button onClick={() => marcarEntregue(pedidoAtivo.id)}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2">
              <CheckCircle size={15} />
              Entregue!
            </button>
          </div>
        </div>
      )}

      {/* Lista de pedidos */}
      <div className="px-4 mt-4 pb-8">
        <h2 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wide">
          {pedidos.length === 0 ? 'Sem entregas pendentes' : `${pedidos.length} entrega(s) pendente(s)`}
        </h2>
        <div className="space-y-3">
          {pedidos.map(p => (
            <div key={p.id}
              onClick={() => setPedidoAtivo(p)}
              className={`bg-gray-800 rounded-2xl p-4 cursor-pointer border transition-colors ${pedidoAtivo?.id === p.id ? 'border-orange-500' : 'border-gray-700 hover:border-gray-600'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Package size={16} className="text-orange-400" />
                  <span className="font-bold">Pedido #{p.numero_sequencial}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === 'pronto' ? 'bg-blue-500/20 text-blue-300' : 'bg-orange-500/20 text-orange-300'}`}>
                  {STATUS_LABELS[p.status] || p.status}
                </span>
              </div>
              {p.endereco_entrega && (
                <p className="text-sm text-gray-400 flex items-center gap-1">
                  <MapPin size={12} />
                  {p.endereco_entrega.rua}, {p.endereco_entrega.numero} — {p.endereco_entrega.bairro}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">{p.itens?.length || 0} itens · R$ {Number(p.total).toFixed(2)}</p>
            </div>
          ))}
        </div>

        <button onClick={carregarPedidos}
          className="w-full mt-4 bg-gray-800 hover:bg-gray-700 text-gray-300 py-3 rounded-xl text-sm transition-colors">
          Atualizar lista
        </button>
      </div>
    </div>
  );
}
