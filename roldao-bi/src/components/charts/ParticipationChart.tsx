'use client';

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCompactBRL, formatPercent } from '@/lib/kpi/format';

const COLORS = ['#1f74f5', '#16c784', '#f5a623', '#3ab7ff', '#8891a8', '#a78bfa', '#f0475b', '#0d44a8', '#34d399', '#fb923c'];

export function ParticipationChart({ data, height = 300 }: { data: { nome: string; venda: number }[]; height?: number }) {
  const total = data.reduce((a, d) => a + d.venda, 0);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="venda" nameKey="nome" innerRadius="55%" outerRadius="85%" paddingAngle={1.5}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="var(--surface)" strokeWidth={2} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }}
          formatter={(v: number, name: string) => [`${formatCompactBRL(v)} (${formatPercent(total ? (v / total) * 100 : 0)})`, name]}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} layout="vertical" align="right" verticalAlign="middle" />
      </PieChart>
    </ResponsiveContainer>
  );
}
