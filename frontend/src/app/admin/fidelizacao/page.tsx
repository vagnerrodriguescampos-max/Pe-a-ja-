'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAuthStore } from '@/stores/auth.store';
import { Save, Gift, Star, Megaphone, TrendingUp, Award } from 'lucide-react';
import toast from 'react-hot-toast';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

type Config = {
  cashback_percentual: number;
  meta_selos: number;
  recompensa_tipo: string;
  recompensa_valor: number;
  vip_prata_gasto: number;
  vip_ouro_gasto: number;
  vip_cashback_extra: number;
  ativo: boolean;
};

type Campanha = {
  tipo: string;
  mensagem: string;
  ativa: boolean;
  dias_sem_compra?: number;
};

type Stats = {
  clientes_com_carteira: number;
  saldo_total_emitido: number;
  total_recompensas_selos: number;
  campanhas_ativas: number;
};

const ABA_LABELS = [
  { id: 'cashback', label: 'Cashback', icon: TrendingUp },
  { id: 'selos', label: 'Selos', icon: Star },
  { id: 'vip', label: 'Clube VIP', icon: Gift },
  { id: 'marketing', label: 'Marketing', icon: Megaphone },
];

const CAMPANHA_DEFAULTS: Record<string, Campanha> = {
  recompra: {
    tipo: 'recompra',
    mensagem: 'Oi {nome}! Sentimos sua falta 😢 Que tal pedir um shawarma hoje? Temos novidades esperando por você! 🥙',
    ativa: false,
    dias_sem_compra: 7,
  },
  aniversario: {
    tipo: 'aniversario',
    mensagem: 'Feliz aniversário, {nome}! 🎂🎉 Para comemorar, você ganhou um desconto especial. Use no seu próximo pedido!',
    ativa: false,
  },
  boas_vindas: {
    tipo: 'boas_vindas',
    mensagem: 'Bem-vindo(a), {nome}! 🥙 Obrigado pelo seu primeiro pedido! Fique de olho na sua carteira — você já ganhou cashback!',
    ativa: true,
  },
};

export default function FidelizacaoPage() {
  const { token } = useAuthStore();
  const [aba, setAba] = useState('cashback');
  const [config, setConfig] = useState<Config>({
    cashback_percentual: 5, meta_selos: 10, recompensa_tipo: 'desconto',
    recompensa_valor: 10, vip_prata_gasto: 200, vip_ouro_gasto: 500,
    vip_cashback_extra: 2, ativo: true,
  });
  const [campanhas, setCampanhas] = useState<Record<string, Campanha>>(CAMPANHA_DEFAULTS);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  useEffect(() => {
    const load = async () => {
      const [r1, r2, r3] = await Promise.all([
        fetch(`${API}/admin/fidelizacao/config`, { headers }),
        fetch(`${API}/admin/fidelizacao/campanhas`, { headers }),
        fetch(`${API}/admin/fidelizacao/stats`, { headers }),
      ]);
      if (r1.ok) setConfig(await r1.json());
      if (r2.ok) {
        const list: Campanha[] = await r2.json();
        const map = { ...CAMPANHA_DEFAULTS };
        list.forEach(c => { map[c.tipo] = c; });
        setCampanhas(map);
      }
      if (r3.ok) setStats(await r3.json());
      setLoading(false);
    };
    load();
  }, [token]);

  const salvarConfig = async () => {
    const r = await fetch(`${API}/admin/fidelizacao/config`, {
      method: 'PATCH', headers, body: JSON.stringify(config),
    });
    if (r.ok) toast.success('Configurações salvas!');
    else toast.error('Erro ao salvar');
  };

  const salvarCampanha = async (tipo: string) => {
    const camp = campanhas[tipo];
    const r = await fetch(`${API}/admin/fidelizacao/campanhas/${tipo}`, {
      method: 'POST', headers, body: JSON.stringify(camp),
    });
    if (r.ok) toast.success('Campanha salva!');
    else toast.error('Erro ao salvar');
  };

  const fmtMoeda = (v: number) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  return (
    <AdminLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-page-title text-gray-900">Fidelização</h1>
          <p className="text-body text-gray-500 mt-0.5">Cashback, selos, clube VIP e marketing automático</p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Clientes com carteira', value: stats.clientes_com_carteira },
              { label: 'Saldo emitido', value: fmtMoeda(stats.saldo_total_emitido) },
              { label: 'Recompensas de selos', value: stats.total_recompensas_selos },
              { label: 'Campanhas ativas', value: stats.campanhas_ativas },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-sm text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Toggle ativo */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm mb-6 flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-800">Programa de fidelidade</p>
            <p className="text-sm text-gray-500">Ativa ou desativa cashback e selos</p>
          </div>
          <button onClick={() => setConfig(c => ({ ...c, ativo: !c.ativo }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.ativo ? 'bg-green-500' : 'bg-gray-300'}`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.ativo ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {/* Abas */}
        <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
          {ABA_LABELS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setAba(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${aba === id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--admin-accent)]" /></div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">

            {/* Cashback */}
            {aba === 'cashback' && (
              <div className="space-y-5">
                <h2 className="font-semibold text-gray-800 text-lg">Configurações de Cashback</h2>
                <p className="text-sm text-gray-500">O cashback é creditado automaticamente na carteira do cliente após a entrega do pedido.</p>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Percentual de cashback (%)</label>
                    <div className="relative">
                      <input type="number" min="0" max="50" step="0.5"
                        value={config.cashback_percentual}
                        onChange={e => setConfig(c => ({ ...c, cashback_percentual: parseFloat(e.target.value) }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 pr-8 focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/40" />
                      <span className="absolute right-3 top-2.5 text-gray-400 text-sm">%</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Ex: 5% → pedido de R$50 gera R$2,50 de cashback</p>
                  </div>
                </div>

                <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
                  <p className="text-sm font-medium text-orange-800">Como funciona</p>
                  <ul className="text-sm text-orange-700 mt-1 space-y-0.5 list-disc list-inside">
                    <li>Cashback é creditado quando o pedido é marcado como <strong>entregue</strong></li>
                    <li>O cliente pode usar o saldo no próximo checkout</li>
                    <li>Clientes VIP recebem cashback extra (configurado na aba VIP)</li>
                  </ul>
                </div>

                <button onClick={salvarConfig} className="flex items-center gap-2 btn-admin-primary py-2.5">
                  <Save size={16} />
                  Salvar configurações
                </button>
              </div>
            )}

            {/* Selos */}
            {aba === 'selos' && (
              <div className="space-y-5">
                <h2 className="font-semibold text-gray-800 text-lg">Cartão de Fidelidade (Selos)</h2>
                <p className="text-sm text-gray-500">O cliente ganha 1 selo por pedido entregue. Ao completar a meta, ganha uma recompensa.</p>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Meta de selos</label>
                    <input type="number" min="2" max="50"
                      value={config.meta_selos}
                      onChange={e => setConfig(c => ({ ...c, meta_selos: parseInt(e.target.value) }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/40" />
                    <p className="text-xs text-gray-400 mt-1">Quantos pedidos para ganhar a recompensa</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de recompensa</label>
                    <select value={config.recompensa_tipo}
                      onChange={e => setConfig(c => ({ ...c, recompensa_tipo: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/40">
                      <option value="desconto">Desconto em reais (na carteira)</option>
                      <option value="item_gratis">Item grátis (manual)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {config.recompensa_tipo === 'desconto' ? 'Valor do desconto (R$)' : 'Valor do item grátis (R$)'}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-gray-400 text-sm">R$</span>
                      <input type="number" min="0" step="0.5"
                        value={config.recompensa_valor}
                        onChange={e => setConfig(c => ({ ...c, recompensa_valor: parseFloat(e.target.value) }))}
                        className="w-full border border-gray-200 rounded-xl pl-8 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/40" />
                    </div>
                  </div>
                </div>

                {/* Preview visual do cartão */}
                <div className="bg-gradient-to-r from-[var(--admin-accent)] to-orange-500 rounded-2xl p-5 text-white">
                  <p className="text-sm font-medium opacity-80 mb-3">Preview — Cartão de Fidelidade</p>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: config.meta_selos }, (_, i) => (
                      <div key={i} className={`w-9 h-9 rounded-full border-2 flex items-center justify-center text-lg ${i < Math.ceil(config.meta_selos * 0.6) ? 'bg-white/30 border-white' : 'bg-white/10 border-white/40'}`}>
                        {i < Math.ceil(config.meta_selos * 0.6) && <Star className="w-4 h-4 fill-current" />}
                      </div>
                    ))}
                  </div>
                  <p className="text-sm mt-3 opacity-90">
                    A cada {config.meta_selos} pedidos → {config.recompensa_tipo === 'desconto' ? `R$ ${config.recompensa_valor} na carteira` : 'item grátis'}
                  </p>
                </div>

                <button onClick={salvarConfig} className="flex items-center gap-2 btn-admin-primary py-2.5">
                  <Save size={16} />
                  Salvar configurações
                </button>
              </div>
            )}

            {/* VIP */}
            {aba === 'vip' && (
              <div className="space-y-5">
                <h2 className="font-semibold text-gray-800 text-lg">Clube VIP</h2>
                <p className="text-sm text-gray-500">Clientes sobem de nível conforme o total gasto. VIP recebem cashback extra automaticamente.</p>

                <div className="grid gap-4">
                  {[
                    { nivel: 'Bronze', cor: 'text-amber-700', desc: 'Nível inicial — todos os clientes', fixed: true },
                    { nivel: 'Prata', cor: 'text-slate-400', field: 'vip_prata_gasto' as keyof Config },
                    { nivel: 'Ouro', cor: 'text-yellow-500', field: 'vip_ouro_gasto' as keyof Config },
                  ].map(({ nivel, cor, desc, fixed, field }) => (
                    <div key={nivel} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <Award className={`w-8 h-8 flex-shrink-0 ${cor}`} />
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800">{nivel}</p>
                        {fixed ? (
                          <p className="text-sm text-gray-500">{desc}</p>
                        ) : (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-gray-500">A partir de R$</span>
                            <input type="number" min="0" step="10"
                              value={Number(config[field!])}
                              onChange={e => setConfig(c => ({ ...c, [field!]: parseFloat(e.target.value) }))}
                              className="w-28 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/40" />
                            <span className="text-sm text-gray-500">em pedidos entregues</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cashback extra para VIP (%)</label>
                  <div className="relative w-40">
                    <input type="number" min="0" max="20" step="0.5"
                      value={config.vip_cashback_extra}
                      onChange={e => setConfig(c => ({ ...c, vip_cashback_extra: parseFloat(e.target.value) }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 pr-8 focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/40" />
                    <span className="absolute right-3 top-2.5 text-gray-400 text-sm">%</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Prata e Ouro ganham cashback normal + este extra</p>
                </div>

                <button onClick={salvarConfig} className="flex items-center gap-2 btn-admin-primary py-2.5">
                  <Save size={16} />
                  Salvar configurações
                </button>
              </div>
            )}

            {/* Marketing */}
            {aba === 'marketing' && (
              <div className="space-y-6">
                <h2 className="font-semibold text-gray-800 text-lg">Marketing Automático</h2>
                <p className="text-sm text-gray-500">Mensagens enviadas automaticamente via chat. Use <code className="bg-gray-100 px-1 rounded">{'{nome}'}</code> para personalizar.</p>

                {Object.entries(CAMPANHA_DEFAULTS).map(([tipo, defaults]) => {
                  const camp = campanhas[tipo] || defaults;
                  const LABELS: Record<string, { title: string; desc: string }> = {
                    recompra: { title: 'Recuperação de clientes', desc: 'Enviada para clientes que não pedem há alguns dias' },
                    aniversario: { title: 'Feliz aniversário', desc: 'Enviada no dia do aniversário do cliente' },
                    boas_vindas: { title: 'Boas-vindas', desc: 'Enviada após o primeiro pedido entregue' },
                  };
                  return (
                    <div key={tipo} className="border border-gray-200 rounded-2xl p-5">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-semibold text-gray-800">{LABELS[tipo]?.title}</p>
                          <p className="text-xs text-gray-500">{LABELS[tipo]?.desc}</p>
                        </div>
                        <button onClick={() => setCampanhas(prev => ({ ...prev, [tipo]: { ...camp, ativa: !camp.ativa } }))}
                          className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${camp.ativa ? 'bg-green-500' : 'bg-gray-300'}`}>
                          <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${camp.ativa ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>

                      {tipo === 'recompra' && (
                        <div className="mb-3">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Dias sem compra</label>
                          <input type="number" min="1" max="90"
                            value={camp.dias_sem_compra || 7}
                            onChange={e => setCampanhas(prev => ({ ...prev, [tipo]: { ...camp, dias_sem_compra: parseInt(e.target.value) } }))}
                            className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/40" />
                        </div>
                      )}

                      <label className="block text-xs font-medium text-gray-600 mb-1">Mensagem</label>
                      <textarea rows={3}
                        value={camp.mensagem}
                        onChange={e => setCampanhas(prev => ({ ...prev, [tipo]: { ...camp, mensagem: e.target.value } }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/40" />

                      <button onClick={() => salvarCampanha(tipo)}
                        className="mt-3 flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
                        <Save size={14} />
                        Salvar campanha
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
