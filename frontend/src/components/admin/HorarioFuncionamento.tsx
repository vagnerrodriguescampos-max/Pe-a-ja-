'use client';

import { useEffect, useState } from 'react';
import { Clock, Save, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminGetLoja, adminUpdateLoja } from '@/lib/api';
import { HorarioDia } from '@/types';

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function horariosPadrao(): HorarioDia[] {
  return Array.from({ length: 7 }, (_, dia_semana) => ({ dia_semana, fechado: false, abre: '08:00', fecha: '22:00' }));
}

export default function HorarioFuncionamento() {
  const [automatico, setAutomatico] = useState(false);
  const [horarios, setHorarios] = useState<HorarioDia[]>(horariosPadrao());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminGetLoja()
      .then(loja => {
        setAutomatico(Boolean(loja.horario_automatico));
        setHorarios(loja.horarios?.length === 7 ? loja.horarios : horariosPadrao());
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function atualizarDia(dia: number, campo: keyof HorarioDia, valor: string | boolean) {
    setHorarios(prev => prev.map(h => (h.dia_semana === dia ? { ...h, [campo]: valor } : h)));
  }

  async function salvar() {
    setSaving(true);
    try {
      await adminUpdateLoja({ horario_automatico: automatico, horarios });
      toast.success('Horário de funcionamento salvo!');
    } catch {
      toast.error('Erro ao salvar horário');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="card p-5 mb-4 flex items-center gap-2 text-sm text-gray-400">
        <Loader2 size={16} className="animate-spin" /> Carregando...
      </div>
    );
  }

  return (
    <div className="card p-5 mb-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock size={18} className="text-blue-600" />
          <h2 className="font-bold text-gray-700">Horário de funcionamento</h2>
        </div>
        <button onClick={() => setAutomatico(a => !a)} className="text-3xl">
          {automatico
            ? <ToggleRight size={36} className="text-blue-500" />
            : <ToggleLeft size={36} className="text-gray-300" />}
        </button>
      </div>

      {!automatico ? (
        <p className="text-xs text-gray-400">
          Desligado — você continua abrindo e fechando a loja manualmente pelo interruptor no topo desta página.
        </p>
      ) : (
        <>
          <p className="text-xs text-gray-400">
            A loja abre e fecha sozinha nos horários abaixo — o interruptor manual do topo passa a ser controlado automaticamente.
          </p>
          <div className="space-y-2">
            {horarios.map(h => (
              <div key={h.dia_semana} className="flex items-center gap-3">
                <span className="text-sm text-gray-700 w-24 flex-shrink-0">{DIAS[h.dia_semana]}</span>
                <label className="flex items-center gap-1.5 text-xs text-gray-500 flex-shrink-0">
                  <input type="checkbox" checked={h.fechado}
                    onChange={e => atualizarDia(h.dia_semana, 'fechado', e.target.checked)} />
                  Fechado
                </label>
                {!h.fechado && (
                  <>
                    <input type="time" value={h.abre} className="input py-1.5 text-sm"
                      onChange={e => atualizarDia(h.dia_semana, 'abre', e.target.value)} />
                    <span className="text-xs text-gray-400">até</span>
                    <input type="time" value={h.fecha} className="input py-1.5 text-sm"
                      onChange={e => atualizarDia(h.dia_semana, 'fecha', e.target.value)} />
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <button onClick={salvar} disabled={saving}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors">
        {saving ? <Loader2 size={16} className="animate-spin" /> : <><Save size={16} /> Salvar horário</>}
      </button>
    </div>
  );
}
