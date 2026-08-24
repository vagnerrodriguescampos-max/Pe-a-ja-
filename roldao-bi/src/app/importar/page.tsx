'use client';

import { useRef, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Table, Th, Td, Tr } from '@/components/ui/Table';
import { useApi } from '@/hooks/useApi';
import type { ImportRecord } from '@/lib/types';
import { formatDateBR, formatNumber } from '@/lib/kpi/format';
import { CheckCircle2, FileSpreadsheet, Loader2, UploadCloud, XCircle, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

const STATUS_META: Record<ImportRecord['status'], { label: string; icon: JSX.Element; variant: 'good' | 'warn' | 'bad' | 'info' }> = {
  concluida: { label: 'Concluída', icon: <CheckCircle2 size={13} />, variant: 'good' },
  concluida_com_avisos: { label: 'Concluída com avisos', icon: <AlertTriangle size={13} />, variant: 'warn' },
  processando: { label: 'Processando', icon: <Loader2 size={13} className="animate-spin" />, variant: 'info' },
  erro: { label: 'Erro', icon: <XCircle size={13} />, variant: 'bad' },
};

export default function ImportarPage() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const history = useApi<{ imports: ImportRecord[] }>('/api/import/history');

  async function handleFile(file: File) {
    setUploading(true); setError(null); setResult(null);
    const form = new FormData();
    form.append('file', file);
    form.append('activate', 'true');
    form.append('importedBy', 'Vagner Campos');
    try {
      const res = await fetch('/api/import/upload', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Falha ao importar.');
      setResult(json.record);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.');
    } finally {
      setUploading(false);
    }
  }

  async function activate(id: string) {
    await fetch('/api/import/activate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    location.reload();
  }

  return (
    <div>
      <PageHeader title="Importar Base" description="Envie a planilha 'INFORMATIVO DE VENDAS' (ou qualquer nova versão) para atualizar o BI. O histórico de importações nunca é apagado." />

      <Card className="mb-6">
        <CardBody>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
            onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl2 border-2 border-dashed border-base-border bg-base-surface2/40 px-6 py-14 text-center transition-colors hover:border-brand-500/60"
          >
            <UploadCloud size={32} className="text-brand-400" />
            <p className="text-sm font-semibold text-base-text">Arraste o arquivo .xlsx aqui ou clique para selecionar</p>
            <p className="text-xs text-base-muted">O sistema identifica automaticamente abas, colunas, períodos e dimensões — nada é descartado.</p>
            <input ref={inputRef} type="file" accept=".xlsx,.xls,.xlsm" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>
          {uploading && <p className="mt-3 flex items-center gap-2 text-sm text-brand-400"><Loader2 size={14} className="animate-spin" /> Processando planilha — para arquivos grandes isso pode levar alguns minutos...</p>}
          {error && <p className="mt-3 text-sm text-bad">{error}</p>}
        </CardBody>
      </Card>

      {result && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Resultado da Importação</CardTitle>
            <Badge variant={STATUS_META[result.status].variant}>{STATUS_META[result.status].icon} {STATUS_META[result.status].label}</Badge>
          </CardHeader>
          <CardBody>
            {result.warnings && result.warnings.length > 0 && (
              <div className="mb-4 rounded-lg border border-warn/40 bg-warn/10 px-4 py-3">
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-warn">
                  <AlertTriangle size={13} /> Avisos de consistência — confira antes de usar esta base
                </p>
                <ul className="list-disc space-y-1 pl-5 text-xs text-base-text">
                  {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}
            <div className="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Info label="Arquivo importado" value={result.fileName} />
              <Info label="Data da importação" value={new Date(result.importedAt).toLocaleString('pt-BR')} />
              <Info label="Quantidade de registros" value={formatNumber(result.totalRecords)} />
              <Info label="Período da base" value={result.periodoInicio ? `${formatDateBR(result.periodoInicio)} – ${formatDateBR(result.periodoFim)}` : '—'} />
              <Info label="Lojas identificadas" value={formatNumber(result.lojasIdentificadas)} />
              <Info label="Regionais identificadas" value={formatNumber(result.regionaisIdentificadas)} />
              <Info label="Categorias identificadas" value={formatNumber(result.categoriasIdentificadas)} />
              <Info label="Subcategorias identificadas" value={formatNumber(result.subcategoriasIdentificadas)} />
            </div>

            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-base-muted">Abas encontradas e mapeamento</p>
            <Table>
              <thead>
                <tr>
                  <Th>Aba</Th><Th>Papel identificado</Th><Th align="right">Linhas</Th><Th align="right">Válidas</Th>
                  <Th align="right">Colunas mapeadas</Th><Th>Colunas não reconhecidas</Th>
                </tr>
              </thead>
              <tbody>
                {result.sheets.map((s) => (
                  <Tr key={s.sheetName}>
                    <Td className="font-medium">{s.sheetName}</Td>
                    <Td className="text-base-muted">{s.role} <span className="text-[10px]">({Math.round(s.roleConfidence * 100)}%)</span></Td>
                    <Td align="right">{formatNumber(s.totalRows)}</Td>
                    <Td align="right">{formatNumber(s.validRows)}</Td>
                    <Td align="right">{s.mappedColumns.length}</Td>
                    <Td className="max-w-[280px] truncate text-xs text-base-muted" title={s.unmappedColumns.join(', ')}>
                      {s.unmappedColumns.length ? s.unmappedColumns.join(', ') : '— (100% reconhecidas)'}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-base-muted">
              <FileSpreadsheet size={13} /> Colunas não reconhecidas continuam disponíveis nos dados brutos (para auditoria) e podem ser mapeadas em versões futuras da planilha.
            </p>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Histórico de Importações</CardTitle></CardHeader>
        <CardBody>
          <Table>
            <thead>
              <tr>
                <Th>Arquivo</Th><Th>Importado em</Th><Th align="right">Registros</Th><Th>Período</Th><Th>Status</Th><Th align="center">Ativa</Th>
              </tr>
            </thead>
            <tbody>
              {(history.data?.imports ?? []).map((r) => (
                <Tr key={r.id}>
                  <Td className="font-medium">{r.fileName}</Td>
                  <Td className="text-base-muted">{new Date(r.importedAt).toLocaleString('pt-BR')}</Td>
                  <Td align="right">{formatNumber(r.totalRecords)}</Td>
                  <Td className="text-base-muted">{r.periodoInicio ? `${formatDateBR(r.periodoInicio)} – ${formatDateBR(r.periodoFim)}` : '—'}</Td>
                  <Td><Badge variant={STATUS_META[r.status].variant}>{STATUS_META[r.status].label}</Badge></Td>
                  <Td align="center">
                    {r.isActive ? (
                      <Badge variant="brand">Em uso</Badge>
                    ) : (
                      <button onClick={() => activate(r.id)} className={clsx('rounded-md border border-base-border px-2 py-1 text-xs font-medium hover:bg-base-surface2')}>Usar esta base</button>
                    )}
                  </Td>
                </Tr>
              ))}
              {!history.data?.imports.length && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-base-muted">Nenhuma importação realizada ainda.</td></tr>
              )}
            </tbody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-base-muted">{label}</p>
      <p className="font-semibold text-base-text">{value}</p>
    </div>
  );
}
