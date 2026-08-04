'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { Bike } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function MotoboyLoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro('');
    try {
      const r = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha }),
      });
      if (!r.ok) { setErro('Email ou senha incorretos'); return; }
      const data = await r.json();
      if (data.usuario.papel !== 'motoboy') { setErro('Acesso exclusivo para motoboys'); return; }
      setAuth(data.access_token, data.usuario);
      router.push('/motoboy');
    } catch { setErro('Erro de conexão'); }
    finally { setLoading(false); }
  };

  return (
    <div className="admin-dark min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Bike size={30} className="text-[var(--admin-accent)]" />
          </div>
          <h1 className="text-page-title text-white">Área do Motoboy</h1>
          <p className="text-gray-400 mt-1 text-sm">Entre com suas credenciais</p>
        </div>
        <form onSubmit={handleLogin} className="bg-gray-800 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]"
              placeholder="seu@email.com" />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">Senha</label>
            <input type="password" value={senha} onChange={e => setSenha(e.target.value)} required
              className="w-full rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]"
              placeholder="••••••••" />
          </div>
          {erro && <p className="text-red-400 text-sm">{erro}</p>}
          <button type="submit" disabled={loading}
            className="btn-admin-primary w-full">
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
