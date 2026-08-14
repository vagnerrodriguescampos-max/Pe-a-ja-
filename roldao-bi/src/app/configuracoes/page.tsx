'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { useApi } from '@/hooks/useApi';
import type { BiConfig } from '@/lib/store/config';
import { Save } from 'lucide-react';

export default function ConfiguracoesPage() {
  const { data } = useApi<{ config: BiConfig }>('/api/config');
  const [form, setForm] = useState<BiConfig | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (data?.config && !form) setForm(data.config); }, [data, form]);

  async function save() {
    if (!form) return;
    const res = await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const json = await res.json();
    setForm(json.config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div>
      <PageHeader title="Configurações" description="Limites do velocímetro de orçamento, alertas e usuário logado." />
      {form && (
        <div className="max-w-2xl space-y-6">
          <Card>
            <CardHeader><CardTitle>Limites de Atingimento do Orçamento</CardTitle></CardHeader>
            <CardBody className="space-y-3">
              <Field label="Crítico (< este valor)" value={form.atingimentoCritico} onChange={(v) => setForm({ ...form, atingimentoCritico: v })} suffix="%" />
              <Field label="Atenção (até este valor)" value={form.atingimentoAtencao} onChange={(v) => setForm({ ...form, atingimentoAtencao: v })} suffix="%" />
              <Field label="Excelente (a partir deste valor)" value={form.atingimentoExcelente} onChange={(v) => setForm({ ...form, atingimentoExcelente: v })} suffix="%" />
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle>Limites de Alertas</CardTitle></CardHeader>
            <CardBody className="space-y-3">
              <Field label="Crescimento considerado relevante" value={form.crescimentoRelevante} onChange={(v) => setForm({ ...form, crescimentoRelevante: v })} suffix="%" />
              <Field label="Queda considerada relevante" value={form.quedaRelevante} onChange={(v) => setForm({ ...form, quedaRelevante: v })} suffix="%" />
              <Field label="Margem de referência mínima" value={form.margemReferencia} onChange={(v) => setForm({ ...form, margemReferencia: v })} suffix="%" />
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle>Usuário</CardTitle></CardHeader>
            <CardBody>
              <label className="mb-1 block text-xs font-semibold text-base-muted">Nome exibido no cabeçalho</label>
              <input
                value={form.usuarioLogado}
                onChange={(e) => setForm({ ...form, usuarioLogado: e.target.value })}
                className="w-full max-w-xs rounded-lg border border-base-border bg-base-surface px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
            </CardBody>
          </Card>

          <button onClick={save} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            <Save size={15} /> {saved ? 'Salvo!' : 'Salvar configurações'}
          </button>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, suffix }: { label: string; value: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label className="text-sm text-base-text">{label}</label>
      <div className="flex items-center gap-1.5">
        <input
          type="number" value={value} onChange={(e) => onChange(Number(e.target.value))}
          className="w-24 rounded-lg border border-base-border bg-base-surface px-2.5 py-1.5 text-right text-sm outline-none focus:border-brand-500"
        />
        {suffix && <span className="text-xs text-base-muted">{suffix}</span>}
      </div>
    </div>
  );
}
