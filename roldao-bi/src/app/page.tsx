'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';
import { NoDataGate } from '@/components/layout/NoDataGate';
import { KpiCard } from '@/components/kpi/KpiCard';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { GaugeChart } from '@/components/charts/GaugeChart';
import { TrendLineChart } from '@/components/charts/TrendLineChart';
import { useFilteredApi } from '@/hooks/useFilteredApi';
import { useApi } from '@/hooks/useApi';
import type { ExecutiveKpis } from '@/lib/kpi/executive';
import type { Forecast } from '@/lib/kpi/forecast';
import type { RankingRow } from '@/lib/query/ranking';
import type { Alert } from '@/lib/kpi/insights';
import type { DailyPoint } from '@/lib/query/aggregate';
import type { BiConfig } from '@/lib/store/config';
import { moneyCard, pctCard, trendFromValue } from '@/lib/kpi/toCard';
import { formatCompactBRL, formatNumber, formatPercent } from '@/lib/kpi/format';
import { classifyStoreStatus, STORE_STATUS_META } from '@/lib/kpi/storeStatus';
import { ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <div>
      <PageHeader title="Visão Executiva" description="Cockpit de comando — os principais números da operação em poucos segundos." />
      <NoDataGate>
        <Dashboard />
      </NoDataGate>
    </div>
  );
}

function Dashboard() {
  const { data: kpiData, loading: kpiLoading } = useFilteredApi<{ kpis: ExecutiveKpis }>('/api/kpis');
  const { data: forecastData } = useFilteredApi<{ forecast: Forecast }>('/api/forecast');
  const { data: rankingData } = useFilteredApi<{ rows: RankingRow[] }>('/api/rankings', { dim: 'loja_codigo' });
  const { data: alertsData } = useFilteredApi<{ alerts: Alert[] }>('/api/alerts');
  const { data: summaryData } = useFilteredApi<{ summary: string }>('/api/summary');
  const { data: dailyData } = useFilteredApi<{ series: DailyPoint[] }>('/api/series/daily');
  const { data: configData } = useApi<{ config: BiConfig }>('/api/config');

  const kpis = kpiData?.kpis;
  const cfg = configData?.config;
  const lojas = rankingData?.rows ?? [];
  const top5 = [...lojas].sort((a, b) => b.venda - a.venda).slice(0, 5);
  const bottom5 = [...lojas].filter((l) => l.orcamento).sort((a, b) => (a.atingimentoPct ?? 0) - (b.atingimentoPct ?? 0)).slice(0, 5);

  return (
    <div className="space-y-6">
      {summaryData?.summary && (
        <Card className="border-brand-500/30 bg-gradient-to-br from-brand-600/10 to-transparent">
          <CardBody className="py-4">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-brand-400">Resumo Executivo</p>
            <p className="text-sm leading-relaxed text-base-text">{summaryData.summary}</p>
          </CardBody>
        </Card>
      )}

      {kpiLoading || !kpis ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard {...moneyCard('Venda Bruta', kpis.vendaBruta)} trend={trendFromValue(kpis.crescimentoPct.value)} variacaoLabel={kpis.crescimentoPct.value !== null ? formatPercent(kpis.crescimentoPct.value) : undefined} comparativoLabel={kpis.diferencaAnoAnteriorRS.value !== null ? `${formatCompactBRL(kpis.diferencaAnoAnteriorRS.value)} vs ano anterior` : 'sem base de comparação'} emphasis />
          <KpiCard {...moneyCard('Orçamento', kpis.orcamento)} comparativoLabel={kpis.atingimentoPct.value !== null ? `Atingimento: ${formatPercent(kpis.atingimentoPct.value)}` : undefined} trend={trendFromValue((kpis.atingimentoPct.value ?? 0) - 100)} />
          <KpiCard {...pctCard('Atingimento do Orçamento', kpis.atingimentoPct, { tooltip: 'Venda / Orçamento' })} trend={trendFromValue((kpis.atingimentoPct.value ?? 0) - 100)} />
          <KpiCard {...moneyCard('Margem Bruta', kpis.margemBruta)} comparativoLabel={kpis.margemPct.value !== null ? `${formatPercent(kpis.margemPct.value)} de margem` : undefined} trend={trendFromValue(kpis.diferencaMargemVsAnoAnterior.value)} />
          <KpiCard {...moneyCard('Venda Ano Anterior', kpis.vendaAnoAnterior)} />
          <KpiCard {...pctCard('Crescimento vs Ano Anterior', kpis.crescimentoPct)} trend={trendFromValue(kpis.crescimentoPct.value)} />
          <KpiCard {...moneyCard('Venda Média por Dia', kpis.vendaMediaDia)} comparativoLabel={`${kpis.diasComDados} dia(s) com venda no período`} />
          <KpiCard {...moneyCard('Venda Projetada (mês)', kpis.vendaProjetadaMes)} tooltip="Média diária × dias do período" />
          <KpiCard title="Quantidade de Lojas" value={kpis.qtdLojas.value !== null ? formatNumber(kpis.qtdLojas.value) : '—'} source={kpis.qtdLojas.source} />
          <KpiCard title="Lojas Acima do Orçamento" value={kpis.lojasAcimaOrcamento.value !== null ? formatNumber(kpis.lojasAcimaOrcamento.value) : '—'} source={kpis.lojasAcimaOrcamento.source} trend="up" trendGoodWhenUp />
          <KpiCard title="Lojas Abaixo do Orçamento" value={kpis.lojasAbaixoOrcamento.value !== null ? formatNumber(kpis.lojasAbaixoOrcamento.value) : '—'} source={kpis.lojasAbaixoOrcamento.source} trend="down" trendGoodWhenUp={false} />
          <KpiCard {...pctCard('Atingimento Acumulado', kpis.atingimentoAcumuladoPct)} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Performance Comercial — Venda x Ano Anterior x Orçamento</CardTitle></CardHeader>
          <CardBody>
            {dailyData?.series?.length ? (
              <TrendLineChart points={dailyData.series.map((p) => ({ data: p.data, venda: p.venda, vendaAnoAnterior: p.vendaAnoAnterior, orcamento: p.orcamento }))} />
            ) : (
              <Skeleton className="h-72 w-full" />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Velocímetro de Orçamento</CardTitle></CardHeader>
          <CardBody className="flex flex-col items-center">
            {cfg ? <GaugeChart pct={kpis?.atingimentoPct.value ?? null} cfg={cfg} label="Atingimento do período filtrado" /> : <Skeleton className="h-40 w-40 rounded-full" />}
            {forecastData?.forecast && (
              <div className="mt-3 w-full space-y-1 border-t border-base-border pt-3 text-xs text-base-muted">
                <div className="flex justify-between"><span>Projeção de fechamento</span><span className="font-semibold text-base-text">{formatCompactBRL(forecastData.forecast.vendaProjetada)}</span></div>
                <div className="flex justify-between"><span>Dias restantes</span><span className="font-semibold text-base-text">{forecastData.forecast.diasRestantes}</span></div>
                <Link href="/orcamento" className="mt-2 flex items-center justify-center gap-1 text-brand-400 hover:underline">Ver forecast completo <ArrowRight size={12} /></Link>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>🏆 Top 5 Lojas</CardTitle>
            <Link href="/lojas" className="text-xs font-medium text-brand-400 hover:underline">Ver ranking completo</Link>
          </CardHeader>
          <CardBody className="space-y-2">
            {top5.map((l, i) => (
              <RankRow key={l.chave} pos={i + 1} row={l} cfg={cfg} />
            ))}
            {!top5.length && <p className="text-sm text-base-muted">Sem dados para os filtros selecionados.</p>}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>⚠️ Lojas que Precisam de Atenção</CardTitle>
            <Link href="/lojas" className="text-xs font-medium text-brand-400 hover:underline">Ver ranking completo</Link>
          </CardHeader>
          <CardBody className="space-y-2">
            {bottom5.map((l, i) => (
              <RankRow key={l.chave} pos={i + 1} row={l} cfg={cfg} />
            ))}
            {!bottom5.length && <p className="text-sm text-base-muted">Sem lojas com orçamento cadastrado para os filtros selecionados.</p>}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>🚨 Alertas Inteligentes</CardTitle>
          <Link href="/alertas" className="text-xs font-medium text-brand-400 hover:underline">Central de alertas</Link>
        </CardHeader>
        <CardBody className="space-y-2">
          {(alertsData?.alerts ?? []).slice(0, 5).map((a) => (
            <div key={a.id} className="flex items-start gap-2.5 rounded-lg border border-base-border bg-base-surface2/50 px-3 py-2">
              <span>{a.icon}</span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-base-text">{a.title} <span className="font-normal text-base-muted">— {a.escopo}</span></p>
                <p className="text-xs text-base-muted">{a.text}</p>
              </div>
            </div>
          ))}
          {alertsData && alertsData.alerts.length === 0 && <p className="text-sm text-base-muted">Nenhum alerta relevante para os filtros atuais.</p>}
        </CardBody>
      </Card>
    </div>
  );
}

function RankRow({ pos, row, cfg }: { pos: number; row: RankingRow; cfg?: BiConfig }) {
  const status = cfg ? classifyStoreStatus(row, cfg) : null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-base-surface2/60">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="w-5 shrink-0 text-center text-xs font-bold text-base-muted">{pos}</span>
        {status && <span title={STORE_STATUS_META[status].label}>{STORE_STATUS_META[status].icon}</span>}
        <span className="truncate text-sm font-medium text-base-text">{row.nome}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-sm font-semibold tabular-nums text-base-text">{formatCompactBRL(row.venda)}</span>
        {row.atingimentoPct !== null && (
          <Badge variant={row.atingimentoPct >= 100 ? 'good' : row.atingimentoPct >= 90 ? 'warn' : 'bad'}>{formatPercent(row.atingimentoPct, 0)}</Badge>
        )}
      </div>
    </div>
  );
}
