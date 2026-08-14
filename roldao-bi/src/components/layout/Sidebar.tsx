'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import {
  LayoutDashboard, BarChart3, Target, Building2, Store, Package, TrendingUp, Search,
  Globe, CalendarDays, LineChart, Siren, Lightbulb, Upload, Settings, ShieldCheck, Gauge,
} from 'lucide-react';

const NAV = [
  { href: '/', label: 'Visão Executiva', icon: LayoutDashboard },
  { href: '/vendas', label: 'Vendas', icon: BarChart3 },
  { href: '/orcamento', label: 'Orçamento', icon: Target },
  { href: '/regionais', label: 'Regionais', icon: Building2 },
  { href: '/lojas', label: 'Lojas', icon: Store },
  { href: '/categorias', label: 'Categorias', icon: Package },
  { href: '/segmentos', label: 'Segmentos', icon: TrendingUp },
  { href: '/subcategorias', label: 'Subcategorias', icon: Search },
  { href: '/canais', label: 'Canais', icon: Globe },
  { href: '/piso', label: 'Piso / Meta', icon: Gauge },
  { href: '/venda-diaria', label: 'Venda Diária', icon: CalendarDays },
  { href: '/acumulado', label: 'Acumulado', icon: LineChart },
  { href: '/alertas', label: 'Alertas', icon: Siren },
  { href: '/oportunidades', label: 'Oportunidades', icon: Lightbulb },
  { href: '/importar', label: 'Importar Base', icon: Upload },
  { href: '/qualidade', label: 'Qualidade dos Dados', icon: ShieldCheck },
  { href: '/configuracoes', label: 'Configurações', icon: Settings },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex h-full flex-col gap-0.5 overflow-y-auto scrollbar-thin px-3 py-4">
      {NAV.map((item) => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={clsx(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-brand-600/15 text-brand-400 shadow-[inset_0_0_0_1px_rgba(31,116,245,0.25)]'
                : 'text-base-muted hover:bg-base-surface2 hover:text-base-text'
            )}
          >
            <Icon size={17} strokeWidth={2} className="shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
