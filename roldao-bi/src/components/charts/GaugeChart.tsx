'use client';

import { GAUGE_COLOR, GAUGE_LABEL, classifyAtingimento } from '@/lib/kpi/gauge';
import type { BiConfig } from '@/lib/store/config';
import { formatPercent } from '@/lib/kpi/format';

const SIZE = 220;
const STROKE = 20;
const R = (SIZE - STROKE) / 2;
const CENTER = SIZE / 2;

function arcPoint(angleDeg: number) {
  const rad = (Math.PI * angleDeg) / 180;
  return { x: CENTER + R * Math.cos(rad), y: CENTER + R * Math.sin(rad) };
}

function describeArc(startDeg: number, endDeg: number) {
  const start = arcPoint(startDeg);
  const end = arcPoint(endDeg);
  const largeArc = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${R} ${R} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

export function GaugeChart({ pct, cfg, label }: { pct: number | null; cfg: BiConfig; label?: string }) {
  const status = classifyAtingimento(pct, cfg);
  // 180deg (esquerda) a 360deg (direita), mapeado para 0%..max%
  const max = Math.max(cfg.atingimentoExcelente + 20, 140);
  const clamped = pct === null ? 0 : Math.max(0, Math.min(pct, max));
  const needleAngle = 180 + (clamped / max) * 180;

  const bands = [
    { from: 0, to: cfg.atingimentoCritico, color: GAUGE_COLOR.critico },
    { from: cfg.atingimentoCritico, to: cfg.atingimentoAtencao, color: GAUGE_COLOR.atencao },
    { from: cfg.atingimentoAtencao, to: cfg.atingimentoExcelente, color: GAUGE_COLOR.dentro },
    { from: cfg.atingimentoExcelente, to: max, color: GAUGE_COLOR.excelente },
  ];

  const needle = arcPoint(needleAngle);

  return (
    <div className="flex flex-col items-center">
      <svg width={SIZE} height={SIZE / 2 + 30} viewBox={`0 0 ${SIZE} ${SIZE / 2 + 30}`}>
        {bands.map((b, i) => (
          <path
            key={i}
            d={describeArc(180 + (b.from / max) * 180, 180 + (b.to / max) * 180)}
            stroke={b.color}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="butt"
            opacity={0.9}
          />
        ))}
        <line x1={CENTER} y1={CENTER} x2={needle.x} y2={needle.y} stroke="var(--text)" strokeWidth={3} strokeLinecap="round" />
        <circle cx={CENTER} cy={CENTER} r={6} fill="var(--text)" />
        <text x={CENTER} y={CENTER - 26} textAnchor="middle" className="fill-current text-base-text" style={{ fontSize: 28, fontWeight: 700 }}>
          {pct !== null ? formatPercent(pct, 1) : '—'}
        </text>
      </svg>
      {status && (
        <span className="-mt-1 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: `${GAUGE_COLOR[status]}22`, color: GAUGE_COLOR[status] }}>
          {GAUGE_LABEL[status]}
        </span>
      )}
      {label && <p className="mt-1.5 text-xs text-base-muted">{label}</p>}
    </div>
  );
}
