'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { CheckCircle, XCircle, Loader2, Store, Link2, User, Mail, Lock, Eye, EyeOff, ArrowRight, ChevronLeft } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function gerarSlug(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

type SlugStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

export default function CadastrarPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();

  const [nomeLoja, setNomeLoja] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEditado, setSlugEditado] = useState(false);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle');
  const [nomeAdmin, setNomeAdmin] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const checkTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-gera slug a partir do nome
  useEffect(() => {
    if (!slugEditado && nomeLoja) {
      setSlug(gerarSlug(nomeLoja));
    }
  }, [nomeLoja, slugEditado]);

  // Verifica disponibilidade do slug com debounce
  useEffect(() => {
    if (!slug || slug.length < 3) { setSlugStatus(slug.length > 0 && slug.length < 3 ? 'invalid' : 'idle'); return; }
    if (!/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug)) { setSlugStatus('invalid'); return; }

    setSlugStatus('checking');
    if (checkTimeout.current) clearTimeout(checkTimeout.current);
    checkTimeout.current = setTimeout(async () => {
      try {
        const r = await fetch(`${API}/auth/verificar-slug/${slug}`);
        const data = await r.json();
        setSlugStatus(data.disponivel ? 'available' : 'taken');
      } catch { setSlugStatus('idle'); }
    }, 500);
  }, [slug]);

  const handleSlugChange = (val: string) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').slice(0, 50);
    setSlug(clean);
    setSlugEditado(true);
  };

  const podeCadastrar =
    nomeLoja.trim() &&
    slugStatus === 'available' &&
    nomeAdmin.trim() &&
    email.trim() &&
    senha.length >= 6 &&
    senha === confirmarSenha;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!podeCadastrar) return;
    setLoading(true);
    setErro('');
    try {
      const r = await fetch(`${API}/auth/registrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome_loja: nomeLoja.trim(), slug, nome_admin: nomeAdmin.trim(), email: email.trim(), senha }),
      });
      const data = await r.json();
      if (!r.ok) { setErro(data.message || 'Erro ao cadastrar'); return; }
      setAuth(data.access_token, data.usuario);
      router.push('/admin/onboarding');
    } catch { setErro('Erro de conexão'); }
    finally { setLoading(false); }
  };

  const SlugIcon = () => {
    if (slugStatus === 'checking') return <Loader2 size={16} className="text-gray-400 animate-spin" />;
    if (slugStatus === 'available') return <CheckCircle size={16} className="text-green-500" />;
    if (slugStatus === 'taken') return <XCircle size={16} className="text-red-500" />;
    if (slugStatus === 'invalid') return <XCircle size={16} className="text-red-500" />;
    return null;
  };

  const slugMsg = {
    checking: 'Verificando disponibilidade...',
    available: 'Link disponível!',
    taken: 'Este link já está em uso. Escolha outro.',
    invalid: 'Use apenas letras minúsculas, números e hífens (mín. 3 caracteres)',
    idle: '',
  }[slugStatus];

  return (
    <div className="admin-dark min-h-screen bg-[#17150f] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mb-6">
            <ChevronLeft size={14} /> Voltar
          </Link>
          <div className="text-4xl mb-3">🛍️</div>
          <h1 className="text-2xl font-bold text-gray-900">Cadastre seu restaurante</h1>
          <p className="text-gray-500 mt-1 text-sm">Crie sua loja e comece a receber pedidos em minutos</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-lg p-8 space-y-5">

          {/* Nome do restaurante */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              <span className="flex items-center gap-1.5"><Store size={14} /> Nome do restaurante</span>
            </label>
            <input
              value={nomeLoja}
              onChange={e => setNomeLoja(e.target.value)}
              placeholder="Ex: Pizza do Zé, Burguer House..."
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 transition"
            />
          </div>

          {/* Slug / Link */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              <span className="flex items-center gap-1.5"><Link2 size={14} /> Link do cardápio</span>
            </label>

            {/* Preview URL */}
            <div className="flex items-center gap-0 mb-2 bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
              <span className="text-xs text-gray-400 px-3 py-3 border-r border-gray-200 whitespace-nowrap bg-gray-100 font-mono">
                eupedi.com/loja/
              </span>
              <input
                value={slug}
                onChange={e => handleSlugChange(e.target.value)}
                placeholder="seu-restaurante"
                required
                className="flex-1 px-3 py-3 text-sm font-mono bg-gray-50 focus:outline-none focus:bg-white transition"
              />
              <span className="pr-3"><SlugIcon /></span>
            </div>

            {slugMsg && (
              <p className={`text-xs mt-1 ${
                slugStatus === 'available' ? 'text-green-600' :
                slugStatus === 'taken' || slugStatus === 'invalid' ? 'text-red-500' : 'text-gray-400'
              }`}>
                {slugMsg}
              </p>
            )}
          </div>

          <hr className="border-gray-100" />

          {/* Nome do responsável */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              <span className="flex items-center gap-1.5"><User size={14} /> Seu nome</span>
            </label>
            <input
              value={nomeAdmin}
              onChange={e => setNomeAdmin(e.target.value)}
              placeholder="Nome do responsável"
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 transition"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              <span className="flex items-center gap-1.5"><Mail size={14} /> E-mail</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="voce@email.com"
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 transition"
            />
          </div>

          {/* Senha */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              <span className="flex items-center gap-1.5"><Lock size={14} /> Senha</span>
            </label>
            <div className="relative">
              <input
                type={mostrarSenha ? 'text' : 'password'}
                value={senha}
                onChange={e => setSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 transition"
              />
              <button type="button" onClick={() => setMostrarSenha(!mostrarSenha)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {mostrarSenha ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirmar senha */}
          <div>
            <label className="block text-sm font-semibond text-gray-700 mb-1.5 text-sm font-semibold">Confirmar senha</label>
            <input
              type={mostrarSenha ? 'text' : 'password'}
              value={confirmarSenha}
              onChange={e => setConfirmarSenha(e.target.value)}
              placeholder="Repita a senha"
              required
              className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 transition ${
                confirmarSenha && confirmarSenha !== senha
                  ? 'border-red-300 focus:ring-red-300'
                  : 'border-gray-200 focus:ring-red-400'
              }`}
            />
            {confirmarSenha && confirmarSenha !== senha && (
              <p className="text-xs text-red-500 mt-1">As senhas não coincidem</p>
            )}
          </div>

          {erro && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
              {erro}
            </div>
          )}

          <button
            type="submit"
            disabled={!podeCadastrar || loading}
            className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors text-sm">
            {loading
              ? <><Loader2 size={18} className="animate-spin" /> Criando sua loja...</>
              : <><ArrowRight size={18} /> Criar minha loja grátis</>
            }
          </button>

          <p className="text-center text-xs text-gray-400">
            Já tem uma conta?{' '}
            <Link href="/admin/login" className="text-red-500 font-medium hover:underline">Entrar</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
