'use client';

import { useMemo, useState } from 'react';
import { Table, Th, Td, Tr } from '../ui/Table';
import { Badge } from '../ui/Badge';
import type { RankingRow } from '@/lib/query/ranking';
import { formatCompactBRL, formatNumber, formatPercent } from '@/lib/kpi/format';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import clsx from 'clsx';

type SortKey = 'venda' | 'atingimentoPct' | 'crescimentoPct' | 'margemPct' | 'participacaoPct';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'venda', label: 'Venda' },
  { key: 'atingimentoPct', label: 'Atingimento' },
  { key: 'crescimentoPct', label: 'Crescimento' },
  { key: 'margemPct', label: 'Margem' },
  { key: 'participacaoPct', label: 'Participação' },
];

const TREND_ICON: Record<string, string> = { subindo: '📈', estavel: '➖', caindo: '📉' };

export function RankingTable({ rows, nomeLabel = 'Loja', onRowClick, showRegional = true, showLojas = false }: {
  rows: RankingRow[];
  nomeLabel?: string;
  onRowClick?: (row: RankingRow) => void;
  showRegional?: boolean;
  showLojas?: boolean;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('venda');
  const [dir, setDir] = useState<1 | -1>(-1);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a[sortKey] ?? -Infinity;
      const bv = b[sortKey] ?? -Infinity;
      return (av - bv) * dir;
    });
  }, [rows, sortKey, dir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setDir((d) => (d === -1 ? 1 : -1));
    else { setSortKey(key); setDir(-1); }
  }

  const top5 = new Set(sorted.slice().sort((a, b) => b.venda - a.venda).slice(0, 5).map((r) => r.chave));
  const bottom5 = new Set(rows.filter((r) => r.orcamento).slice().sort((a, b) => (a.atingimentoPct ?? 0) - (b.atingimentoPct ?? 0)).slice(0, 5).map((r) => r.chave));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="mr-1 text-base-muted">Ordenar por:</span>
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => toggleSort(opt.key)}
            className={clsx(
              'inline-flex items-center gap-1 rounded-md border px-2 py-1 font-medium transition-colors',
              sortKey === opt.key ? 'border-brand-500 bg-brand-600/15 text-brand-400' : 'border-base-border text-base-muted hover:bg-base-surface2'
            )}
          >
            {opt.label}
            {sortKey === opt.key ? (dir === -1 ? <ArrowDown size={12} /> : <ArrowUp size={12} />) : <ArrowUpDown size={11} className="opacity-40" />}
          </button>
        ))}
      </div>

      <Table>
        <thead>
          <tr>
            <Th align="center">#</Th>
            <Th>{nomeLabel}</Th>
            {showRegional && <Th>Regional</Th>}
            {showLojas && <Th align="right">Lojas</Th>}
            <Th align="right">Venda</Th>
            <Th align="right">Orçamento</Th>
            <Th align="right">Atingimento</Th>
            <Th align="right">Ano Anterior</Th>
            <Th align="right">Crescimento</Th>
            <Th align="right">Margem</Th>
            <Th align="right">Margem %</Th>
            <Th align="right">Participação</Th>
            <Th align="right">Gap Orçamento</Th>
            <Th align="center">Tendência</Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <Tr key={r.chave} onClick={onRowClick ? () => onRowClick(r) : undefined}>
              <Td align="center">
                <span className="inline-flex items-center gap-1">
                  {top5.has(r.chave) && '🏆'}
                  {bottom5.has(r.chave) && '⚠️'}
                  {i + 1}
                </span>
              </Td>
              <Td className="max-w-[220px] truncate font-medium">{r.nome}</Td>
              {showRegional && <Td className="text-base-muted">{r.regional ?? '—'}</Td>}
              {showLojas && <Td align="right">{r.lojasDistintas ?? '—'}</Td>}
              <Td align="right" className="font-semibold tabular-nums">{formatCompactBRL(r.venda)}</Td>
              <Td align="right" className="tabular-nums text-base-muted">{r.orcamento !== null ? formatCompactBRL(r.orcamento) : '—'}</Td>
              <Td align="right">
                {r.atingimentoPct !== null ? (
                  <Badge variant={r.atingimentoPct >= 100 ? 'good' : r.atingimentoPct >= 90 ? 'warn' : 'bad'}>{formatPercent(r.atingimentoPct, 0)}</Badge>
                ) : '—'}
              </Td>
              <Td align="right" className="tabular-nums text-base-muted">{r.vendaAnoAnterior !== null ? formatCompactBRL(r.vendaAnoAnterior) : '—'}</Td>
              <Td align="right">
                {r.crescimentoPct !== null ? <span className={r.crescimentoPct >= 0 ? 'text-good' : 'text-bad'}>{formatPercent(r.crescimentoPct)}</span> : '—'}
              </Td>
              <Td align="right" className="tabular-nums text-base-muted">{r.margem !== null ? formatCompactBRL(r.margem) : '—'}</Td>
              <Td align="right" className="tabular-nums text-base-muted">{r.margemPct !== null ? formatPercent(r.margemPct) : '—'}</Td>
              <Td align="right" className="tabular-nums text-base-muted">{r.participacaoPct !== null ? formatPercent(r.participacaoPct) : '—'}</Td>
              <Td align="right">
                {r.gapOrcamento !== null ? <span className={r.gapOrcamento >= 0 ? 'text-good' : 'text-bad'}>{formatCompactBRL(r.gapOrcamento)}</span> : '—'}
              </Td>
              <Td align="center">{r.tendencia ? TREND_ICON[r.tendencia] : '—'}</Td>
            </Tr>
          ))}
          {!sorted.length && (
            <tr><td colSpan={13} className="px-4 py-8 text-center text-sm text-base-muted">Sem dados para os filtros selecionados.</td></tr>
          )}
        </tbody>
      </Table>
    </div>
  );
}
