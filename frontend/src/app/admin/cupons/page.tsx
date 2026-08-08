'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import {
  adminListarCupons, adminCriarCupom, adminAtualizarCupom, adminRemoverCupom,
} from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import {
  Plus, Ticket, Pencil, Trash2, Cake, Sparkles, Users, Copy, CheckCircle2, XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

type Cupom = {
  id: string;
  codigo: string;
  descricao?: string;
  tipo_desconto: 'percentual' | 'valor';
  valor: number | string;
  desconto_maximo?: number | string | null;
  pedido_minimo: number | string;
  regra: 'geral' | 'primeira_compra' | 'aniversario';
  valido_de?: string | null;
  valido_ate?: string | null;
  limite_uso_total?: number | null;
  limite_uso_por_cliente: number;
  usos: number;
  ativo: boolean;
};

const REGRAS = [
  {
    valor: 'geral' as const,
    label: 'Qualquer cliente',
    icone: Ticket,
    ajuda: 'Vale para todo mundo que digitar o código.',
  },
  {
    valor: 'primeira_compra' as const,
    label: 'Primeira compra',
    icone: Sparkles,
    ajuda: 'Só para quem nunca pediu na sua loja. Ótimo para converter quem chegou pelo Instagram.',
  },
  {
    valor: 'aniversario' as const,
    label: 'Aniversário',
    icone: Cake,
    ajuda: 'Vale na semana do aniversário do cliente. Precisa que ele tenha informado a data no pedido.',
  },
];

/** Sugestões prontas: tirar o "o que eu ofereço?" da frente de quem nunca fez promoção. */
const MODELOS = [
  {
    nome: 'Primeira compra 15%',
    dados: {
      codigo: 'BEMVINDO15', descricao: 'Desconto de boas-vindas',
      tipo_desconto: 'percentual' as const, valor: 15, desconto_maximo: 20,
      pedido_minimo: 30, regra: 'primeira_compra' as const, limite_uso_por_cliente: 1,
    },
  },
  {
    nome: 'Aniversário R$ 20',
    dados: {
      codigo: 'ANIVERSARIO', descricao: 'Presente de aniversário',
      tipo_desconto: 'valor' as const, valor: 20,
      pedido_minimo: 40, regra: 'aniversario' as const, limite_uso_por_cliente: 1,
    },
  },
  {
    nome: 'Frete-almoço 10%',
    dados: {
      codigo: 'ALMOCO10', descricao: 'Promoção do almoço',
      tipo_desconto: 'percentual' as const, valor: 10, desconto_maximo: 15,
      pedido_minimo: 25, regra: 'geral' as const, limite_uso_por_cliente: 3,
    },
  },
];

const FORM_VAZIO = {
  codigo: '', descricao: '', tipo_desconto: 'percentual' as 'percentual' | 'valor',
  valor: '' as any, desconto_maximo: '' as any, pedido_minimo: '' as any,
  regra: 'geral' as Cupom['regra'], valido_de: '', valido_ate: '',
  limite_uso_total: '' as any, limite_uso_por_cliente: 1 as any, ativo: true,
};

export default function CuponsPage() {
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ aberto: boolean; editando?: Cupom }>({ aberto: false });
  const [form, setForm] = useState({ ...FORM_VAZIO });
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    try { setCupons(await adminListarCupons()); }
    catch { toast.error('Erro ao carregar cupons'); }
  }

  useEffect(() => { carregar().finally(() => setLoading(false)); }, []);

  function abrirNovo(modelo?: typeof MODELOS[number]['dados']) {
    setForm({ ...FORM_VAZIO, ...(modelo || {}) } as any);
    setModal({ aberto: true });
  }

  function abrirEdicao(cupom: Cupom) {
    setForm({
      codigo: cupom.codigo,
      descricao: cupom.descricao || '',
      tipo_desconto: cupom.tipo_desconto,
      valor: Number(cupom.valor),
      desconto_maximo: cupom.desconto_maximo != null ? Number(cupom.desconto_maximo) : '',
      pedido_minimo: Number(cupom.pedido_minimo) || '',
      regra: cupom.regra,
      valido_de: cupom.valido_de || '',
      valido_ate: cupom.valido_ate || '',
      limite_uso_total: cupom.limite_uso_total ?? '',
      limite_uso_por_cliente: cupom.limite_uso_por_cliente,
      ativo: cupom.ativo,
    } as any);
    setModal({ aberto: true, editando: cupom });
  }

  async function salvar() {
    if (!form.codigo.trim()) return toast.error('Informe o código do cupom');
    if (!form.valor || Number(form.valor) <= 0) return toast.error('Informe o valor do desconto');

    // Campos numéricos vazios viram null/omitidos — mandar "" faria a validação do
    // backend recusar por tipo.
    const payload: any = {
      codigo: form.codigo.trim().toUpperCase(),
      descricao: form.descricao.trim() || undefined,
      tipo_desconto: form.tipo_desconto,
      valor: Number(form.valor),
      regra: form.regra,
      limite_uso_por_cliente: Number(form.limite_uso_por_cliente) || 1,
      ativo: form.ativo,
    };
    if (form.desconto_maximo !== '' && form.tipo_desconto === 'percentual') {
      payload.desconto_maximo = Number(form.desconto_maximo);
    }
    if (form.pedido_minimo !== '') payload.pedido_minimo = Number(form.pedido_minimo);
    if (form.valido_de) payload.valido_de = form.valido_de;
    if (form.valido_ate) payload.valido_ate = form.valido_ate;
    if (form.limite_uso_total !== '') payload.limite_uso_total = Number(form.limite_uso_total);

    setSalvando(true);
    try {
      if (modal.editando) {
        await adminAtualizarCupom(modal.editando.id, payload);
        toast.success('Cupom atualizado!');
      } else {
        await adminCriarCupom(payload);
        toast.success('Cupom criado!');
      }
      setModal({ aberto: false });
      carregar();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erro ao salvar cupom');
    } finally {
      setSalvando(false);
    }
  }

  async function desativar(cupom: Cupom) {
    if (!confirm(`Desativar o cupom ${cupom.codigo}? Ele para de funcionar imediatamente.`)) return;
    try {
      await adminRemoverCupom(cupom.id);
      toast.success('Cupom desativado');
      carregar();
    } catch { toast.error('Erro ao desativar cupom'); }
  }

  function copiar(codigo: string) {
    navigator.clipboard.writeText(codigo);
    toast.success(`Código ${codigo} copiado!`);
  }

  const descontoLegivel = (c: Cupom) =>
    c.tipo_desconto === 'percentual'
      ? `${Number(c.valor)}%${c.desconto_maximo ? ` (até ${formatCurrency(Number(c.desconto_maximo))})` : ''}`
      : formatCurrency(Number(c.valor));

  if (loading) return (
    <AdminLayout>
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-gray-200 border-t-[var(--admin-accent)] rounded-full" />
      </div>
    </AdminLayout>
  );

  return (
    <AdminLayout>
      <div className="px-4 md:px-6 pt-3 md:pt-5 pb-6 max-w-4xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-page-title text-gray-900">Cupons</h1>
            <p className="text-sm text-gray-400 mt-0.5">Descontos para atrair e trazer o cliente de volta</p>
          </div>
          <button onClick={() => abrirNovo()} className="btn-admin-primary flex items-center gap-2 text-sm py-2.5 px-4">
            <Plus size={16} /> Novo cupom
          </button>
        </div>

        {cupons.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8">
            <div className="text-center mb-6">
              <Ticket size={32} className="mx-auto text-gray-300 mb-3" />
              <p className="font-semibold text-gray-700">Nenhum cupom criado ainda</p>
              <p className="text-sm text-gray-400 mt-1">
                Comece por um destes modelos — depois é só ajustar o que quiser.
              </p>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              {MODELOS.map(m => (
                <button key={m.nome} onClick={() => abrirNovo(m.dados)}
                  className="text-left border border-gray-200 rounded-xl p-3 hover:border-[var(--admin-accent)] transition-colors">
                  <p className="font-semibold text-sm text-gray-800">{m.nome}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{m.dados.codigo}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {cupons.map(c => {
              const regra = REGRAS.find(r => r.valor === c.regra)!;
              const Icone = regra.icone;
              const esgotado = c.limite_uso_total != null && c.usos >= c.limite_uso_total;
              return (
                <div key={c.id} className={`card p-4 ${!c.ativo ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => copiar(c.codigo)}
                          className="font-bold text-gray-900 inline-flex items-center gap-1.5 hover:text-[var(--admin-accent)] transition-colors">
                          {c.codigo} <Copy size={12} />
                        </button>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--admin-accent-soft)] text-[var(--admin-accent)] inline-flex items-center gap-1">
                          <Icone size={11} /> {regra.label}
                        </span>
                        {c.ativo ? (
                          <span className="text-xs text-green-600 inline-flex items-center gap-1">
                            <CheckCircle2 size={11} /> Ativo
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 inline-flex items-center gap-1">
                            <XCircle size={11} /> Inativo
                          </span>
                        )}
                        {esgotado && <span className="text-xs text-yellow-600">esgotado</span>}
                      </div>

                      {c.descricao && <p className="text-sm text-gray-500 mt-1">{c.descricao}</p>}

                      <p className="text-sm text-gray-700 mt-1.5 font-medium">
                        {descontoLegivel(c)} de desconto
                        {Number(c.pedido_minimo) > 0 && (
                          <span className="text-gray-400 font-normal"> · mínimo {formatCurrency(Number(c.pedido_minimo))}</span>
                        )}
                      </p>

                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-3 flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <Users size={11} /> {c.usos} uso(s)
                          {c.limite_uso_total != null && ` de ${c.limite_uso_total}`}
                        </span>
                        {c.valido_ate && <span>válido até {new Date(c.valido_ate + 'T12:00:00').toLocaleDateString('pt-BR')}</span>}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => abrirEdicao(c)}
                        className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
                        <Pencil size={15} />
                      </button>
                      {c.ativo && (
                        <button onClick={() => desativar(c)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modal.aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={e => e.target === e.currentTarget && setModal({ aberto: false })}>
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl max-h-[88vh] flex flex-col">
            <div className="px-6 pt-6 pb-3">
              <h2 className="font-bold text-gray-900 text-lg">
                {modal.editando ? `Editar ${modal.editando.codigo}` : 'Novo cupom'}
              </h2>
            </div>

            <div className="overflow-y-auto px-6 py-2 space-y-4 flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Código do cupom</label>
                <input value={form.codigo}
                  onChange={e => setForm(f => ({ ...f, codigo: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') }))}
                  placeholder="BEMVINDO15" className="input font-mono" maxLength={30} />
                <p className="text-xs text-gray-400 mt-1">É o que o cliente digita no checkout. Sem espaços ou acentos.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição (opcional)</label>
                <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  placeholder="Desconto de boas-vindas" className="input" maxLength={150} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Quem pode usar</label>
                <div className="space-y-2">
                  {REGRAS.map(r => {
                    const Icone = r.icone;
                    const ativo = form.regra === r.valor;
                    return (
                      <button key={r.valor} type="button"
                        onClick={() => setForm(f => ({ ...f, regra: r.valor }))}
                        className={`w-full text-left border rounded-xl p-3 transition-colors ${
                          ativo ? 'border-[var(--admin-accent)] bg-[var(--admin-accent-soft)]' : 'border-gray-200 hover:border-gray-300'
                        }`}>
                        <span className={`font-medium text-sm inline-flex items-center gap-2 ${ativo ? 'text-[var(--admin-accent)]' : 'text-gray-800'}`}>
                          <Icone size={14} /> {r.label}
                        </span>
                        <p className="text-xs text-gray-400 mt-0.5">{r.ajuda}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select value={form.tipo_desconto}
                    onChange={e => setForm(f => ({ ...f, tipo_desconto: e.target.value as any }))}
                    className="input">
                    <option value="percentual">Percentual (%)</option>
                    <option value="valor">Valor fixo (R$)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {form.tipo_desconto === 'percentual' ? 'Desconto (%)' : 'Desconto (R$)'}
                  </label>
                  <input type="number" min="0" step="0.01" value={form.valor}
                    onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                    className="input" />
                </div>
              </div>

              {form.tipo_desconto === 'percentual' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Desconto máximo (R$) — opcional</label>
                  <input type="number" min="0" step="0.01" value={form.desconto_maximo}
                    onChange={e => setForm(f => ({ ...f, desconto_maximo: e.target.value }))}
                    placeholder="Ex: 20.00" className="input" />
                  <p className="text-xs text-gray-400 mt-1">
                    Teto de segurança: sem ele, 20% de um pedido grande pode virar prejuízo.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pedido mínimo (R$) — opcional</label>
                <input type="number" min="0" step="0.01" value={form.pedido_minimo}
                  onChange={e => setForm(f => ({ ...f, pedido_minimo: e.target.value }))}
                  placeholder="Ex: 30.00" className="input" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Válido de</label>
                  <input type="date" value={form.valido_de}
                    onChange={e => setForm(f => ({ ...f, valido_de: e.target.value }))} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Válido até</label>
                  <input type="date" value={form.valido_ate}
                    onChange={e => setForm(f => ({ ...f, valido_ate: e.target.value }))} className="input" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Limite total de usos</label>
                  <input type="number" min="1" value={form.limite_uso_total}
                    onChange={e => setForm(f => ({ ...f, limite_uso_total: e.target.value }))}
                    placeholder="Ilimitado" className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Usos por cliente</label>
                  <input type="number" min="1" value={form.limite_uso_por_cliente}
                    onChange={e => setForm(f => ({ ...f, limite_uso_por_cliente: e.target.value }))}
                    className="input" />
                </div>
              </div>

              {modal.editando && (
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={form.ativo}
                    onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))}
                    className="accent-[var(--admin-accent)]" />
                  Cupom ativo
                </label>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-2">
              <button onClick={() => setModal({ aberto: false })}
                className="flex-1 py-3 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={salvar} disabled={salvando} className="btn-admin-primary flex-1 py-3">
                {salvando ? 'Salvando...' : modal.editando ? 'Salvar alterações' : 'Criar cupom'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
