'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminLogin } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import toast from 'react-hot-toast';
import { UtensilsCrossed } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setAuth } = useAuthStore();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await adminLogin(email, senha);
      setAuth(data.access_token, data.usuario);
      router.push('/admin/pedidos');
    } catch {
      toast.error('Email ou senha incorretos');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-dark min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[var(--admin-accent)]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <UtensilsCrossed className="w-8 h-8 text-[var(--admin-accent)]" />
          </div>
          <h1 className="text-page-title text-gray-900">Painel Admin</h1>
          <p className="text-caption text-gray-400 mt-1">Entre para gerenciar seu delivery</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="admin@seunegocio.com" className="input" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <input type="password" value={senha} onChange={e => setSenha(e.target.value)}
              placeholder="••••••••" className="input" required />
          </div>
          <button type="submit" disabled={loading}
            className="btn-admin-primary w-full mt-2 py-3.5">
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
            ) : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
