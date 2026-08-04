'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getLoja, criarPedido } from '@/lib/api';
import { Loja, FormaPagamento, TipoPedido } from '@/types';
import { useCarrinhoStore } from '@/stores/carrinho.store';
import { formatCurrency, PAGAMENTO_LABELS } from '@/lib/utils';
import { ArrowLeft, MapPin, User, CreditCard, QrCode, ChevronRight, Wallet, Star, Bike, Footprints, Landmark, Banknote, type LucideIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function CheckoutPage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();

  const [loja, setLoja] = useState<Loja | null>(null);
  const [loading, setLoading] = useState(false);
  const [tipo, setTipo] = useState<TipoPedido>('entrega');
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>('pix');
  const [trocoPara, setTrocoPara] = useState('');

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [referencia, setReferencia] = useState('');

  const [saldoCarteira, setSaldoCarteira] = useState(0);
  const [selosInfo, setSelosInfo] = useState<{ atuais: number; meta: number } | null>(null);
  const [usarCarteira, setUsarCarteira] = useState(false);

  const { itens, subtotal, limpar, lojaId } = useCarrinhoStore();
  const sub = subtotal();
  const taxaEntrega = tipo === 'entrega' ? Number(loja?.taxa_entrega_padrao || 0) : 0;
  const descontoCarteira = usarCarteira ? Math.min(saldoCarteira, sub + taxaEntrega) : 0;
  const total = sub + taxaEntrega - descontoCarteira;

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const buscarFidelizacao = async (tel: string, nm: string) => {
    const t = tel.replace(/\D/g, '');
    if (t.length < 10 || !lojaId) return;
    try {
      const r = await fetch(`${API}/loja/${slug}/chat/identificar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nm || 'Cliente', telefone: t }),
      });
      if (!r.ok) return;
      const { cliente, conversa, chat_token } = await r.json();
      if (!chat_token) return;

      // This capability is also used by the chat widget. It proves possession
      // of this browser session instead of exposing loyalty data by customer ID.
      localStorage.setItem(`chat_${slug}`, JSON.stringify({
        clienteId: cliente.id,
        conversaId: conversa.id,
        nome: nm || 'Cliente',
        telefone: t,
        chatToken: chat_token,
      }));
      const r2 = await fetch(`${API}/loja/${slug}/fidelizacao/cliente/${cliente.id}`, {
        headers: { 'X-Chat-Token': chat_token },
      });
      if (r2.ok) {
        const data = await r2.json();
        setSaldoCarteira(Number(data.carteira.saldo));
        setSelosInfo({ atuais: data.selos.atuais, meta: data.selos.meta });
      }
    } catch {}
  };

  useEffect(() => {
    getLoja(slug).then(setLoja).catch(() => router.push('/'));
    const dadosSalvos = localStorage.getItem('cliente_dados');
    if (dadosSalvos) {
      const d = JSON.parse(dadosSalvos);
      setNome(d.nome || '');
      setTelefone(d.telefone || '');
      if (d.telefone) buscarFidelizacao(d.telefone, d.nome);
    }
  }, [slug]);

  useEffect(() => {
    if (loja) document.documentElement.style.setProperty('--color-primary', loja.cor_primaria);
  }, [loja]);

  if (itens.length === 0) {
    router.replace(`/loja/${slug}`);
    return null;
  }

  async function handlePedido() {
    if (!nome.trim() || !telefone.trim()) {
      toast.error('Informe seu nome e telefone');
      return;
    }
    if (tipo === 'entrega' && (!rua.trim() || !numero.trim() || !bairro.trim() || !cidade.trim())) {
      toast.error('Informe o endereço de entrega completo');
      return;
    }

    setLoading(true);
    try {
      // Salvar dados do cliente
      localStorage.setItem('cliente_dados', JSON.stringify({ nome, telefone }));

      const body = {
        tipo,
        forma_pagamento: formaPagamento,
        troco_para: formaPagamento === 'dinheiro' && trocoPara ? parseFloat(trocoPara) : null,
        // The server recalculates every amount from the current menu. The
        // browser only submits the customer's choices, never prices or a discount.
        usar_carteira: usarCarteira,
        cliente: { nome, telefone },
        endereco: tipo === 'entrega' ? { rua, numero, complemento, bairro, cidade, referencia } : null,
        itens: itens.map(item => ({
          produto_id: item.produto_id,
          quantidade: item.quantidade,
          observacao: item.observacao,
          opcoes: item.opcoes.map(op => ({ opcao_id: op.opcao_id })),
        })),
      };

      const pedido = await criarPedido(slug, body);
      if (!pedido.token_acesso) throw new Error('Não foi possível criar o acesso seguro ao pedido');
      localStorage.setItem(`pedido_acesso_${pedido.id}`, pedido.token_acesso);
      limpar();
      router.push(`/loja/${slug}/pedido/${pedido.id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao fazer pedido');
    } finally {
      setLoading(false);
    }
  }

  if (!loja) return (
    <div className="min-h-screen bg-[#14110e] flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-4 border-white/10 border-t-[var(--color-primary)] rounded-full" />
    </div>
  );

  const inputCls = "w-full px-4 py-3 rounded-xl text-sm outline-none text-gray-100 bg-[#17140e] border border-white/8 placeholder-gray-600 focus:border-white/20 transition-colors";

  return (
    <div className="admin-dark min-h-screen bg-[#0d0b09] flex justify-center">
      <div className="w-full max-w-[500px] bg-[#14110e] min-h-screen relative">
        {/* Header */}
        <div className="px-4 pt-6 pb-8" style={{ background: `linear-gradient(160deg, ${loja.cor_primaria} 0%, #14110e 130%)` }}>
          <div className="flex items-center gap-3">
            <Link href={`/loja/${slug}`} className="text-white/80 hover:text-white transition-colors">
              <ArrowLeft size={22} />
            </Link>
            <h1 className="text-lg font-bold text-white">Finalizar Pedido</h1>
          </div>
        </div>

        <div className="px-4 pb-32 -mt-3 space-y-4">

          {/* Tipo: entrega ou retirada */}
          <div className="bg-[#201d16] border border-white/5 rounded-2xl p-4">
            <h2 className="font-bold text-white mb-3">Como quer receber?</h2>
            <div className="grid grid-cols-2 gap-3">
              {(['entrega', 'retirada'] as TipoPedido[]).map(t => (
                <button key={t} onClick={() => setTipo(t)}
                  className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                    tipo === t ? '' : 'border-white/8 text-gray-400'
                  }`}
                  style={tipo === t ? { borderColor: loja.cor_primaria, color: loja.cor_primaria } : {}}>
                  <span className="inline-flex items-center gap-1.5">
                    {t === 'entrega' ? <Bike size={16} /> : <Footprints size={16} />}
                    {t === 'entrega' ? 'Entrega' : 'Retirada'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Dados do cliente */}
          <div className="bg-[#201d16] border border-white/5 rounded-2xl p-4 space-y-3">
            <h2 className="font-bold text-white flex items-center gap-2">
              <User size={16} /> Seus dados
            </h2>
            <input value={nome} onChange={e => setNome(e.target.value)}
              placeholder="Seu nome *" className={inputCls} />
            <input value={telefone}
              onChange={e => setTelefone(e.target.value)}
              onBlur={e => buscarFidelizacao(e.target.value, nome)}
              placeholder="WhatsApp / Telefone *" className={inputCls} type="tel" />
          </div>

          {/* Endereço (só se entrega) */}
          {tipo === 'entrega' && (
            <div className="bg-[#201d16] border border-white/5 rounded-2xl p-4 space-y-3">
              <h2 className="font-bold text-white flex items-center gap-2">
                <MapPin size={16} /> Endereço de entrega
              </h2>
              <div className="grid grid-cols-3 gap-3">
                <input value={rua} onChange={e => setRua(e.target.value)}
                  placeholder="Rua / Av. *" className={`${inputCls} col-span-2`} />
                <input value={numero} onChange={e => setNumero(e.target.value)}
                  placeholder="Nº *" className={inputCls} />
              </div>
              <input value={complemento} onChange={e => setComplemento(e.target.value)}
                placeholder="Complemento (apto, bloco...)" className={inputCls} />
              <input value={bairro} onChange={e => setBairro(e.target.value)}
                placeholder="Bairro *" className={inputCls} />
              <input value={cidade} onChange={e => setCidade(e.target.value)}
                placeholder="Cidade *" className={inputCls} />
              <input value={referencia} onChange={e => setReferencia(e.target.value)}
                placeholder="Ponto de referência" className={inputCls} />
            </div>
          )}

          {/* Forma de pagamento */}
          <div className="bg-[#201d16] border border-white/5 rounded-2xl p-4">
            <h2 className="font-bold text-white flex items-center gap-2 mb-3">
              <CreditCard size={16} /> Forma de pagamento
            </h2>
            <div className="space-y-2">
              {([
                { key: 'pix', label: 'PIX', icon: Landmark, desc: 'Chave PIX da loja' },
                { key: 'dinheiro', label: 'Dinheiro', icon: Banknote, desc: 'Na entrega / retirada' },
                { key: 'cartao_debito', label: 'Débito', icon: CreditCard, desc: 'Maquininha na entrega' },
                { key: 'cartao_credito', label: 'Crédito', icon: CreditCard, desc: 'Maquininha na entrega' },
              ] as { key: FormaPagamento; label: string; icon: LucideIcon; desc: string }[]).map(op => (
                <button key={op.key} onClick={() => setFormaPagamento(op.key)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border-2 text-left transition-all ${
                    formaPagamento === op.key ? '' : 'border-white/8'
                  }`}
                  style={formaPagamento === op.key ? { borderColor: loja.cor_primaria } : {}}>
                  <div>
                    <p className="text-sm font-medium text-gray-100 flex items-center gap-1.5">
                      <op.icon size={14} /> {op.label}
                    </p>
                    <p className="text-xs text-gray-500">{op.desc}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    formaPagamento === op.key ? '' : 'border-gray-600'
                  }`} style={formaPagamento === op.key ? { borderColor: loja.cor_primaria } : {}}>
                    {formaPagamento === op.key && (
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: loja.cor_primaria }} />
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Troco */}
            {formaPagamento === 'dinheiro' && (
              <div className="mt-3">
                <label className="block text-sm text-gray-400 mb-1">Troco para quanto? (opcional)</label>
                <input value={trocoPara} onChange={e => setTrocoPara(e.target.value)}
                  placeholder="Ex: 50.00" className={inputCls} type="number" min="0" step="0.01" />
              </div>
            )}

            {/* PIX info */}
            {formaPagamento === 'pix' && loja.chave_pix && (
              <div className="mt-3 bg-blue-500/10 rounded-xl p-3 border border-blue-400/20">
                <div className="flex items-center gap-2 mb-1">
                  <QrCode size={16} className="text-blue-400" />
                  <span className="text-sm font-semibold text-blue-300">Chave PIX</span>
                </div>
                <p className="text-sm text-blue-300 font-mono break-all">{loja.chave_pix}</p>
                <p className="text-xs text-blue-400/80 mt-1">
                  Após confirmar o pedido, você verá a chave PIX. Envie o comprovante via WhatsApp.
                </p>
              </div>
            )}
          </div>

          {/* Carteira e selos */}
          {(saldoCarteira > 0 || selosInfo) && (
            <div className="bg-[#201d16] border border-white/5 rounded-2xl p-4 space-y-3">
              {saldoCarteira > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-green-500/15 flex items-center justify-center">
                      <Wallet size={15} className="text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-100">Carteira cashback</p>
                      <p className="text-xs text-green-400 font-semibold">{formatCurrency(saldoCarteira)} disponível</p>
                    </div>
                  </div>
                  <button onClick={() => setUsarCarteira(!usarCarteira)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${usarCarteira ? 'bg-green-500' : 'bg-white/15'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${usarCarteira ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              )}
              {selosInfo && (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-yellow-500/15 flex items-center justify-center">
                    <Star size={15} className="text-yellow-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-100">Cartão fidelidade</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {Array.from({ length: selosInfo.meta }, (_, i) => (
                        <div key={i} className={`w-4 h-4 rounded-full border ${i < selosInfo.atuais ? 'bg-yellow-400 border-yellow-400' : 'bg-white/5 border-white/15'}`} />
                      ))}
                      <span className="text-xs text-gray-500 ml-1">{selosInfo.atuais}/{selosInfo.meta}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Resumo do pedido */}
          <div className="bg-[#201d16] border border-white/5 rounded-2xl p-4">
            <h2 className="font-bold text-white mb-3">Resumo</h2>
            <div className="space-y-1 text-sm">
              {itens.map(item => (
                <div key={item.id} className="flex justify-between text-gray-400">
                  <span>{item.quantidade}x {item.nome_snapshot}</span>
                  <span>{formatCurrency(item.total)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-white/8 mt-3 pt-3 space-y-1 text-sm">
              <div className="flex justify-between text-gray-400">
                <span>Subtotal</span>
                <span>{formatCurrency(sub)}</span>
              </div>
              {tipo === 'entrega' && (
                <div className="flex justify-between text-gray-400">
                  <span>Entrega</span>
                  <span>{taxaEntrega > 0 ? formatCurrency(taxaEntrega) : 'Grátis'}</span>
                </div>
              )}
              {descontoCarteira > 0 && (
                <div className="flex justify-between text-green-400 font-medium">
                  <span>Desconto carteira</span>
                  <span>-{formatCurrency(descontoCarteira)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-white text-base pt-1 border-t border-white/8">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Botão fixo */}
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[500px] bg-[#17140e] border-t border-white/8 px-4 py-4">
          <button onClick={handlePedido} disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-white font-semibold text-sm shadow-lg disabled:opacity-70"
            style={{ backgroundColor: loja.cor_primaria }}>
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Confirmar Pedido</span>
                <ChevronRight size={18} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
