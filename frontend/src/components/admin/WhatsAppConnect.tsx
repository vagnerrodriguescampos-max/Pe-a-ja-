'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, CheckCircle2, Loader2, Unlink } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminConectarWhatsapp, adminDesconectarWhatsapp, adminGetWhatsappStatus } from '@/lib/api';

const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID;
const META_CONFIG_ID = process.env.NEXT_PUBLIC_META_CONFIG_ID;
const SDK_PRONTA = typeof META_APP_ID === 'string' && META_APP_ID.length > 0
  && typeof META_CONFIG_ID === 'string' && META_CONFIG_ID.length > 0;

declare global {
  interface Window {
    FB?: any;
    fbAsyncInit?: () => void;
  }
}

type Status = {
  conectado: boolean;
  numero: string | null;
  conectado_em: string | null;
  integracao_configurada: boolean;
};

function carregarSdkFacebook(): Promise<void> {
  return new Promise(resolve => {
    if (window.FB) { resolve(); return; }
    window.fbAsyncInit = () => {
      window.FB.init({ appId: META_APP_ID, autoLogAppEvents: true, xfbml: false, version: 'v21.0' });
      resolve();
    };
    if (document.getElementById('facebook-jssdk')) return;
    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.src = 'https://connect.facebook.net/pt_BR/sdk.js';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  });
}

export default function WhatsAppConnect() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [conectando, setConectando] = useState(false);
  const dadosSignupRef = useRef<{ waba_id: string; phone_number_id: string } | null>(null);

  const carregarStatus = useCallback(async () => {
    try { setStatus(await adminGetWhatsappStatus()); }
    catch { /* deixa status nulo — card mostra estado neutro */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { carregarStatus(); }, [carregarStatus]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!event.origin.endsWith('facebook.com')) return;
      try {
        const dados = JSON.parse(event.data);
        if (dados.type === 'WA_EMBEDDED_SIGNUP' && dados.event === 'FINISH') {
          dadosSignupRef.current = {
            waba_id: dados.data.waba_id,
            phone_number_id: dados.data.phone_number_id,
          };
        }
      } catch { /* mensagens de outras origens do Facebook não são JSON — ignora */ }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  async function conectar() {
    setConectando(true);
    dadosSignupRef.current = null;
    try {
      await carregarSdkFacebook();
      window.FB.login(
        async (response: any) => {
          if (response.authResponse?.code && dadosSignupRef.current) {
            try {
              const atualizado = await adminConectarWhatsapp(dadosSignupRef.current);
              setStatus(atualizado);
              toast.success('WhatsApp conectado!');
            } catch (err: any) {
              toast.error(err?.response?.data?.message || 'Erro ao salvar a conexão do WhatsApp');
            }
          } else {
            toast.error('Conexão cancelada ou incompleta');
          }
          setConectando(false);
        },
        {
          config_id: META_CONFIG_ID,
          response_type: 'code',
          override_default_response_type: true,
          extras: { setup: {}, sessionInfoVersion: '3' },
        },
      );
    } catch {
      toast.error('Não foi possível carregar o WhatsApp da Meta');
      setConectando(false);
    }
  }

  async function desconectar() {
    if (!confirm('Desconectar o WhatsApp desta loja? As notificações automáticas param de ser enviadas.')) return;
    try {
      const atualizado = await adminDesconectarWhatsapp();
      setStatus(atualizado);
      toast.success('WhatsApp desconectado');
    } catch { toast.error('Erro ao desconectar'); }
  }

  return (
    <div className="card p-5 mb-4 space-y-4">
      <div className="flex items-center gap-2">
        <MessageCircle size={18} className="text-green-600" />
        <h2 className="font-bold text-gray-700">WhatsApp da loja</h2>
      </div>
      <p className="text-xs text-gray-400">
        Conecte o número da sua loja para enviar confirmação de pedido e aviso de entrega automaticamente,
        e para receber mensagens de clientes direto no Chat.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 size={16} className="animate-spin" /> Carregando...
        </div>
      ) : status?.conectado ? (
        <div className="flex items-center justify-between bg-green-50 border border-green-100 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
            <CheckCircle2 size={16} />
            Conectado — {status.numero || 'número verificado'}
          </div>
          <button onClick={desconectar}
            className="flex items-center gap-1.5 text-xs text-red-500 hover:underline font-medium">
            <Unlink size={13} /> Desconectar
          </button>
        </div>
      ) : !status?.integracao_configurada || !SDK_PRONTA ? (
        <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-xs text-gray-500">
          Configuração pendente: peça ao suporte da Peça Já para concluir a integração com a Meta antes de conectar o WhatsApp.
        </div>
      ) : (
        <button onClick={conectar} disabled={conectando}
          className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors">
          {conectando
            ? <Loader2 size={16} className="animate-spin" />
            : <><MessageCircle size={16} /> Conectar WhatsApp</>}
        </button>
      )}
    </div>
  );
}
