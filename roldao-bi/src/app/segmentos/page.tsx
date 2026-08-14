'use client';

import { DimensionExplorer } from '@/components/pages/DimensionExplorer';

export default function SegmentosPage() {
  return (
    <DimensionExplorer
      dim="segmento" filterKey="segmento" nomeLabel="Segmento" showRegional={false}
      title="Análise por Segmento"
      description="Venda, orçamento (quando disponível), ano anterior, crescimento e participação por segmento. Selecione um segmento para ver as subcategorias."
      drillNextHref="/subcategorias" drillNextLabel="Ver subcategorias deste segmento"
    />
  );
}
