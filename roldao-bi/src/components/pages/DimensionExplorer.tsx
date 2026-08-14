'use client';

import { PageHeader } from '../layout/PageHeader';
import { NoDataGate } from '../layout/NoDataGate';
import { Card, CardBody, CardHeader, CardTitle } from '../ui/Card';
import { RankingTable } from '../rankings/RankingTable';
import { ParticipationChart } from '../charts/ParticipationChart';
import { BarComparisonChart } from '../charts/BarComparisonChart';
import { Skeleton } from '../ui/Skeleton';
import { useFilteredApi } from '@/hooks/useFilteredApi';
import { useFiltersStore } from '@/lib/store/filtersStore';
import type { RankingRow, RankingDim } from '@/lib/query/ranking';
import { ArrowRight, X } from 'lucide-react';
import Link from 'next/link';

export type ArrayFilterKey = 'loja' | 'regional' | 'empresa' | 'categoria' | 'segmento' | 'subcategoria' | 'canal';

export function DimensionExplorer({
  dim, filterKey, title, description, nomeLabel, showRegional, showLojas, drillNextHref, drillNextLabel,
}: {
  dim: RankingDim;
  filterKey: ArrayFilterKey;
  title: string;
  description: string;
  nomeLabel: string;
  showRegional?: boolean;
  showLojas?: boolean;
  drillNextHref?: string;
  drillNextLabel?: string;
}) {
  const { filters, updateFilter } = useFiltersStore();
  const active = filters[filterKey] ?? [];

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={active.length > 0 ? (
          <div className="flex items-center gap-2">
            {drillNextHref && (
              <Link href={drillNextHref} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">
                {drillNextLabel ?? 'Ver detalhe'} <ArrowRight size={13} />
              </Link>
            )}
            <button onClick={() => updateFilter(filterKey, undefined)} className="inline-flex items-center gap-1.5 rounded-lg border border-brand-500/40 bg-brand-600/10 px-3 py-1.5 text-xs font-semibold text-brand-400 hover:bg-brand-600/20">
              <X size={13} /> {active.join(', ')} — remover drill-down
            </button>
          </div>
        ) : undefined}
      />
      <NoDataGate>
        <Content dim={dim} filterKey={filterKey} nomeLabel={nomeLabel} showRegional={showRegional} showLojas={showLojas} />
      </NoDataGate>
    </div>
  );
}

function Content({ dim, filterKey, nomeLabel, showRegional, showLojas }: {
  dim: RankingDim; filterKey: ArrayFilterKey; nomeLabel: string; showRegional?: boolean; showLojas?: boolean;
}) {
  const { data, loading } = useFilteredApi<{ rows: RankingRow[] }>('/api/rankings', { dim });
  const { updateFilter, filters } = useFiltersStore();
  const rows = data?.rows ?? [];
  const top10 = rows.slice(0, 10);

  function drill(row: RankingRow) {
    updateFilter(filterKey, [row.chave]);
  }

  if (loading) return <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-80" /><Skeleton className="h-80" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Venda x Orçamento (Top 10)</CardTitle></CardHeader>
          <CardBody>
            <BarComparisonChart points={top10.map((r) => ({ nome: r.nome, venda: r.venda, orcamento: r.orcamento ?? undefined }))} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>Participação no Faturamento Total</CardTitle></CardHeader>
          <CardBody>
            <ParticipationChart data={top10.map((r) => ({ nome: r.nome, venda: r.venda }))} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Ranking Completo</CardTitle></CardHeader>
        <CardBody>
          <RankingTable rows={rows} nomeLabel={nomeLabel} onRowClick={!filters[filterKey]?.length ? drill : undefined} showRegional={showRegional} showLojas={showLojas} />
          {!filters[filterKey]?.length && <p className="mt-2 text-xs text-base-muted">Clique em uma linha para aplicar o drill-down (filtro global).</p>}
        </CardBody>
      </Card>
    </div>
  );
}
