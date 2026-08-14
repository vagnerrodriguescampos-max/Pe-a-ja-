'use client';

import { DimensionExplorer } from '@/components/pages/DimensionExplorer';

export default function CategoriasPage() {
  return (
    <DimensionExplorer
      dim="categoria" filterKey="categoria" nomeLabel="Categoria" showRegional={false}
      title="Análise por Categoria"
      description="Venda, orçamento, atingimento, crescimento, margem e participação por categoria."
      drillNextHref="/segmentos" drillNextLabel="Ver segmentos desta categoria"
    />
  );
}
