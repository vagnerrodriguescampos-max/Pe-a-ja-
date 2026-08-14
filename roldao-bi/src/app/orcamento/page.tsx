'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { NoDataGate } from '@/components/layout/NoDataGate';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { GaugeChart } from '@/components/charts/GaugeChart';
import { useFilteredApi } from '@/hooks/useFilteredApi';
import { useApi } from '@/hooks/useApi';
import type { Forecast } from '@/lib/kpi/forecast';
import type { BiConfig } from '@/lib/store/config';
import { formatCompactBRL, formatDateBR, formatNumber, formatPercent } from '@/lib/kpi/format';
import { Skeleton } from '@/components/ui/Skeleton';
import Link from 'next/link';

const STATUS_META: Record<Forecast['status'], { label: string; icon: string; color: string }> = {
  sem_dados: { label: 'Sem dados suficientes', icon: 'ℹ️', color: 'var(--muted)' },
  critico: { label: 'Crítico — abaixo do orçamento', icon: '🔴', color: '#f0475b' },
  atencao: { label: 'Atenção — próximo do orçamento', icon: '⚠️', color: '#f5a623' },
  no_alvo: { label: 'Dentro do orçamento', icon: '✅', color: '#16c784' },
  excelente: { label: 'Excelente — acima do orçamento', icon: '🚀', color: '#1f74f5' },
};

export default function OrcamentoPage() {
  return (
    <div>
      <PageHeader title="Orçamento" description="Velocímetro de atingimento e forecast de fechamento do período filtrado." />
      <NoDataGate><Content /></NoDataGate>
    </div>
  );
}

function Content() {
  const { data: forecastData, loading } = useFilteredApi<{ forecast: Forecast }>('/api/forecast');
  const { data: configData } = useApi<{ config: BiConfig }>('/api/config');
  const f = forecastData?.forecast;
  const cfg = configData?.config;

  if (loading || !f || !cfg) {
    return <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-96" /><Skeleton className="h-96" /></div>;
  }

  const meta = STATUS_META[f.status];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Velocímetro de Orçamento</CardTitle></CardHeader>
          <CardBody className="flex flex-col items-center py-8">
            <GaugeChart pct={f.atingimentoRealizadoPct} cfg={cfg} label={`${formatDateBR(f.periodoInicio)} – ${formatDateBR(f.periodoFim)}`} />
            <p className="mt-4 text-center text-xs text-base-muted">
              Limites configuráveis: crítico &lt; {cfg.atingimentoCritico}% · atenção até {cfg.atingimentoAtencao}% · dentro/acima até {cfg.atingimentoExcelente}% · excelente ≥ {cfg.atingimentoExcelente}%
              <br />
              <Link href="/configuracoes" className="text-brand-400 hover:underline">Ajustar limites</Link>
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Forecast de Fechamento</CardTitle></CardHeader>
          <CardBody className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: `${meta.color}1a` }}>
              <span className="text-lg">{meta.icon}</span>
              <span className="text-sm font-semibold" style={{ color: meta.color }}>{meta.label}</span>
            </div>
            <ForecastRow label="Venda realizada" value={formatCompactBRL(f.vendaRealizada)} />
            <ForecastRow label="Orçamento do período" value={f.orcamentoPeriodo !== null ? formatCompactBRL(f.orcamentoPeriodo) : 'Indisponível na base'} />
            <ForecastRow label="Realizado" value={f.atingimentoRealizadoPct !== null ? formatPercent(f.atingimentoRealizadoPct) : '—'} />
            <ForecastRow label="Dias decorridos" value={formatNumber(f.diasDecorridos)} />
            <ForecastRow label="Dias restantes" value={formatNumber(f.diasRestantes)} />
            <ForecastRow label="Venda média diária" value={f.mediaDiaria !== null ? formatCompactBRL(f.mediaDiaria) : '—'} />
            <ForecastRow label="Venda diária necessária" value={f.vendaDiariaNecessaria !== null ? formatCompactBRL(Math.max(f.vendaDiariaNecessaria, 0)) : '—'} highlight />
            <ForecastRow label="Projeção de fechamento" value={f.vendaProjetada !== null ? formatCompactBRL(f.vendaProjetada) : '—'} highlight />
            <ForecastRow label="Atingimento projetado" value={f.atingimentoProjetadoPct !== null ? formatPercent(f.atingimentoProjetadoPct) : '—'} />
            <ForecastRow label="Gap para o orçamento" value={f.gapOrcamento !== null ? formatCompactBRL(f.gapOrcamento) : '—'} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function ForecastRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-base-border/60 py-1.5 last:border-0">
      <span className="text-sm text-base-muted">{label}</span>
      <span className={highlight ? 'text-base font-bold text-brand-400' : 'text-sm font-semibold text-base-text'}>{value}</span>
    </div>
  );
}
