'use client';

import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import { formatCompactBRL, formatPercent } from '@/lib/kpi/format';

export interface MatrixPoint {
  nome: string;
  crescimento: number;
  atingimento: number;
  venda: number;
}

function quadrantOf(p: MatrixPoint): { label: string; color: string; icon: string } {
  const altaMeta = p.atingimento >= 100;
  const altoCrescimento = p.crescimento >= 0;
  if (altaMeta && altoCrescimento) return { label: 'Alta Performance', color: '#16c784', icon: '🏆' };
  if (!altaMeta && altoCrescimento) return { label: 'Crescimento', color: '#3ab7ff', icon: '🚀' };
  if (altaMeta && !altoCrescimento) return { label: 'Atenção', color: '#f5a623', icon: '⚠️' };
  return { label: 'Crítica', color: '#f0475b', icon: '🔴' };
}

export function Matrix2x2({ points, height = 380 }: { points: MatrixPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          type="number" dataKey="crescimento" name="Crescimento vs Ano Anterior"
          tickFormatter={(v) => formatPercent(v, 0)} tick={{ fill: 'var(--muted)', fontSize: 11 }}
          axisLine={{ stroke: 'var(--border)' }} tickLine={false}
          label={{ value: 'Crescimento vs Ano Anterior', position: 'insideBottom', offset: -4, fill: 'var(--muted)', fontSize: 11 }}
        />
        <YAxis
          type="number" dataKey="atingimento" name="Atingimento do Orçamento"
          tickFormatter={(v) => formatPercent(v, 0)} tick={{ fill: 'var(--muted)', fontSize: 11 }}
          axisLine={false} tickLine={false}
          label={{ value: 'Atingimento do Orçamento', angle: -90, position: 'insideLeft', fill: 'var(--muted)', fontSize: 11 }}
        />
        <ZAxis type="number" dataKey="venda" range={[60, 500]} />
        <ReferenceLine x={0} stroke="var(--muted)" strokeDasharray="3 3" />
        <ReferenceLine y={100} stroke="var(--muted)" strokeDasharray="3 3" />
        <Tooltip
          cursor={{ strokeDasharray: '3 3' }}
          contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as MatrixPoint;
            const q = quadrantOf(p);
            return (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 10, fontSize: 12 }}>
                <p className="font-semibold">{q.icon} {p.nome}</p>
                <p>Venda: {formatCompactBRL(p.venda)}</p>
                <p>Crescimento: {formatPercent(p.crescimento)}</p>
                <p>Atingimento: {formatPercent(p.atingimento)}</p>
                <p style={{ color: q.color }}>{q.label}</p>
              </div>
            );
          }}
        />
        <Scatter
          data={points}
          shape={(props: any) => {
            const p = props.payload as MatrixPoint;
            return <circle cx={props.cx} cy={props.cy} r={6} fill={quadrantOf(p).color} fillOpacity={0.85} stroke="var(--surface)" strokeWidth={1} />;
          }}
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
