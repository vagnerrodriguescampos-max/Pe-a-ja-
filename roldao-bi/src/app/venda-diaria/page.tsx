'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { NoDataGate } from '@/components/layout/NoDataGate';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { TrendLineChart } from '@/components/charts/TrendLineChart';
import { HeatmapGrid, type HeatCell } from '@/components/charts/HeatmapGrid';
import { Skeleton } from '@/components/ui/Skeleton';
import { useFilteredApi } from '@/hooks/useFilteredApi';
import { useApi } from '@/hooks/useApi';
import type { DailyPoint } from '@/lib/query/aggregate';
import type { BiConfig } from '@/lib/store/config';
import { classifyAtingimento, GAUGE_COLOR } from '@/lib/kpi/gauge';
import { formatCompactBRL, formatDateBR, pct } from '@/lib/kpi/format';

interface HeatmapResp { linhas: string[]; colunas: string[]; cells: HeatCell[]; mode: 'pct' | 'raw' }

export default function VendaDiariaPage() {
  return (
    <div>
      <PageHeader title="Venda Diária" description="Evolução dia a dia, calendário de performance e mapa de calor loja x dia." />
      <NoDataGate><Content /></NoDataGate>
    </div>
  );
}

function Content() {
  const { data: dailyData, loading } = useFilteredApi<{ series: DailyPoint[] }>('/api/series/daily');
  const { data: heat } = useFilteredApi<HeatmapResp>('/api/heatmap');
  const { data: configData } = useApi<{ config: BiConfig }>('/api/config');
  const cfg = configData?.config;
  const series = dailyData?.series ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Venda por Dia — Atual, Orçamento e Ano Anterior</CardTitle></CardHeader>
        <CardBody>
          {loading || !series.length ? <Skeleton className="h-80 w-full" /> : <TrendLineChart points={series.map((p) => ({ data: p.data, venda: p.venda, vendaAnoAnterior: p.vendaAnoAnterior, orcamento: p.orcamento }))} height={320} />}
        </CardBody>
      </Card>

      {cfg && series.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Calendário de Performance</CardTitle></CardHeader>
          <CardBody>
            <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-10 lg:grid-cols-14">
              {series.map((p) => {
                const atingimento = p.orcamento ? pct(p.venda, p.orcamento) : null;
                const status = classifyAtingimento(atingimento, cfg);
                const color = status ? GAUGE_COLOR[status] : 'var(--surface-2)';
                return (
                  <div
                    key={p.data}
                    title={`${formatDateBR(p.data)} — Venda: ${formatCompactBRL(p.venda)}${atingimento !== null ? ` — Atingimento: ${atingimento.toFixed(0)}%` : ''}`}
                    className="flex aspect-square flex-col items-center justify-center rounded-md text-[10px] font-semibold text-white"
                    style={{ background: color }}
                  >
                    {p.data.slice(8, 10)}
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Mapa de Calor — Loja x Dia</CardTitle></CardHeader>
        <CardBody>
          {heat?.cells.length ? (
            <HeatmapGrid linhas={heat.linhas} colunas={heat.colunas} cells={heat.cells} mode={heat.mode} formatValue={heat.mode === 'raw' ? (v) => formatCompactBRL(v) : undefined} />
          ) : (
            <p className="text-sm text-base-muted">Sem dados suficientes para montar o mapa de calor com os filtros atuais.</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
