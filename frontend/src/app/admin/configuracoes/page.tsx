'use client';

import { useEffect, useRef, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { adminGetLoja, adminUpdateLoja } from '@/lib/api';
import { Loja } from '@/types';
import { Save, ToggleLeft, ToggleRight, ExternalLink, Bot, Link2, CheckCircle, XCircle, Loader2, AlertTriangle, Image as ImageIcon, Video } from 'lucide-react';
import ImageUpload from '@/components/ImageUpload';
import WhatsAppConnect from '@/components/admin/WhatsAppConnect';
import HorarioFuncionamento from '@/components/admin/HorarioFuncionamento';
import { adminGetConfigIA, adminUpdateConfigIA } from '@/lib/api';
import { buscarCep, cepCompleto, formatarCep } from '@/lib/cep';
import toast from 'react-hot-toast';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type SlugStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'same';

export default function ConfiguracoesPage() {
  const [loja, setLoja] = useState<Loja | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Loja>>({});
  const [configIA, setConfigIA] = useState<any>({ habilitada: false, nome_ia: 'Assistente', sistema_prompt_extra: '', delay_resposta_seg: 3 });
  const [savingIA, setSavingIA] = useState(false);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle');
  const [buscandoCep, setBuscandoCep] = useState(false);
  const slugCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([
      adminGetLoja().then(data => { setLoja(data); setForm(data); }),
      adminGetConfigIA().then(setConfigIA).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  function set(key: keyof Loja, value: any) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  // Mesmo comportamento do checkout do cliente: completou o CEP, o endereço vem pronto.
  async function aoDigitarCep(valor: string) {
    const formatado = formatarCep(valor);
    set('cep', formatado);
    if (!cepCompleto(formatado)) return;

    setBuscandoCep(true);
    const encontrado = await buscarCep(formatado);
    setBuscandoCep(false);

    if (!encontrado) {
      toast.error('CEP não encontrado — preencha o endereço manualmente');
      return;
    }
    setForm(prev => ({
      ...prev,
      cep: encontrado.cep,
      // O logradouro do ViaCEP não traz número; preservamos o que já estava digitado
      // se o dono da loja tiver escrito "Rua X, 210" à mão.
      endereco: encontrado.logradouro || prev.endereco || '',
      bairro: encontrado.bairro || prev.bairro || '',
      cidade: encontrado.cidade,
      estado: encontrado.estado,
    }));
  }

  function handleSlugChange(val: string) {
    const clean = val.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').slice(0, 50);
    set('slug', clean);

    if (clean === loja?.slug) { setSlugStatus('same'); return; }
    if (!clean || clean.length < 3 || !/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(clean)) {
      setSlugStatus(clean.length > 0 ? 'invalid' : 'idle'); return;
    }
    setSlugStatus('checking');
    if (slugCheckRef.current) clearTimeout(slugCheckRef.current);
    slugCheckRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`${API}/auth/verificar-slug/${clean}`);
        const data = await r.json();
        setSlugStatus(data.disponivel ? 'available' : 'taken');
      } catch { setSlugStatus('idle'); }
    }, 500);
  }

  async function salvar() {
    setSaving(true);
    try {
      const updated = await adminUpdateLoja(form);
      setLoja(updated);
      setForm(updated);
      toast.success('Configurações salvas!');
    } catch { toast.error('Erro ao salvar'); }
    finally { setSaving(false); }
  }

  async function salvarIA() {
    setSavingIA(true);
    try {
      const updated = await adminUpdateConfigIA(configIA);
      setConfigIA(updated);
      toast.success('Configurações de IA salvas!');
    } catch { toast.error('Erro ao salvar'); }
    finally { setSavingIA(false); }
  }

  async function toggleAberta() {
    setSaving(true);
    try {
      const updated = await adminUpdateLoja({ aberta: !form.aberta });
      setLoja(updated);
      setForm(prev => ({ ...prev, aberta: updated.aberta }));
      toast.success(updated.aberta ? 'Loja aberta!' : 'Loja fechada');
    } catch { toast.error('Erro'); }
    finally { setSaving(false); }
  }

  if (loading) return (
    <AdminLayout>
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-gray-200 border-t-[var(--admin-accent)] rounded-full" />
      </div>
    </AdminLayout>
  );

  if (!loja) return null;

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-page-title text-gray-900">Configurações da Loja</h1>
          <a href={`/loja/${loja.slug}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-[var(--admin-accent)] font-medium hover:underline">
            <ExternalLink size={14} /> Ver cardápio
          </a>
        </div>

        {/* Status da loja */}
        <div className="card p-5 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-800">Status da loja</p>
              <p className="text-sm text-gray-400 mt-0.5 inline-flex items-center gap-1.5">
                {form.aberta
                  ? <><CheckCircle size={14} className="text-green-500" /> Aceitando pedidos</>
                  : <><XCircle size={14} className="text-red-500" /> Loja fechada — pedidos bloqueados</>}
              </p>
            </div>
            <button onClick={toggleAberta} disabled={saving}
              className={`text-3xl transition-opacity ${saving ? 'opacity-50' : ''}`}>
              {form.aberta
                ? <ToggleRight size={40} className="text-green-500" />
                : <ToggleLeft size={40} className="text-gray-300" />
              }
            </button>
          </div>
        </div>

        {/* Dados da loja */}
        <div className="card p-5 mb-4 space-y-4">
          <h2 className="text-section-title text-gray-700">Informações</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome da loja</label>
            <input value={form.nome || ''} onChange={e => set('nome', e.target.value)} className="input" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
              <Link2 size={14} /> Link do cardápio
            </label>
            <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[var(--admin-accent)]">
              <span className="text-xs text-gray-400 px-3 py-2.5 bg-gray-50 border-r border-gray-200 font-mono whitespace-nowrap">
                /loja/
              </span>
              <input
                value={form.slug || ''}
                onChange={e => handleSlugChange(e.target.value)}
                className="flex-1 px-3 py-2.5 text-sm font-mono focus:outline-none"
              />
              <span className="pr-3 flex items-center">
                {slugStatus === 'checking' && <Loader2 size={14} className="text-gray-400 animate-spin" />}
                {slugStatus === 'available' && <CheckCircle size={14} className="text-green-500" />}
                {slugStatus === 'taken' && <XCircle size={14} className="text-red-500" />}
                {slugStatus === 'invalid' && <XCircle size={14} className="text-red-500" />}
                {slugStatus === 'same' && <CheckCircle size={14} className="text-gray-300" />}
              </span>
            </div>
            {slugStatus === 'available' && <p className="text-xs text-green-600 mt-1">Link disponível!</p>}
            {slugStatus === 'taken' && <p className="text-xs text-red-500 mt-1">Este link já está em uso.</p>}
            {slugStatus === 'invalid' && <p className="text-xs text-red-500 mt-1">Use letras minúsculas, números e hífens (mín. 3 caracteres)</p>}
            {slugStatus === 'same' && <p className="text-xs text-gray-400 mt-1">Link atual da loja</p>}
            {(slugStatus === 'available') && (
              <p className="text-xs text-amber-500 mt-0.5 inline-flex items-center gap-1.5">
                <AlertTriangle size={12} /> Alterar o link irá quebrar links antigos compartilhados
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefone / WhatsApp</label>
            <input value={form.telefone || ''} onChange={e => set('telefone', e.target.value)} className="input" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
            <div className="relative">
              <input value={form.cep || ''} onChange={e => aoDigitarCep(e.target.value)}
                placeholder="00000-000" inputMode="numeric" maxLength={9} className="input" />
              {buscandoCep && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-gray-200 border-t-[var(--admin-accent)] rounded-full animate-spin" />
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Preencha o CEP e o restante do endereço vem automático.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Endereço (rua e número)</label>
            <input value={form.endereco || ''} onChange={e => set('endereco', e.target.value)}
              placeholder="Rua Exemplo, 210" className="input" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bairro</label>
            <input value={form.bairro || ''} onChange={e => set('bairro', e.target.value)} className="input" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
              <input value={form.cidade || ''} onChange={e => set('cidade', e.target.value)} className="input" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">UF</label>
              <input value={form.estado || ''} maxLength={2}
                onChange={e => set('estado', e.target.value.toUpperCase().slice(0, 2))} className="input" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem do topo (banner)</label>
            <textarea value={form.mensagem_topo || ''} onChange={e => set('mensagem_topo', e.target.value)}
              className="input resize-none h-20" placeholder="Ex: Frete grátis acima de R$ 50!" />
          </div>
          <div>
            <ImageUpload
              label="Logo da loja"
              value={form.logo_url || ''}
              onChange={url => set('logo_url', url)}
              previewSize={72}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Banner do topo (foto ou vídeo até 10s)</label>
            <div className="flex gap-2 mb-2">
              {(['imagem', 'video'] as const).map(tipo => (
                <button key={tipo} type="button"
                  onClick={() => set('banner_tipo', tipo)}
                  className={`px-4 py-1.5 rounded-xl text-xs font-semibold border transition-colors inline-flex items-center gap-1.5 ${
                    (form.banner_tipo || 'imagem') === tipo
                      ? 'bg-[var(--admin-accent)] text-white border-[var(--admin-accent)]'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}>
                  {tipo === 'imagem' ? <><ImageIcon size={13} /> Foto</> : <><Video size={13} /> Vídeo</>}
                </button>
              ))}
            </div>
            <ImageUpload
              value={form.banner_url || ''}
              onChange={url => set('banner_url', url)}
              previewSize={80}
            />
            <p className="text-xs text-gray-400 mt-1">Aparece como banner principal no topo do cardápio</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cor principal (hex)</label>
            <div className="flex gap-3 items-center">
              <input type="color" value={form.cor_primaria || '#E63946'}
                onChange={e => set('cor_primaria', e.target.value)}
                className="w-12 h-10 rounded-lg border border-gray-200 cursor-pointer p-1" />
              <input value={form.cor_primaria || ''} onChange={e => set('cor_primaria', e.target.value)}
                className="input flex-1" placeholder="#E63946" maxLength={7} />
            </div>
          </div>
        </div>

        {/* Entrega */}
        <div className="card p-5 mb-4 space-y-4">
          <h2 className="text-section-title text-gray-700">Entrega</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prazo médio (min)</label>
              <input value={form.prazo_medio_min || ''} onChange={e => set('prazo_medio_min', parseInt(e.target.value))}
                className="input" type="number" min="1" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Taxa de entrega (R$)</label>
              <input value={form.taxa_entrega_padrao || ''} onChange={e => set('taxa_entrega_padrao', parseFloat(e.target.value))}
                className="input" type="number" min="0" step="0.01" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pedido mínimo (R$)</label>
            <input value={form.pedido_minimo || ''} onChange={e => set('pedido_minimo', parseFloat(e.target.value))}
              className="input" type="number" min="0" step="0.01" />
          </div>
        </div>

        {/* PIX */}
        <div className="card p-5 mb-6 space-y-4">
          <h2 className="text-section-title text-gray-700">Chave PIX</h2>
          <p className="text-xs text-gray-400">Aparece automaticamente para clientes que escolherem PIX no checkout</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo da chave</label>
            <select value={form.tipo_chave_pix || ''} onChange={e => set('tipo_chave_pix', e.target.value)} className="input">
              <option value="">Selecione...</option>
              <option value="cpf">CPF</option>
              <option value="cnpj">CNPJ</option>
              <option value="email">E-mail</option>
              <option value="telefone">Telefone</option>
              <option value="aleatoria">Chave aleatória</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chave PIX</label>
            <input value={form.chave_pix || ''} onChange={e => set('chave_pix', e.target.value)}
              className="input font-mono" placeholder="Sua chave PIX" />
          </div>
        </div>

        <HorarioFuncionamento />
        <WhatsAppConnect />

        <button onClick={salvar} disabled={saving}
          className="btn-admin-primary w-full flex items-center justify-center gap-2 py-4">
          {saving ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <><Save size={18} /> Salvar configurações</>
          )}
        </button>

        {/* Agente de IA */}
        <div className="card p-5 mt-6 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Bot size={18} className="text-purple-600" />
            <h2 className="text-section-title text-gray-700">Agente de IA no Chat</h2>
          </div>
          <p className="text-xs text-gray-400">Responde automaticamente aos clientes no chat com base no seu cardápio. Requer ANTHROPIC_API_KEY configurada no servidor.</p>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Habilitar agente</span>
            <button onClick={() => setConfigIA((c: any) => ({ ...c, habilitada: !c.habilitada }))}
              className="text-3xl">
              {configIA.habilitada
                ? <ToggleRight size={36} className="text-purple-500" />
                : <ToggleLeft size={36} className="text-gray-300" />}
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome do assistente</label>
            <input value={configIA.nome_ia || ''} onChange={e => setConfigIA((c: any) => ({ ...c, nome_ia: e.target.value }))}
              className="input" placeholder="Ex: Nanda, Assistente, Chef Bot..." />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Instrução extra (opcional)</label>
            <textarea value={configIA.sistema_prompt_extra || ''}
              onChange={e => setConfigIA((c: any) => ({ ...c, sistema_prompt_extra: e.target.value }))}
              className="input resize-none h-24"
              placeholder="Ex: Sempre sugira o prato do dia. Seja simpático e use emojis." />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Delay da resposta (segundos)</label>
            <input type="number" min={1} max={30} value={configIA.delay_resposta_seg || 3}
              onChange={e => setConfigIA((c: any) => ({ ...c, delay_resposta_seg: parseInt(e.target.value) }))}
              className="input w-24" />
            <p className="text-xs text-gray-400 mt-1">Simula o "digitando..." antes de responder</p>
          </div>

          <button onClick={salvarIA} disabled={savingIA}
            className="btn-admin-primary w-full flex items-center justify-center gap-2">
            {savingIA
              ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <><Save size={16} /> Salvar configurações de IA</>}
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}
