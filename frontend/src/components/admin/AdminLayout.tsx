'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth.store';
import { LayoutGrid, UtensilsCrossed, Settings, LogOut, Menu, X, MessageSquare, BarChart2, Users, Gift, Download, Bell, BellOff, UserCog, HelpCircle } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { usePushNotification } from '@/hooks/usePushNotification';
import { adminGetLoja } from '@/lib/api';
import toast from 'react-hot-toast';

const NAV = [
  { href: '/admin/pedidos', label: 'Pedidos', icon: LayoutGrid },
  { href: '/admin/chat', label: 'Chat', icon: MessageSquare },
  { href: '/admin/dashboard', label: 'Dashboard', icon: BarChart2, adminOnly: true },
  { href: '/admin/clientes', label: 'Clientes', icon: Users },
  { href: '/admin/fidelizacao', label: 'Fidelização', icon: Gift, adminOnly: true },
  { href: '/admin/cardapio', label: 'Cardápio', icon: UtensilsCrossed },
  { href: '/admin/usuarios', label: 'Usuários', icon: UserCog, adminOnly: true },
  { href: '/admin/configuracoes', label: 'Configurações', icon: Settings, adminOnly: true },
  { href: '/admin/ajuda', label: 'Ajuda', icon: HelpCircle },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, logout, usuario } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [menuAberto, setMenuAberto] = useState(false);
  const { canInstall, install } = useInstallPrompt();
  const { permission, subscribed, subscribe } = usePushNotification();

  useEffect(() => {
    if (!isAuthenticated()) router.replace('/admin/login');
  }, []);

  // Leva o dono direto pro assistente de primeiros passos até ele concluir ou pular.
  // Para de checar assim que confirma que já foi concluído, pra não bater na API a cada navegação.
  const onboardingOk = useRef(false);
  useEffect(() => {
    if (!isAuthenticated() || pathname === '/admin/onboarding' || onboardingOk.current) return;
    const ehDono = usuario?.papel === 'admin_loja' || usuario?.papel === 'super_admin';
    if (!ehDono) { onboardingOk.current = true; return; }
    adminGetLoja().then(loja => {
      if (loja.onboarding_concluido) onboardingOk.current = true;
      else router.replace('/admin/onboarding');
    }).catch(() => {});
  }, [pathname]);

  // Auto-subscribe to push after login if permission already granted
  useEffect(() => {
    if (permission === 'granted' && !subscribed) {
      subscribe().catch(() => {});
    }
  }, [permission]);

  const handleEnableNotifications = async () => {
    const ok = await subscribe();
    if (ok) toast.success('Notificações ativadas! Você receberá alertas de novos pedidos.');
    else if (Notification.permission === 'denied') toast.error('Notificações bloqueadas no navegador. Libere nas configurações do site.');
  };

  if (!isAuthenticated()) return null;

  const ehAdmin = usuario?.papel === 'admin_loja' || usuario?.papel === 'super_admin';
  const navItems = NAV.filter(item => !item.adminOnly || ehAdmin);
  const showPushButton = permission !== 'granted' && !subscribed;

  const SidebarExtras = () => (
    <div className="px-3 pb-3 space-y-2">
      {canInstall && (
        <button onClick={install}
          className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors">
          <Download size={14} />
          Instalar app
        </button>
      )}
      {showPushButton && (
        <button onClick={handleEnableNotifications}
          className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-orange-600 bg-orange-50 rounded-xl hover:bg-orange-100 transition-colors">
          <Bell size={14} />
          Ativar notificações
        </button>
      )}
      {subscribed && (
        <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-green-600">
          <Bell size={12} />
          Notificações ativas
        </div>
      )}
    </div>
  );

  return (
    <div className="admin-dark min-h-screen bg-gray-50 flex">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col w-56 bg-white border-r border-gray-100 fixed inset-y-0 left-0 z-30">
        <div className="px-5 py-6 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🥙</span>
            <div>
              <p className="font-bold text-gray-900 text-sm leading-tight">Painel Admin</p>
              <p className="text-xs text-gray-400 truncate">{usuario?.nome}</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                pathname === href ? 'bg-red-50 text-red-600' : 'text-gray-600 hover:bg-gray-50'
              }`}>
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
        <SidebarExtras />
        <div className="px-3 py-4 border-t border-gray-100">
          <button onClick={() => { logout(); router.push('/admin/login'); }}
            className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-500 hover:text-red-600 w-full rounded-xl hover:bg-red-50 transition-colors">
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </aside>

      {/* Header mobile */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🥙</span>
          <p className="font-bold text-gray-900 text-sm">Painel Admin</p>
        </div>
        <div className="flex items-center gap-2">
          {showPushButton && (
            <button onClick={handleEnableNotifications} className="text-orange-500 p-1">
              <Bell size={20} />
            </button>
          )}
          {canInstall && (
            <button onClick={install} className="text-indigo-600 p-1">
              <Download size={20} />
            </button>
          )}
          <button onClick={() => setMenuAberto(!menuAberto)} className="text-gray-600">
            {menuAberto ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Menu mobile */}
      {menuAberto && (
        <div className="md:hidden fixed inset-0 z-30 bg-black/40" onClick={() => setMenuAberto(false)}>
          <div className="bg-white w-64 h-full shadow-xl overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-6 border-b border-gray-100 mt-14">
              <p className="text-sm text-gray-500">{usuario?.nome}</p>
            </div>
            <nav className="px-3 py-4 space-y-1">
              {navItems.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} onClick={() => setMenuAberto(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium ${
                    pathname === href ? 'bg-red-50 text-red-600' : 'text-gray-600'
                  }`}>
                  <Icon size={18} />
                  {label}
                </Link>
              ))}
              <button onClick={() => { logout(); router.push('/admin/login'); }}
                className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-500 w-full">
                <LogOut size={18} />
                Sair
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* Conteúdo */}
      <main className="flex-1 md:ml-56 pt-16 md:pt-0 overflow-auto">
        {children}
      </main>
    </div>
  );
}
