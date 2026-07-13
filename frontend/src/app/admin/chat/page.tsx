'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAuthStore } from '@/stores/auth.store';
import { io, Socket } from 'socket.io-client';
import { Send, CheckCheck, Search, Package, X, Circle } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const WS = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

type Conversa = {
  id: string;
  status: string;
  nao_lidas: number;
  ultima_mensagem_em: string;
  cliente: { id: string; nome: string; telefone: string };
  ultima_mensagem?: { conteudo: string; autor_tipo: string };
  atendente?: { nome: string };
};

type Mensagem = {
  id: string;
  autor_tipo: string;
  conteudo: string;
  criado_em: string;
  lida: boolean;
  pedido_id?: string;
};

type Pedido = {
  id: string;
  numero_sequencial: number;
  status: string;
  total: number;
  criado_em: string;
};

const STATUS_CORES: Record<string, string> = {
  aberta: 'bg-green-400',
  em_atendimento: 'bg-yellow-400',
  resolvida: 'bg-gray-300',
};

const STATUS_LABELS: Record<string, string> = {
  aberta: 'Aberta',
  em_atendimento: 'Em atendimento',
  resolvida: 'Resolvida',
};

export default function ChatAdminPage() {
  const { token, usuario } = useAuthStore();
  const lojaId = usuario?.loja_id;
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [convAtual, setConvAtual] = useState<Conversa | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [texto, setTexto] = useState('');
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todas');
  const [abaDir, setAbaDir] = useState<'chat' | 'pedidos'>('chat');
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const carregarConversas = useCallback(async () => {
    const r = await fetch(`${API}/admin/chat/conversas`, { headers });
    if (r.ok) setConversas(await r.json());
  }, [token]);

  const abrirConversa = useCallback(async (conv: Conversa) => {
    setConvAtual(conv);
    setAbaDir('chat');
    const r = await fetch(`${API}/admin/chat/conversas/${conv.id}/mensagens`, { headers });
    if (r.ok) setMensagens(await r.json());
    setConversas(prev => prev.map(c => c.id === conv.id ? { ...c, nao_lidas: 0 } : c));
    socketRef.current?.emit('entrar_conversa', conv.id);
  }, [token]);

  const carregarPedidos = useCallback(async (convId: string) => {
    const r = await fetch(`${API}/admin/chat/conversas/${convId}/pedidos`, { headers });
    if (r.ok) setPedidos(await r.json());
  }, [token]);

  useEffect(() => {
    carregarConversas();
    const socket = io(WS, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.emit('entrar_inbox', lojaId);

    socket.on('inbox:atualizar', ({ conversa_id, ultima_mensagem, nao_lidas }) => {
      setConversas(prev => prev.map(c =>
        c.id === conversa_id ? { ...c, ultima_mensagem, nao_lidas, ultima_mensagem_em: new Date().toISOString() } : c
      ).sort((a, b) => new Date(b.ultima_mensagem_em).getTime() - new Date(a.ultima_mensagem_em).getTime()));

      setConvAtual(cur => {
        if (cur?.id === conversa_id) return { ...cur, nao_lidas: 0 };
        return cur;
      });
    });

    socket.on('mensagem:nova', (msg: Mensagem) => {
      setConvAtual(cur => {
        if (cur && msg.autor_tipo !== 'atendente') {
          setMensagens(prev => [...prev, msg]);
        }
        return cur;
      });
    });

    socket.on('conversa:status', ({ conversa_id, status }) => {
      setConversas(prev => prev.map(c => c.id === conversa_id ? { ...c, status } : c));
      setConvAtual(cur => cur?.id === conversa_id ? { ...cur, status } : cur);
    });

    return () => { socket.disconnect(); };
  }, [lojaId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  const enviar = async () => {
    if (!texto.trim() || !convAtual) return;
    const r = await fetch(`${API}/admin/chat/conversas/${convAtual.id}/mensagens`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ conteudo: texto.trim() }),
    });
    if (r.ok) {
      const msg = await r.json();
      setMensagens(prev => [...prev, msg]);
      setTexto('');
    }
  };

  const atualizarStatus = async (status: string) => {
    if (!convAtual) return;
    await fetch(`${API}/admin/chat/conversas/${convAtual.id}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status }),
    });
  };

  const conversasFiltradas = conversas.filter(c => {
    const matchBusca = !busca || c.cliente?.nome?.toLowerCase().includes(busca.toLowerCase()) || c.cliente?.telefone?.includes(busca);
    const matchFiltro = filtro === 'todas' || c.status === filtro;
    return matchBusca && matchFiltro;
  });

  const fmtHora = (s: string) => {
    const d = new Date(s);
    const agora = new Date();
    if (d.toDateString() === agora.toDateString()) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  return (
    <AdminLayout>
      <div className="flex h-screen bg-gray-100" style={{ height: 'calc(100vh - 0px)' }}>
        {/* Lista de conversas */}
        <div className="w-80 bg-white border-r flex flex-col flex-shrink-0">
          <div className="p-4 border-b bg-gray-50">
            <h2 className="font-semibold text-gray-800 mb-3">Inbox</h2>
            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
              <input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar cliente..."
                className="w-full pl-8 pr-3 py-2 text-sm bg-gray-100 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-red-300"
              />
            </div>
            <div className="flex gap-1">
              {['todas', 'aberta', 'em_atendimento', 'resolvida'].map(f => (
                <button key={f} onClick={() => setFiltro(f)}
                  className={`text-xs px-2 py-1 rounded-full font-medium transition-colors ${filtro === f ? 'bg-red-100 text-red-600' : 'text-gray-500 hover:bg-gray-100'}`}>
                  {f === 'todas' ? 'Todas' : f === 'aberta' ? 'Abertas' : f === 'em_atendimento' ? 'Em atend.' : 'Resolvidas'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {conversasFiltradas.length === 0 && (
              <p className="text-center text-gray-400 text-sm mt-8">Nenhuma conversa</p>
            )}
            {conversasFiltradas.map(conv => (
              <button key={conv.id} onClick={() => abrirConversa(conv)}
                className={`w-full text-left px-4 py-3 border-b hover:bg-gray-50 transition-colors ${convAtual?.id === conv.id ? 'bg-red-50' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-400 to-orange-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {conv.cliente?.nome?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm text-gray-900 truncate">{conv.cliente?.nome || 'Cliente'}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {conv.ultima_mensagem_em && <span className="text-xs text-gray-400">{fmtHora(conv.ultima_mensagem_em)}</span>}
                        {conv.nao_lidas > 0 && (
                          <span className="bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">{conv.nao_lidas}</span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{conv.ultima_mensagem?.conteudo || 'Sem mensagens'}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Circle size={6} className={`${STATUS_CORES[conv.status]} rounded-full fill-current`} />
                      <span className="text-xs text-gray-400">{STATUS_LABELS[conv.status]}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Área principal */}
        {convAtual ? (
          <div className="flex-1 flex flex-col">
            {/* Header da conversa */}
            <div className="bg-white border-b px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-400 to-orange-400 flex items-center justify-center text-white font-bold text-sm">
                  {convAtual.cliente?.nome?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{convAtual.cliente?.nome}</p>
                  <p className="text-xs text-gray-400">{convAtual.cliente?.telefone}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setAbaDir('pedidos'); carregarPedidos(convAtual.id); }}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${abaDir === 'pedidos' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  <Package size={13} />
                  Pedidos
                </button>
                <select
                  value={convAtual.status}
                  onChange={e => atualizarStatus(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-red-300">
                  <option value="aberta">Aberta</option>
                  <option value="em_atendimento">Em atendimento</option>
                  <option value="resolvida">Resolvida</option>
                </select>
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Mensagens */}
              <div className={`flex flex-col ${abaDir === 'pedidos' ? 'flex-1' : 'flex-1'}`}>
                <div className="flex-1 overflow-y-auto p-4 space-y-2"
                  style={{ backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
                  {mensagens.map(msg => (
                    <div key={msg.id} className={`flex ${msg.autor_tipo === 'atendente' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-xs lg:max-w-md px-3 py-2 rounded-2xl shadow-sm ${
                        msg.autor_tipo === 'atendente'
                          ? 'bg-green-500 text-white rounded-br-sm'
                          : 'bg-white text-gray-800 rounded-bl-sm'
                      }`}>
                        <p className="text-sm leading-relaxed">{msg.conteudo}</p>
                        <div className={`flex items-center gap-1 mt-1 ${msg.autor_tipo === 'atendente' ? 'justify-end' : 'justify-start'}`}>
                          <span className={`text-xs ${msg.autor_tipo === 'atendente' ? 'text-green-100' : 'text-gray-400'}`}>
                            {new Date(msg.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {msg.autor_tipo === 'atendente' && <CheckCheck size={12} className="text-green-100" />}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="bg-white border-t px-4 py-3 flex items-center gap-3">
                  <input
                    value={texto}
                    onChange={e => setTexto(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), enviar())}
                    placeholder="Digite uma mensagem..."
                    className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                  />
                  <button onClick={enviar}
                    className="w-10 h-10 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors">
                    <Send size={16} />
                  </button>
                </div>
              </div>

              {/* Painel de pedidos */}
              {abaDir === 'pedidos' && (
                <div className="w-72 bg-white border-l flex flex-col">
                  <div className="px-4 py-3 border-b flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-gray-800">Pedidos do cliente</h3>
                    <button onClick={() => setAbaDir('chat')} className="text-gray-400 hover:text-gray-600">
                      <X size={16} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {pedidos.length === 0 && <p className="text-sm text-gray-400 text-center mt-4">Nenhum pedido</p>}
                    {pedidos.map(p => (
                      <div key={p.id} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-sm text-gray-800">#{p.numero_sequencial}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            p.status === 'entregue' ? 'bg-green-100 text-green-700' :
                            p.status === 'cancelado' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>{p.status}</span>
                        </div>
                        <p className="text-sm font-semibold text-gray-900">R$ {Number(p.total).toFixed(2)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{new Date(p.criado_em).toLocaleDateString('pt-BR')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="text-6xl mb-4">💬</div>
              <p className="text-gray-500 font-medium">Selecione uma conversa</p>
              <p className="text-gray-400 text-sm mt-1">para começar a atender</p>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
