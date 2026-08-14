'use client';

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCompactBRL, formatDateBR } from '@/lib/kpi/format';

export interface TrendPoint {
  data: string;
  venda: number;
  vendaAnoAnterior?: number;
  orcamento?: number;
}

export function TrendLineChart({ points, height = 300 }: { points: TrendPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={points} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="data"
          tickFormatter={(v) => formatDateBR(v).slice(0, 5)}
          tick={{ fill: 'var(--muted)', fontSize: 11 }}
          axisLine={{ stroke: 'var(--border)' }}
          tickLine={false}
          minTickGap={24}
        />
        <YAxis
          tickFormatter={(v) => formatCompactBRL(v)}
          tick={{ fill: 'var(--muted)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={72}
        />
        <Tooltip
          contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }}
          labelFormatter={(v) => formatDateBR(String(v))}
          formatter={(v: number, name: string) => [formatCompactBRL(v), name]}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="venda" name="Venda atual" stroke="#1f74f5" strokeWidth={2.5} dot={false} />
        <Line type="monotone" dataKey="vendaAnoAnterior" name="Ano anterior" stroke="#8891a8" strokeWidth={2} strokeDasharray="4 3" dot={false} />
        <Line type="monotone" dataKey="orcamento" name="Orçamento" stroke="#16c784" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
