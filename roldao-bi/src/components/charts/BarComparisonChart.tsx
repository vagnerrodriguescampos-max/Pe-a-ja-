'use client';

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCompactBRL } from '@/lib/kpi/format';

export interface BarPoint {
  nome: string;
  venda: number;
  orcamento?: number;
}

export function BarComparisonChart({ points, height = 320 }: { points: BarPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={points} margin={{ top: 8, right: 16, left: 4, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="nome" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} interval={0} angle={-20} textAnchor="end" height={60} />
        <YAxis tickFormatter={(v) => formatCompactBRL(v)} tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={72} />
        <Tooltip
          contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }}
          formatter={(v: number, name: string) => [formatCompactBRL(v), name]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="venda" name="Venda" fill="#1f74f5" radius={[4, 4, 0, 0]} />
        <Bar dataKey="orcamento" name="Orçamento" fill="#16c784" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
