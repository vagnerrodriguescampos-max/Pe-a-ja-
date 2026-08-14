'use client';

import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { NoDataGate } from '@/components/layout/NoDataGate';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { TrendLineChart } from '@/components/charts/TrendLineChart';
import { KpiCard } from '@/components/kpi/KpiCard';
import { useFilteredApi } from '@/hooks/useFilteredApi';
import type { DailyPoint } from '@/lib/query/aggregate';
import type { ExecutiveKpis } from '@/lib/kpi/executive';
import { moneyCard, pctCard, trendFromValue } from '@/lib/kpi/toCard';
import { formatPercent } from '@/lib/kpi/format';
import clsx from 'clsx';
import { Skeleton } from '@/components/ui/Skeleton';

type Granularidade = 'diario' | 'semanal' | 'mensal' | 'acumulado';

function isoWeekKey(iso: string): string {
  const d = new Date(iso);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((target.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${target.getUTCFullYear()}-S${String(week).padStart(2, '0')}`;
}

function regroup(series: DailyPoint[], granularidade: Granularidade): DailyPoint[] {
  if (granularidade === 'diario') return series;
  const keyFn = granularidade === 'semanal' ? isoWeekKey : (iso: string) => iso.slice(0, 7);
  const map = new Map<string, DailyPoint>();
  for (const p of series) {
    const key = keyFn(p.data);
    let g = map.get(key);
    if (!g) { g = { data: key, venda: 0, orcamento: 0, vendaAnoAnterior: 0, clientes: 0 }; map.set(key, g); }
    g.venda += p.venda; g.orcamento += p.orcamento; g.vendaAnoAnterior += p.vendaAnoAnterior; g.clientes += p.clientes;
  }
  return Array.from(map.values()).sort((a, b) => (a.data < b.data ? -1 : 1));
}

export default function VendasPage() {
  return (
    <div>
      <PageHeader title="Vendas" description="Performance comercial: venda x orçamento x ano anterior, evolução e tendência de fechamento." />
      <NoDataGate><Content /></NoDataGate>
    </div>
  );
}

function Content() {
  const [gran, setGran] = useState<Granularidade>('diario');
  const { data: dailyData, loading } = useFilteredApi<{ series: DailyPoint[] }>('/api/series/daily');
  const { data: accData } = useFilteredApi<{ series: DailyPoint[]; ritmo: string | null }>('/api/series/accumulated');
  const { data: kpiData } = useFilteredApi<{ kpis: ExecutiveKpis }>('/api/kpis');

  const points = useMemo(() => {
    const base = gran === 'acumulado' ? accData?.series ?? [] : dailyData?.series ?? [];
    return regroup(base, gran === 'acumulado' ? 'diario' : gran);
  }, [dailyData, accData, gran]);

  const kpis = kpiData?.kpis;

  return (
    <div className="space-y-6">
      {kpis && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard {...moneyCard('Venda x Orçamento', kpis.vendaBruta)} comparativoLabel={kpis.orcamento.value ? `Orçamento: ${formatPercent(kpis.atingimentoPct.value ?? 0)}` : undefined} trend={trendFromValue((kpis.atingimentoPct.value ?? 0) - 100)} />
          <KpiCard {...pctCard('Crescimento Nominal vs A.A.', kpis.crescimentoPct)} trend={trendFromValue(kpis.crescimentoPct.value)} tooltip="(Venda Atual - Venda Anterior) / Venda Anterior" />
          <KpiCard {...pctCard('Margem x Ano Anterior', kpis.diferencaMargemVsAnoAnterior)} trend={trendFromValue(kpis.diferencaMargemVsAnoAnterior.value)} tooltip="Diferença em pontos percentuais de margem vs ano anterior" />
          <KpiCard {...pctCard('Atingimento do Orçamento', kpis.atingimentoPct)} trend={trendFromValue((kpis.atingimentoPct.value ?? 0) - 100)} />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Evolução — Venda atual, Ano anterior e Orçamento</CardTitle>
          <div className="flex gap-1 rounded-lg border border-base-border p-1">
            {(['diario', 'semanal', 'mensal', 'acumulado'] as Granularidade[]).map((g) => (
              <button
                key={g}
                onClick={() => setGran(g)}
                className={clsx('rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors', gran === g ? 'bg-brand-600 text-white' : 'text-base-muted hover:bg-base-surface2')}
              >
                {g}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardBody>
          {loading || !points.length ? <Skeleton className="h-80 w-full" /> : <TrendLineChart points={points.map((p) => ({ data: p.data, venda: p.venda, vendaAnoAnterior: p.vendaAnoAnterior, orcamento: p.orcamento }))} height={340} />}
        </CardBody>
      </Card>

      {accData?.ritmo && (
        <Card>
          <CardBody className="flex items-center gap-3 py-4">
            <span className="text-2xl">{accData.ritmo === 'acelerando' ? '🚀' : accData.ritmo === 'desacelerando' ? '🐢' : '➡️'}</span>
            <div>
              <p className="text-sm font-semibold text-base-text">
                {accData.ritmo === 'acelerando' && 'Estamos acelerando'}
                {accData.ritmo === 'desacelerando' && 'Estamos desacelerando'}
                {accData.ritmo === 'estavel' && 'Ritmo estável'}
              </p>
              <p className="text-xs text-base-muted">Comparação do ritmo médio diário entre a 1ª e a 2ª metade do período filtrado.</p>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
