'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { NoDataGate } from '@/components/layout/NoDataGate';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { RankingTable } from '@/components/rankings/RankingTable';
import { Skeleton } from '@/components/ui/Skeleton';
import { useFilteredApi } from '@/hooks/useFilteredApi';
import type { RankingRow } from '@/lib/query/ranking';
import { formatCompactBRL, formatPercent } from '@/lib/kpi/format';

export default function SubcategoriasPage() {
  return (
    <div>
      <PageHeader title="Análise por Subcategoria" description="Ranking completo, maiores crescimentos e maiores quedas vs ano anterior." />
      <NoDataGate><Content /></NoDataGate>
    </div>
  );
}

function Content() {
  const { data, loading } = useFilteredApi<{ rows: RankingRow[] }>('/api/rankings', { dim: 'subcategoria' });
  const rows = data?.rows ?? [];
  const comCrescimento = rows.filter((r) => r.crescimentoPct !== null);
  const top10Crescimento = [...comCrescimento].sort((a, b) => (b.crescimentoPct as number) - (a.crescimentoPct as number)).slice(0, 10);
  const top10Queda = [...comCrescimento].sort((a, b) => (a.crescimentoPct as number) - (b.crescimentoPct as number)).slice(0, 10);

  if (loading) return <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-80" /><Skeleton className="h-80" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>🚀 Top 10 Maiores Crescimentos</CardTitle></CardHeader>
          <CardBody className="space-y-1.5">
            {top10Crescimento.map((r) => (
              <div key={r.chave} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-base-surface2/60">
                <span className="truncate text-sm font-medium">{r.nome}</span>
                <span className="flex items-center gap-2 text-sm tabular-nums">
                  <span className="text-base-muted">{formatCompactBRL(r.venda)}</span>
                  <span className="font-semibold text-good">{formatPercent(r.crescimentoPct as number)}</span>
                </span>
              </div>
            ))}
            {!top10Crescimento.length && <p className="text-sm text-base-muted">Sem dados de ano anterior para comparação.</p>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader><CardTitle>📉 Top 10 Maiores Quedas</CardTitle></CardHeader>
          <CardBody className="space-y-1.5">
            {top10Queda.map((r) => (
              <div key={r.chave} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-base-surface2/60">
                <span className="truncate text-sm font-medium">{r.nome}</span>
                <span className="flex items-center gap-2 text-sm tabular-nums">
                  <span className="text-base-muted">{formatCompactBRL(r.venda)}</span>
                  <span className="font-semibold text-bad">{formatPercent(r.crescimentoPct as number)}</span>
                </span>
              </div>
            ))}
            {!top10Queda.length && <p className="text-sm text-base-muted">Sem dados de ano anterior para comparação.</p>}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Ranking Completo de Subcategorias</CardTitle></CardHeader>
        <CardBody>
          <RankingTable rows={rows} nomeLabel="Subcategoria" showRegional={false} />
        </CardBody>
      </Card>
    </div>
  );
}
