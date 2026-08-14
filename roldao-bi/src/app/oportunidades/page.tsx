'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { NoDataGate } from '@/components/layout/NoDataGate';
import { Card, CardBody } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useFilteredApi } from '@/hooks/useFilteredApi';
import { Lightbulb } from 'lucide-react';

export default function OportunidadesPage() {
  return (
    <div>
      <PageHeader title="Central de Oportunidades" description="Leitura automática dos desvios e destaques mais relevantes da base, considerando os filtros atuais." />
      <NoDataGate><Content /></NoDataGate>
    </div>
  );
}

function Content() {
  const { data, loading } = useFilteredApi<{ phrases: string[] }>('/api/opportunities');

  if (loading) return <div className="space-y-2.5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>;

  const phrases = data?.phrases ?? [];

  return (
    <div className="space-y-2.5">
      {phrases.map((p, i) => (
        <Card key={i}>
          <CardBody className="flex items-start gap-3 py-3.5">
            <Lightbulb size={18} className="mt-0.5 shrink-0 text-brand-400" />
            <p className="text-sm text-base-text">{p}</p>
          </CardBody>
        </Card>
      ))}
      {!phrases.length && (
        <Card><CardBody className="py-10 text-center text-sm text-base-muted">Nenhuma oportunidade identificada para os filtros atuais — tente ampliar o período ou remover filtros.</CardBody></Card>
      )}
    </div>
  );
}
