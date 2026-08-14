'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { NoDataGate } from '@/components/layout/NoDataGate';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useApi } from '@/hooks/useApi';
import { formatNumber } from '@/lib/kpi/format';
import type { QualityReport } from '@/lib/kpi/quality';

export default function QualidadePage() {
  return (
    <div>
      <PageHeader title="Qualidade da Base" description="Auditoria dos dados importados: cobertura, ausências, duplicidades e mapeamento." />
      <NoDataGate><Content /></NoDataGate>
    </div>
  );
}

function Content() {
  const { data, loading } = useApi<{ report: QualityReport | null }>('/api/quality');
  const r = data?.report;

  if (loading || !r) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Registros importados" value={formatNumber(r.registrosImportados)} />
        <Metric label="Registros válidos" value={formatNumber(r.registrosValidos)} good />
        <Metric label="Registros com erro" value={formatNumber(r.registrosComErro)} bad={r.registrosComErro > 0} />
        <Metric label="Duplicidades" value={formatNumber(r.duplicidades)} bad={r.duplicidades > 0} />
        <Metric label="Lojas identificadas" value={formatNumber(r.lojasIdentificadas)} />
        <Metric label="Regionais identificadas" value={formatNumber(r.regionaisIdentificadas)} />
        <Metric label="Categorias identificadas" value={formatNumber(r.categoriasIdentificadas)} />
        <Metric label="Valores nulos (extras)" value={formatNumber(r.valoresNulos)} />
      </div>

      <Card>
        <CardHeader><CardTitle>Campos-chave ausentes por linha</CardTitle></CardHeader>
        <CardBody>
          {r.camposAusentes.length ? (
            <ul className="space-y-1.5 text-sm">
              {r.camposAusentes.map((c) => (
                <li key={c.campo} className="flex items-center justify-between border-b border-base-border/60 py-1.5 last:border-0">
                  <span className="text-base-text">{c.campo}</span>
                  <span className="font-semibold text-warn">{formatNumber(c.ocorrencias)} ocorrência(s)</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-good">Nenhum campo-chave ausente identificado.</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><CardTitle>Colunas não mapeadas por aba</CardTitle></CardHeader>
        <CardBody>
          {r.colunasNaoMapeadasPorAba.length ? (
            <div className="space-y-3">
              {r.colunasNaoMapeadasPorAba.map((s) => (
                <div key={s.aba}>
                  <p className="text-sm font-semibold text-base-text">{s.aba}</p>
                  <p className="text-xs text-base-muted">{s.colunas.join(', ')}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-good">100% das colunas da última importação foram reconhecidas.</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Metric({ label, value, good, bad }: { label: string; value: string; good?: boolean; bad?: boolean }) {
  return (
    <Card className="px-4 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-base-muted">{label}</p>
      <p className={`mt-1 text-xl font-bold ${good ? 'text-good' : bad ? 'text-bad' : 'text-base-text'}`}>{value}</p>
    </Card>
  );
}
