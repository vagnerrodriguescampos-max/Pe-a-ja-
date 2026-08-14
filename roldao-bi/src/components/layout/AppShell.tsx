'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { FilterBar } from '../filters/FilterBar';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-base-bg text-base-text">
      <aside className="hidden w-64 shrink-0 border-r border-base-border bg-base-surface lg:block">
        <div className="flex h-full flex-col">
          <Sidebar />
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-base-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-base-border px-4 py-3">
              <span className="text-sm font-bold">Menu</span>
              <button onClick={() => setMobileOpen(false)}><X size={18} /></button>
            </div>
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Header onMenu={() => setMobileOpen(true)} />
        <FilterBar />
        <main className="flex-1 px-4 py-5 lg:px-6 lg:py-6">{children}</main>
        <footer className="border-t border-base-border px-6 py-3 text-center text-[11px] text-base-muted">
          Roldão Atacadista · BI de Performance Comercial — dados tratados a partir das planilhas importadas, histórico preservado.
        </footer>
      </div>
    </div>
  );
}
