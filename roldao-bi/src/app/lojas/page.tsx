'use client';

import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { NoDataGate } from '@/components/layout/NoDataGate';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { RankingTable } from '@/components/rankings/RankingTable';
import { Matrix2x2 } from '@/components/charts/Matrix2x2';
import { BarComparisonChart } from '@/components/charts/BarComparisonChart';
import { MultiSelect } from '@/components/filters/MultiSelect';
import { Skeleton } from '@/components/ui/Skeleton';
import { useFilteredApi } from '@/hooks/useFilteredApi';
import { useApi } from '@/hooks/useApi';
import { useFiltersStore } from '@/lib/store/filtersStore';
import type { RankingRow } from '@/lib/query/ranking';
import type { BiConfig } from '@/lib/store/config';
import { classifyStoreStatus, STORE_STATUS_META, type StoreStatus } from '@/lib/kpi/storeStatus';
import { formatCompactBRL, formatPercent } from '@/lib/kpi/format';
import { X } from 'lucide-react';

export default function LojasPage() {
  const { filters, updateFilter } = useFiltersStore();

  return (
    <div>
      <PageHeader
        title="Lojas"
        description="Ranking, mapa de performance, matriz de performance e comparação entre lojas."
        actions={filters.regional?.length ? (
          <button onClick={() => updateFilter('regional', undefined)} className="inline-flex items-center gap-1.5 rounded-lg border border-brand-500/40 bg-brand-600/10 px-3 py-1.5 text-xs font-semibold text-brand-400 hover:bg-brand-600/20">
            <X size={13} /> Regional: {filters.regional.join(', ')}
          </button>
        ) : undefined}
      />
      <NoDataGate><Content /></NoDataGate>
    </div>
  );
}

function Content() {
  const { data, loading } = useFilteredApi<{ rows: RankingRow[] }>('/api/rankings', { dim: 'loja_codigo' });
  const { data: configData } = useApi<{ config: BiConfig }>('/api/config');
  const [selectedLoja, setSelectedLoja] = useState<string | null>(null);
  const [compare, setCompare] = useState<string[]>([]);

  const rows = data?.rows ?? [];
  const cfg = configData?.config;

  const withStatus = useMemo(() => cfg ? rows.map((r) => ({ ...r, status: classifyStoreStatus(r, cfg) as StoreStatus })) : [], [rows, cfg]);
  const detail = withStatus.find((r) => r.chave === selectedLoja);
  const comparadas = withStatus.filter((r) => compare.includes(r.chave));

  if (loading || !cfg) return <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-80" /><Skeleton className="h-80" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Matriz de Performance</CardTitle></CardHeader>
          <CardBody>
            {(() => {
              const matrixPoints = rows.filter((r) => r.crescimentoPct !== null && r.atingimentoPct !== null)
                .map((r) => ({ nome: r.nome, crescimento: r.crescimentoPct as number, atingimento: r.atingimentoPct as number, venda: r.venda }));
              if (!matrixPoints.length) {
                return <p className="py-16 text-center text-sm text-base-muted">Sem dados de crescimento vs. ano anterior e orçamento simultaneamente disponíveis para os filtros atuais.</p>;
              }
              return <Matrix2x2 points={matrixPoints} />;
            })()}
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-base-muted">
              <span>🏆 Alta Performance</span><span>🚀 Crescimento</span><span>⚠️ Atenção</span><span>🔴 Crítica</span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Mapa de Performance das Lojas</CardTitle></CardHeader>
          <CardBody>
            <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto scrollbar-thin sm:grid-cols-3">
              {withStatus.map((r) => (
                <button
                  key={r.chave}
                  onClick={() => setSelectedLoja(r.chave === selectedLoja ? null : r.chave)}
                  className="flex flex-col items-start gap-0.5 rounded-lg border px-2.5 py-2 text-left transition-transform hover:-translate-y-0.5"
                  style={{ borderColor: `${STORE_STATUS_META[r.status].color}55`, background: `${STORE_STATUS_META[r.status].color}14` }}
                >
                  <span className="text-xs">{STORE_STATUS_META[r.status].icon} <span className="font-semibold text-base-text">{r.nome}</span></span>
                  <span className="text-[11px] text-base-muted">{formatCompactBRL(r.venda)} {r.atingimentoPct !== null && `· ${formatPercent(r.atingimentoPct, 0)}`}</span>
                </button>
              ))}
            </div>
            {detail && (
              <div className="mt-3 rounded-lg border border-base-border bg-base-surface2/60 p-3 text-sm">
                <p className="font-semibold text-base-text">{STORE_STATUS_META[detail.status].icon} {detail.nome} · {detail.regional ?? '—'}</p>
                <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-base-muted sm:grid-cols-3">
                  <span>Venda: <b className="text-base-text">{formatCompactBRL(detail.venda)}</b></span>
                  <span>Orçamento: <b className="text-base-text">{detail.orcamento !== null ? formatCompactBRL(detail.orcamento) : '—'}</b></span>
                  <span>Atingimento: <b className="text-base-text">{detail.atingimentoPct !== null ? formatPercent(detail.atingimentoPct) : '—'}</b></span>
                  <span>Crescimento: <b className="text-base-text">{detail.crescimentoPct !== null ? formatPercent(detail.crescimentoPct) : '—'}</b></span>
                  <span>Margem %: <b className="text-base-text">{detail.margemPct !== null ? formatPercent(detail.margemPct) : '—'}</b></span>
                  <span>Participação: <b className="text-base-text">{detail.participacaoPct !== null ? formatPercent(detail.participacaoPct) : '—'}</b></span>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Comparar Lojas (até 5)</CardTitle></CardHeader>
        <CardBody>
          <MultiSelect
            label="Selecione as lojas"
            options={rows.map((r) => ({ value: r.chave, label: r.nome }))}
            selected={compare}
            onChange={(v) => setCompare(v.slice(0, 5))}
          />
          {comparadas.length > 0 && (
            <div className="mt-4 space-y-4">
              <BarComparisonChart points={comparadas.map((r) => ({ nome: r.nome, venda: r.venda, orcamento: r.orcamento ?? undefined }))} height={260} />
              <RankingTable rows={comparadas} nomeLabel="Loja" showRegional />
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Ranking Completo de Lojas</CardTitle></CardHeader>
        <CardBody>
          <RankingTable rows={rows} nomeLabel="Loja" showRegional onRowClick={(r) => setSelectedLoja(r.chave === selectedLoja ? null : r.chave)} />
        </CardBody>
      </Card>
    </div>
  );
}
