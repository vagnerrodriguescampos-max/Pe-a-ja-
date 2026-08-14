'use client';

import { useApi } from '@/hooks/useApi';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';
import type { ImportRecord } from '@/lib/types';

export function NoDataGate({ children }: { children: React.ReactNode }) {
  const { data, loading } = useApi<{ record: ImportRecord | null }>('/api/meta');

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
      </div>
    );
  }

  if (!data?.record) {
    return (
      <EmptyState
        title="Nenhuma base importada ainda"
        description="Importe a planilha 'INFORMATIVO DE VENDAS' do Roldão para começar a visualizar os indicadores. Nenhum dado é inventado — os painéis só são preenchidos após uma importação."
        ctaHref="/importar"
        ctaLabel="Importar planilha"
      />
    );
  }

  return <>{children}</>;
}
