'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAuthStore } from '@/stores/auth.store';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { TrendingUp, ShoppingBag, Users, AlertCircle } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
const CORES_PIZZA = ['#ff6a45', '#f4a259', '#7fb98f', '#60a5fa', '#a878f0'];

type Resumo = { total_pedidos: number; receita_total: number; ticket_medio: number; cancelados: number };
type PorDia = { dia: string; pedidos: number; receita: number };
type PorPagamento = { forma: string; pedidos: number; receita: number };
type Produto = { nome: string; quantidade: number; receita: number };
type HeatCell = { dia_semana: number; hora: number; pedidos: number };

const FORMA_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro', pix: 'PIX', debito: 'Débito', credito: 'Crédito',
};

export default function DashboardPage() {
  const { token } = useAuthStore();
  const [dias, setDias] = useState(30);
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [porDia, setPorDia] = useState<PorDia[]>([]);
  const [porPagamento, setPorPagamento] = useState<PorPagamento[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [heatmap, setHeatmap] = useState<HeatCell[]>([]);
  const [loading, setLoading] = useState(true);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [r1, r2, r3, r4, r5] = await Promise.all([
        fetch(`${API}/admin/relatorios/resumo?dias=${dias}`, { headers }),
        fetch(`${API}/admin/relatorios/receita-por-dia?dias=${dias}`, { headers }),
        fetch(`${API}/admin/relatorios/por-pagamento?dias=${dias}`, { headers }),
        fetch(`${API}/admin/relatorios/produtos-mais-vendidos?dias=${dias}`, { headers }),
        fetch(`${API}/admin/relatorios/heatmap?dias=${dias}`, { headers }),
      ]);
      if (r1.ok) setResumo(await r1.json());
      if (r2.ok) setPorDia(await r2.json());
      if (r3.ok) setPorPagamento(await r3.json());
      if (r4.ok) setProdutos(await r4.json());
      if (r5.ok) setHeatmap(await r5.json());
      setLoading(false);
    };
    load();
  }, [dias, token]);

  const fmtMoeda = (v: number) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  const heatmapMatrix = Array.from({ length: 7 }, (_, dia) =>
    Array.from({ length: 24 }, (_, hora) => {
      const c = heatmap.find(h => h.dia_semana === dia && h.hora === hora);
      return c?.pedidos || 0;
    })
  );
  const maxHeat = Math.max(...heatmap.map(h => h.pedidos), 1);

  const porDiaFormatado = porDia.map(d => ({
    ...d,
    // d.dia vem como 'YYYY-MM-DD' da API, mas pega só os 10 primeiros caracteres
    // por segurança caso algum dia volte como datetime ISO completo.
    dia: new Date(`${d.dia.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
  }));

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-500 text-sm mt-0.5">Resumo de vendas e desempenho</p>
          </div>
          <select value={dias} onChange={e => setDias(parseInt(e.target.value))}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 bg-white">
            <option value={7}>Últimos 7 dias</option>
            <option value={30}>Últimos 30 dias</option>
            <option value={90}>Últimos 90 dias</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500" />
          </div>
        ) : (
          <>
            {/* Cards de resumo */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Receita total', value: fmtMoeda(resumo?.receita_total || 0), icon: TrendingUp, cor: 'text-green-600', bg: 'bg-green-50' },
                { label: 'Total de pedidos', value: resumo?.total_pedidos || 0, icon: ShoppingBag, cor: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Ticket médio', value: fmtMoeda(resumo?.ticket_medio || 0), icon: Users, cor: 'text-purple-600', bg: 'bg-purple-50' },
                { label: 'Cancelados', value: resumo?.cancelados || 0, icon: AlertCircle, cor: 'text-red-600', bg: 'bg-red-50' },
              ].map(({ label, value, icon: Icon, cor, bg }) => (
                <div key={label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mb-3`}>
                    <Icon size={20} className={cor} />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{value}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Receita por dia */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
              <h2 className="font-semibold text-gray-800 mb-4">Receita por dia</h2>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={porDiaFormatado}>
                  <defs>
                    <linearGradient id="receitaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ff6a45" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ff6a45" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="dia" tick={{ fontSize: 11, fill: '#b3a996' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#b3a996' }} tickFormatter={v => `R$${v}`} />
                  <Tooltip formatter={(v: number) => fmtMoeda(v)} labelStyle={{ fontWeight: 600 }} />
                  <Area type="monotone" dataKey="receita" stroke="#ff6a45" fill="url(#receitaGrad)" strokeWidth={2} name="Receita" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="grid lg:grid-cols-2 gap-6 mb-6">
              {/* Forma de pagamento */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h2 className="font-semibold text-gray-800 mb-4">Por forma de pagamento</h2>
                {porPagamento.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-8">Sem dados</p>
                ) : (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width="50%" height={180}>
                      <PieChart>
                        <Pie data={porPagamento} dataKey="receita" nameKey="forma" cx="50%" cy="50%" outerRadius={70} label={false}>
                          {porPagamento.map((_, i) => <Cell key={i} fill={CORES_PIZZA[i % CORES_PIZZA.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => fmtMoeda(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-2">
                      {porPagamento.map((p, i) => (
                        <div key={p.forma} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: CORES_PIZZA[i % CORES_PIZZA.length] }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-700">{FORMA_LABELS[p.forma] || p.forma}</p>
                            <p className="text-xs text-gray-400">{p.pedidos} pedidos · {fmtMoeda(p.receita)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Top produtos */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h2 className="font-semibold text-gray-800 mb-4">Produtos mais vendidos</h2>
                {produtos.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-8">Sem dados</p>
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={produtos.slice(0, 5)} layout="vertical" margin={{ left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: '#b3a996' }} />
                      <YAxis type="category" dataKey="nome" tick={{ fontSize: 11, fill: '#b3a996' }} width={100} />
                      <Tooltip formatter={(v: number) => [`${v} und`, 'Quantidade']} />
                      <Bar dataKey="quantidade" fill="#ff6a45" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Heatmap de horários */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <h2 className="font-semibold text-gray-800 mb-4">Pico de pedidos por horário</h2>
              <div className="overflow-x-auto">
                <div className="min-w-max">
                  {/* Horas header */}
                  <div className="flex items-center gap-1 mb-1 pl-10">
                    {Array.from({ length: 24 }, (_, h) => (
                      <div key={h} className="w-7 text-center text-xs text-gray-400">{h}h</div>
                    ))}
                  </div>
                  {heatmapMatrix.map((row, dia) => (
                    <div key={dia} className="flex items-center gap-1 mb-1">
                      <div className="w-9 text-xs text-gray-500 text-right pr-1">{DIAS_SEMANA[dia]}</div>
                      {row.map((val, hora) => {
                        const intensity = val / maxHeat;
                        const bg = val === 0
                          ? '#201d16'
                          : `rgba(255, 106, 69, ${Math.max(0.15, intensity)})`;
                        return (
                          <div key={hora} title={`${val} pedidos às ${hora}h`}
                            className="w-7 h-7 rounded flex items-center justify-center text-xs transition-colors"
                            style={{ backgroundColor: bg, color: intensity > 0.5 ? 'white' : '#b3a996' }}>
                            {val > 0 ? val : ''}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  <div className="flex items-center gap-2 mt-3 pl-10">
                    <span className="text-xs text-gray-400">Menos</span>
                    {[0, 0.2, 0.4, 0.6, 0.8, 1].map(v => (
                      <div key={v} className="w-5 h-5 rounded" style={{ backgroundColor: v === 0 ? '#201d16' : `rgba(255, 106, 69, ${v})` }} />
                    ))}
                    <span className="text-xs text-gray-400">Mais</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
