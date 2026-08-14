'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu, Moon, RefreshCw, Sun, Upload, Download, Activity } from 'lucide-react';
import { useTheme } from '../theme/ThemeProvider';
import { useApi } from '@/hooks/useApi';
import { formatDateBR } from '@/lib/kpi/format';
import type { ImportRecord, DimensionOptions, GlobalFilters } from '@/lib/types';
import type { BiConfig } from '@/lib/store/config';

interface MetaResponse { record: ImportRecord | null; options: DimensionOptions; config: BiConfig }

export function Header({ onMenu }: { onMenu: () => void }) {
  const { theme, toggle } = useTheme();
  const router = useRouter();
  const { data } = useApi<MetaResponse>('/api/meta');

  const importadoEm = data?.record ? new Date(data.record.importedAt) : null;

  return (
    <header className="sticky top-0 z-30 flex flex-col gap-3 border-b border-base-border bg-base-surface/85 px-4 py-3 backdrop-blur lg:flex-row lg:items-center lg:justify-between lg:px-6">
      <div className="flex items-center gap-3">
        <button onClick={onMenu} className="rounded-lg border border-base-border p-2 text-base-muted hover:bg-base-surface2 lg:hidden">
          <Menu size={18} />
        </button>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-800 text-white shadow-glow">
          <Activity size={18} />
        </div>
        <div>
          <p className="text-sm font-bold leading-tight tracking-wide text-base-text">ROLDÃO ATACADISTA</p>
          <p className="text-[11px] font-medium uppercase tracking-widest text-base-muted">BI de Performance Comercial</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-base-muted lg:ml-4">
        <div>
          <span className="block text-[10px] uppercase tracking-wide">Última atualização</span>
          <span className="font-semibold text-base-text">{importadoEm ? importadoEm.toLocaleString('pt-BR') : 'Nenhuma base importada'}</span>
        </div>
        <div>
          <span className="block text-[10px] uppercase tracking-wide">Período analisado</span>
          <span className="font-semibold text-base-text">
            {data?.record?.periodoInicio ? `${formatDateBR(data.record.periodoInicio)} – ${formatDateBR(data.record.periodoFim)}` : '—'}
          </span>
        </div>
        <div>
          <span className="block text-[10px] uppercase tracking-wide">Usuário</span>
          <span className="font-semibold text-base-text">{data?.config.usuarioLogado ?? '—'}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link href="/importar" className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-700">
          <Upload size={14} /> Importar planilha
        </Link>
        <button onClick={() => router.refresh()} className="inline-flex items-center gap-1.5 rounded-lg border border-base-border px-3 py-1.5 text-xs font-semibold text-base-text hover:bg-base-surface2">
          <RefreshCw size={14} /> Atualizar
        </button>
        <a href="/api/export/csv?dim=loja_codigo" className="inline-flex items-center gap-1.5 rounded-lg border border-base-border px-3 py-1.5 text-xs font-semibold text-base-text hover:bg-base-surface2">
          <Download size={14} /> Exportar
        </a>
        <button onClick={toggle} className="rounded-lg border border-base-border p-2 text-base-muted hover:bg-base-surface2" title="Alternar tema">
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  );
}
