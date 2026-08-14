'use client';

import { DimensionExplorer } from '@/components/pages/DimensionExplorer';

export default function RegionaisPage() {
  return (
    <DimensionExplorer
      dim="regional" filterKey="regional" nomeLabel="Regional" showLojas
      title="Performance por Regional"
      description="Venda, orçamento, atingimento, crescimento e margem por regional. Selecione uma regional para ver só as lojas dela."
      drillNextHref="/lojas" drillNextLabel="Ver lojas desta regional"
    />
  );
}
