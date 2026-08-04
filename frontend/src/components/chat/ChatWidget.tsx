'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { MessageCircle, X, Send, ChevronLeft } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const WS = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

type Mensagem = { id: string; autor_tipo: string; conteudo: string; criado_em: string };

export default function ChatWidget({ slug }: { slug: string }) {
  const [aberto, setAberto] = useState(false);
  const [etapa, setEtapa] = useState<'ident' | 'chat'>('ident');
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [conversaId, setConversaId] = useState('');
  const [chatToken, setChatToken] = useState('');
  const [digitando, setDigitando] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(`chat_${slug}`);
    if (saved) {
      try {
        const { clienteId: cid, conversaId: cvid, nome: n, telefone: t, chatToken: token } = JSON.parse(saved);
        // Conversations created before capability tokens were introduced need a
        // fresh identification instead of silently reopening an insecure session.
        if (cid && cvid && token) {
          setClienteId(cid);
          setConversaId(cvid);
          setNome(n);
          setTelefone(t);
          setChatToken(token);
          setEtapa('chat');
        }
      } catch {
        localStorage.removeItem(`chat_${slug}`);
      }
    }
  }, [slug]);

  useEffect(() => {
    if (!conversaId || !chatToken) return;

    const headers = { 'X-Chat-Token': chatToken };
    fetch(`${API}/loja/${slug}/chat/${conversaId}/mensagens`, { headers })
      .then(r => r.ok ? r.json() : [])
      .then(setMensagens);

    const socket = io(WS, { transports: ['websocket'], auth: { chatToken } });
    socketRef.current = socket;
    socket.emit('entrar_conversa', { conversaId, token: chatToken });

    socket.on('mensagem:nova', (msg: Mensagem) => {
      if (msg.autor_tipo !== 'cliente') {
        setMensagens(prev => [...prev, msg]);
        setDigitando(false);
      }
    });

    socket.on('digitando', ({ quem }) => {
      if (quem === 'atendente') {
        setDigitando(true);
        setTimeout(() => setDigitando(false), 3000);
      }
    });

    return () => { socket.disconnect(); };
  }, [conversaId, slug, chatToken]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens, digitando]);

  const identificar = async (e: React.FormEvent) => {
    e.preventDefault();
    const tel = telefone.replace(/\D/g, '');
    if (!nome.trim() || tel.length < 10) return;

    const r = await fetch(`${API}/loja/${slug}/chat/identificar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: nome.trim(), telefone: tel }),
    });
    if (!r.ok) return;
    const { cliente, conversa, chat_token } = await r.json();
    if (!chat_token) return;
    setClienteId(cliente.id);
    setConversaId(conversa.id);
    setChatToken(chat_token);
    setEtapa('chat');
    localStorage.setItem(`chat_${slug}`, JSON.stringify({
      clienteId: cliente.id,
      conversaId: conversa.id,
      nome: nome.trim(),
      telefone: tel,
      chatToken: chat_token,
    }));
  };

  const enviar = async () => {
    if (!texto.trim() || !conversaId || !chatToken) return;
    const r = await fetch(`${API}/loja/${slug}/chat/${conversaId}/mensagens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Chat-Token': chatToken },
      body: JSON.stringify({ conteudo: texto.trim() }),
    });
    if (r.ok) {
      const msg = await r.json();
      setMensagens(prev => [...prev, msg]);
      setTexto('');
    }
  };

  const sair = () => {
    localStorage.removeItem(`chat_${slug}`);
    setEtapa('ident');
    setConversaId('');
    setClienteId('');
    setChatToken('');
    setMensagens([]);
    setNome('');
    setTelefone('');
    setAberto(false);
  };

  const fmtHora = (s: string) => new Date(s).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {aberto && (
        <div className="mb-3 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col"
          style={{ height: '480px' }}>
          {/* Header */}
          <div className="bg-gradient-to-r from-red-500 to-orange-500 px-4 py-3 flex items-center gap-3">
            {etapa === 'chat' && (
              <button onClick={() => setAberto(false)} className="text-white/80 hover:text-white">
                <ChevronLeft size={18} />
              </button>
            )}
            <div className="flex-1">
              <p className="text-white font-semibold text-sm">Fale conosco</p>
              <p className="text-white/70 text-xs">Atendimento online</p>
            </div>
            {etapa === 'chat' && (
              <button onClick={sair} className="text-white/70 hover:text-white text-xs">Sair</button>
            )}
            <button onClick={() => setAberto(false)} className="text-white/80 hover:text-white ml-1">
              <X size={18} />
            </button>
          </div>

          {etapa === 'ident' ? (
            <form onSubmit={identificar} className="flex-1 p-5 flex flex-col gap-4 justify-center">
              <div className="text-center mb-2">
                <p className="font-semibold text-gray-800 inline-flex items-center gap-1.5">
                  <MessageCircle className="w-4 h-4 text-red-500" />
                  Olá!
                </p>
                <p className="text-sm text-gray-500 mt-1">Para continuar, informe seus dados</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Seu nome</label>
                <input value={nome} onChange={e => setNome(e.target.value)} required
                  placeholder="Ex: João Silva"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Telefone / WhatsApp</label>
                <input value={telefone} onChange={e => setTelefone(e.target.value)} required type="tel"
                  placeholder="(11) 99999-9999"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
              </div>
              <button type="submit"
                className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity">
                Iniciar conversa
              </button>
            </form>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
                {mensagens.length === 0 && (
                  <div className="text-center mt-8">
                    <p className="text-gray-400 text-sm">Nenhuma mensagem ainda</p>
                    <p className="text-gray-400 text-xs mt-1">Envie sua mensagem para começar</p>
                  </div>
                )}
                {mensagens.map(msg => (
                  <div key={msg.id} className={`flex ${msg.autor_tipo === 'cliente' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm shadow-sm ${
                      msg.autor_tipo === 'cliente'
                        ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-br-sm'
                        : 'bg-white text-gray-800 rounded-bl-sm border border-gray-100'
                    }`}>
                      <p className="leading-relaxed">{msg.conteudo}</p>
                      <p className={`text-xs mt-1 ${msg.autor_tipo === 'cliente' ? 'text-white/70 text-right' : 'text-gray-400'}`}>
                        {fmtHora(msg.criado_em)}
                      </p>
                    </div>
                  </div>
                ))}
                {digitando && (
                  <div className="flex justify-start">
                    <div className="bg-white px-3 py-2 rounded-2xl rounded-bl-sm shadow-sm border border-gray-100">
                      <div className="flex gap-1 items-center h-4">
                        {[0, 1, 2].map(i => (
                          <div key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                            style={{ animationDelay: `${i * 150}ms` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </div>
              <div className="border-t bg-white px-3 py-2.5 flex items-center gap-2">
                <input
                  value={texto}
                  onChange={e => setTexto(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), enviar())}
                  placeholder="Digite sua mensagem..."
                  className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                />
                <button onClick={enviar}
                  className="w-9 h-9 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-full flex items-center justify-center flex-shrink-0 hover:opacity-90">
                  <Send size={14} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <button onClick={() => setAberto(!aberto)}
        className="ml-auto flex flex-col items-center gap-1 group">
        <div className="w-14 h-14 bg-gradient-to-r from-red-500 to-orange-500 hover:opacity-90 text-white rounded-full shadow-lg flex items-center justify-center transition-all group-hover:scale-105">
          {aberto ? <X size={22} /> : <MessageCircle size={22} />}
        </div>
        {!aberto && (
          <span className="text-xs font-semibold text-gray-600 bg-white px-2 py-0.5 rounded-full shadow-sm whitespace-nowrap">
            Falar com atendente
          </span>
        )}
      </button>
    </div>
  );
}
