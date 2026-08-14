'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { NoDataGate } from '@/components/layout/NoDataGate';
import { Card, CardBody } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useFilteredApi } from '@/hooks/useFilteredApi';
import type { Alert, AlertSeverity } from '@/lib/kpi/insights';
import clsx from 'clsx';
import { useState } from 'react';

const SEVERITY_META: Record<AlertSeverity, { label: string; border: string; bg: string }> = {
  critico: { label: 'Críticos', border: 'border-bad/40', bg: 'bg-bad/5' },
  atencao: { label: 'Atenção', border: 'border-warn/40', bg: 'bg-warn/5' },
  sucesso: { label: 'Sucessos', border: 'border-good/40', bg: 'bg-good/5' },
  info: { label: 'Informativos', border: 'border-info/40', bg: 'bg-info/5' },
};

export default function AlertasPage() {
  return (
    <div>
      <PageHeader title="Central de Alertas" description="Alertas gerados automaticamente a partir da base importada e dos filtros atuais." />
      <NoDataGate><Content /></NoDataGate>
    </div>
  );
}

function Content() {
  const { data, loading } = useFilteredApi<{ alerts: Alert[] }>('/api/alerts');
  const [filter, setFilter] = useState<AlertSeverity | 'todos'>('todos');
  const alerts = data?.alerts ?? [];
  const filtered = filter === 'todos' ? alerts : alerts.filter((a) => a.severity === filter);

  if (loading) return <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {(['todos', 'critico', 'atencao', 'sucesso'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={clsx('rounded-full border px-3 py-1 text-xs font-medium capitalize', filter === s ? 'border-brand-500 bg-brand-600/15 text-brand-400' : 'border-base-border text-base-muted hover:bg-base-surface2')}
          >
            {s === 'todos' ? `Todos (${alerts.length})` : `${SEVERITY_META[s].label} (${alerts.filter((a) => a.severity === s).length})`}
          </button>
        ))}
      </div>

      <div className="space-y-2.5">
        {filtered.map((a) => (
          <Card key={a.id} className={clsx('border', SEVERITY_META[a.severity].border, SEVERITY_META[a.severity].bg)}>
            <CardBody className="flex items-start gap-3 py-3.5">
              <span className="text-xl leading-none">{a.icon}</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-base-text">{a.title}</p>
                <p className="text-xs text-base-muted">{a.escopo}</p>
                <p className="mt-1 text-sm text-base-text/90">{a.text}</p>
              </div>
            </CardBody>
          </Card>
        ))}
        {!filtered.length && (
          <Card><CardBody className="py-10 text-center text-sm text-base-muted">Nenhum alerta nesta categoria para os filtros atuais.</CardBody></Card>
        )}
      </div>
    </div>
  );
}
