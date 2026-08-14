'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { NoDataGate } from '@/components/layout/NoDataGate';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { TrendLineChart } from '@/components/charts/TrendLineChart';
import { KpiCard } from '@/components/kpi/KpiCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { useFilteredApi } from '@/hooks/useFilteredApi';
import type { DailyPoint } from '@/lib/query/aggregate';
import type { ExecutiveKpis } from '@/lib/kpi/executive';
import { moneyCard, pctCard, trendFromValue } from '@/lib/kpi/toCard';

const RITMO_META: Record<string, { label: string; icon: string; desc: string }> = {
  acelerando: { label: 'Estamos acelerando', icon: '🚀', desc: 'O ritmo médio diário da 2ª metade do período está acima da 1ª metade.' },
  desacelerando: { label: 'Estamos desacelerando', icon: '🐢', desc: 'O ritmo médio diário da 2ª metade do período está abaixo da 1ª metade.' },
  estavel: { label: 'Ritmo estável', icon: '➡️', desc: 'O ritmo de vendas se manteve estável ao longo do período.' },
};

export default function AcumuladoPage() {
  return (
    <div>
      <PageHeader title="Venda Acumulada" description="Venda acumulada atual x ano anterior x orçamento acumulado, e tendência de ritmo." />
      <NoDataGate><Content /></NoDataGate>
    </div>
  );
}

function Content() {
  const { data, loading } = useFilteredApi<{ series: DailyPoint[]; ritmo: string | null }>('/api/series/accumulated');
  const { data: kpiData } = useFilteredApi<{ kpis: ExecutiveKpis }>('/api/kpis');
  const kpis = kpiData?.kpis;
  const ritmo = data?.ritmo ? RITMO_META[data.ritmo] : null;

  return (
    <div className="space-y-6">
      {kpis && (
        <div className="grid gap-4 sm:grid-cols-3">
          <KpiCard {...moneyCard('Venda Acumulada', kpis.vendaAcumulada)} />
          <KpiCard {...moneyCard('Orçamento Acumulado', kpis.orcamentoAcumulado)} />
          <KpiCard {...pctCard('Atingimento Acumulado', kpis.atingimentoAcumuladoPct)} trend={trendFromValue((kpis.atingimentoAcumuladoPct.value ?? 0) - 100)} />
        </div>
      )}

      {ritmo && (
        <Card>
          <CardBody className="flex items-center gap-3 py-4">
            <span className="text-2xl">{ritmo.icon}</span>
            <div>
              <p className="text-sm font-semibold text-base-text">{ritmo.label}</p>
              <p className="text-xs text-base-muted">{ritmo.desc}</p>
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Evolução Acumulada</CardTitle></CardHeader>
        <CardBody>
          {loading || !data?.series.length ? <Skeleton className="h-80 w-full" /> : <TrendLineChart points={data.series.map((p) => ({ data: p.data, venda: p.venda, vendaAnoAnterior: p.vendaAnoAnterior, orcamento: p.orcamento }))} height={340} />}
        </CardBody>
      </Card>
    </div>
  );
}
