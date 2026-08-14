'use client';

import { PageHeader } from '@/components/layout/PageHeader';
import { NoDataGate } from '@/components/layout/NoDataGate';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, Th, Td, Tr } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { useFilteredApi } from '@/hooks/useFilteredApi';
import { formatCompactBRL, formatPercent } from '@/lib/kpi/format';

interface PisoRow {
  loja: string; codigo: string; regional: string | null; venda: number; piso: number | null;
  orcamento: number | null; abaixoDoPiso: boolean | null; atingimentoPisoPct: number | null;
}

export default function PisoPage() {
  return (
    <div>
      <PageHeader title="Piso / Meta Mínima" description="Comparação entre venda realizada, piso de loja e orçamento (aba 'Piso' da planilha)." />
      <NoDataGate><Content /></NoDataGate>
    </div>
  );
}

function Content() {
  const { data, loading } = useFilteredApi<{ rows: PisoRow[]; disponivel: boolean }>('/api/piso');

  if (loading) return <Skeleton className="h-80 w-full" />;

  if (!data?.disponivel) {
    return (
      <Card><CardBody className="py-10 text-center text-sm text-base-muted">
        Nenhuma informação de piso encontrada para os filtros atuais. Verifique se a aba &quot;Piso&quot; foi importada e se há dados para o período selecionado.
      </CardBody></Card>
    );
  }

  const abaixo = data.rows.filter((r) => r.abaixoDoPiso);

  return (
    <div className="space-y-6">
      {abaixo.length > 0 && (
        <Card className="border-bad/40 bg-bad/5">
          <CardBody className="py-4">
            <p className="text-sm font-semibold text-bad">🔴 {abaixo.length} loja(s) abaixo do piso</p>
            <p className="mt-1 text-xs text-base-muted">{abaixo.map((r) => r.loja).join(', ')}</p>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Venda x Piso x Orçamento por Loja</CardTitle></CardHeader>
        <CardBody>
          <Table>
            <thead>
              <tr>
                <Th>Loja</Th><Th>Regional</Th><Th align="right">Venda</Th><Th align="right">Piso</Th>
                <Th align="right">Orçamento</Th><Th align="right">% do Piso</Th><Th align="center">Status</Th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <Tr key={r.codigo}>
                  <Td className="font-medium">{r.loja}</Td>
                  <Td className="text-base-muted">{r.regional ?? '—'}</Td>
                  <Td align="right" className="tabular-nums font-semibold">{formatCompactBRL(r.venda)}</Td>
                  <Td align="right" className="tabular-nums text-base-muted">{r.piso !== null ? formatCompactBRL(r.piso) : '—'}</Td>
                  <Td align="right" className="tabular-nums text-base-muted">{r.orcamento !== null ? formatCompactBRL(r.orcamento) : '—'}</Td>
                  <Td align="right">{r.atingimentoPisoPct !== null ? formatPercent(r.atingimentoPisoPct, 0) : '—'}</Td>
                  <Td align="center">
                    {r.abaixoDoPiso === true && <Badge variant="bad">ABAIXO DO PISO</Badge>}
                    {r.abaixoDoPiso === false && <Badge variant="good">OK</Badge>}
                    {r.abaixoDoPiso === null && <Badge variant="neutral">Sem piso</Badge>}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}
