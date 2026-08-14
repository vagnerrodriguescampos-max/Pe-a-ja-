'use client';

import { DimensionExplorer } from '@/components/pages/DimensionExplorer';

export default function CanaisPage() {
  return (
    <DimensionExplorer
      dim="canal" filterKey="canal" nomeLabel="Canal" showRegional={false}
      title="Televenda e E-commerce"
      description="Comparativo entre loja física, televendas, e-commerce e demais canais identificados na base."
    />
  );
}
