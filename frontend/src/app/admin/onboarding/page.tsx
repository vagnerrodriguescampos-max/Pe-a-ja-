'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { adminGetLoja, adminUpdateLoja, adminCriarCategoria, adminCriarProduto } from '@/lib/api';
import { Loja } from '@/types';
import ImageUpload from '@/components/ImageUpload';
import { ArrowRight, Check, Copy, MessageCircle, Rocket, SkipForward, Store, UtensilsCrossed, PartyPopper } from 'lucide-react';
import toast from 'react-hot-toast';

const PASSOS = ['Sua loja', 'Primeiro produto', 'Pronto!'];
const NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');

export default function OnboardingPage() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();

  const [passo, setPasso] = useState(0);
  const [loja, setLoja] = useState<Loja | null>(null);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [nome, setNome] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [produtoNome, setProdutoNome] = useState('');
  const [produtoPreco, setProdutoPreco] = useState('');
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/admin/login'); return; }
    adminGetLoja().then(l => {
      setLoja(l);
      setNome(l.nome);
      setLogoUrl(l.logo_url || '');
      if (l.onboarding_concluido) router.replace('/admin/pedidos');
    }).finally(() => setLoading(false));
  }, []);

  async function concluirPasso1() {
    if (!nome.trim()) { toast.error('Informe o nome da loja'); return; }
    setSalvando(true);
    try {
      await adminUpdateLoja({ nome: nome.trim(), logo_url: logoUrl || undefined });
      setPasso(1);
    } catch { toast.error('Erro ao salvar'); }
    finally { setSalvando(false); }
  }

  async function concluirPasso2() {
    if (!produtoNome.trim() || !produtoPreco) { toast.error('Preencha nome e preço do produto'); return; }
    setSalvando(true);
    try {
      const categoria = await adminCriarCategoria({ nome: 'Cardápio' });
      await adminCriarProduto({
        categoria_id: categoria.id,
        nome: produtoNome.trim(),
        preco: parseFloat(produtoPreco),
      });
      setPasso(2);
    } catch { toast.error('Erro ao criar produto'); }
    finally { setSalvando(false); }
  }

  async function pular() {
    setPasso(p => Math.min(p + 1, 2));
  }

  async function finalizar() {
    setSalvando(true);
    try {
      await adminUpdateLoja({ onboarding_concluido: true });
      router.push('/admin/pedidos');
    } catch { toast.error('Erro ao concluir'); }
    finally { setSalvando(false); }
  }

  const linkLoja = loja ? `${NEXT_PUBLIC_APP_URL}/loja/${loja.slug}` : '';

  function copiarLink() {
    navigator.clipboard.writeText(linkLoja);
    setCopiado(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopiado(false), 2000);
  }

  if (loading || !loja) return (
    <div className="admin-dark min-h-screen bg-[#0d0b09] flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-4 border-white/10 border-t-[var(--admin-accent)] rounded-full" />
    </div>
  );

  return (
    <div className="admin-dark min-h-screen bg-[#0d0b09] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">

        {/* Progresso */}
        <div className="flex items-center gap-2 mb-8 px-2">
          {PASSOS.map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                i < passo ? 'bg-green-500 text-white' : i === passo ? 'bg-[var(--admin-accent)] text-white' : 'bg-white/10 text-gray-500'
              }`}>
                {i < passo ? <Check size={14} /> : i + 1}
              </div>
              <span className={`text-xs hidden sm:block ${i === passo ? 'text-white font-medium' : 'text-gray-500'}`}>{label}</span>
              {i < PASSOS.length - 1 && <div className={`flex-1 h-0.5 ${i < passo ? 'bg-green-500' : 'bg-white/10'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-[#17140e] border border-white/8 rounded-3xl p-8">

          {passo === 0 && (
            <>
              <div className="w-12 h-12 rounded-2xl bg-[var(--admin-accent-soft)] flex items-center justify-center mb-3">
                <Store size={22} className="text-[var(--admin-accent)]" />
              </div>
              <h1 className="text-xl font-bold text-white mb-1">Vamos deixar sua loja com a sua cara</h1>
              <p className="text-sm text-gray-400 mb-6">Confirme o nome e adicione sua logo — leva menos de 1 minuto.</p>

              <label className="block text-sm font-medium text-gray-300 mb-1.5">Nome da loja</label>
              <input value={nome} onChange={e => setNome(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm bg-[#201d16] border border-white/10 text-gray-100 outline-none focus:border-[var(--admin-accent-border)] mb-5" />

              <ImageUpload label="Logo (opcional)" value={logoUrl} onChange={setLogoUrl} previewSize={72} />

              <button onClick={concluirPasso1} disabled={salvando}
                className="w-full mt-6 btn-admin-primary flex items-center justify-center gap-2">
                {salvando ? 'Salvando...' : <>Continuar <ArrowRight size={16} /></>}
              </button>
            </>
          )}

          {passo === 1 && (
            <>
              <div className="w-12 h-12 rounded-2xl bg-[var(--admin-accent-soft)] flex items-center justify-center mb-3">
                <UtensilsCrossed size={22} className="text-[var(--admin-accent)]" />
              </div>
              <h1 className="text-xl font-bold text-white mb-1">Cadastre seu primeiro produto</h1>
              <p className="text-sm text-gray-400 mb-6">Só pra você ver o cardápio ganhando vida — dá pra editar tudo depois.</p>

              <label className="block text-sm font-medium text-gray-300 mb-1.5">Nome do produto</label>
              <input value={produtoNome} onChange={e => setProdutoNome(e.target.value)}
                placeholder="Ex: Pizza Calabresa"
                className="w-full px-4 py-3 rounded-xl text-sm bg-[#201d16] border border-white/10 text-gray-100 outline-none focus:border-[var(--admin-accent-border)] mb-4" />

              <label className="block text-sm font-medium text-gray-300 mb-1.5">Preço (R$)</label>
              <input value={produtoPreco} onChange={e => setProdutoPreco(e.target.value)}
                type="number" min="0" step="0.01" placeholder="39.90"
                className="w-full px-4 py-3 rounded-xl text-sm bg-[#201d16] border border-white/10 text-gray-100 outline-none focus:border-[var(--admin-accent-border)]" />

              <div className="flex gap-2 mt-6">
                <button onClick={pular}
                  className="px-4 py-3.5 rounded-xl text-sm text-gray-400 hover:text-white flex items-center gap-1.5 transition-colors">
                  <SkipForward size={15} /> Pular
                </button>
                <button onClick={concluirPasso2} disabled={salvando}
                  className="flex-1 btn-admin-primary flex items-center justify-center gap-2">
                  {salvando ? 'Criando...' : <>Continuar <ArrowRight size={16} /></>}
                </button>
              </div>
            </>
          )}

          {passo === 2 && (
            <>
              <div className="w-12 h-12 rounded-2xl bg-[var(--admin-accent-soft)] flex items-center justify-center mb-3">
                <PartyPopper size={22} className="text-[var(--admin-accent)]" />
              </div>
              <h1 className="text-xl font-bold text-white mb-1">Seu link está pronto!</h1>
              <p className="text-sm text-gray-400 mb-6">Compartilhe com seus clientes agora mesmo — os pedidos já podem começar a chegar.</p>

              <div className="flex items-center gap-2 bg-[#201d16] border border-white/10 rounded-xl px-4 py-3 mb-4">
                <Store size={15} className="text-[var(--admin-accent)] flex-shrink-0" />
                <span className="text-sm text-gray-200 font-mono truncate flex-1">{linkLoja}</span>
                <button onClick={copiarLink} className="text-[var(--admin-accent)] hover:text-[var(--admin-accent-hover)] flex-shrink-0">
                  {copiado ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>

              <a href={`https://wa.me/?text=${encodeURIComponent(`Peça pelo nosso cardápio online: ${linkLoja}`)}`}
                target="_blank" rel="noopener noreferrer"
                className="w-full mb-3 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors">
                <MessageCircle size={16} /> Compartilhar no WhatsApp
              </a>

              <button onClick={finalizar} disabled={salvando}
                className="w-full btn-admin-primary flex items-center justify-center gap-2">
                {salvando ? 'Um instante...' : <>Ir para o painel <Rocket size={16} /></>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
