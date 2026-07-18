'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAuthStore } from '@/stores/auth.store';
import { adminListarUsuarios, adminCriarUsuario, adminAtualizarUsuario, adminRemoverUsuario } from '@/lib/api';
import { UserCog, Plus, Pencil, Trash2, ShieldCheck, Headset, Bike, X } from 'lucide-react';
import toast from 'react-hot-toast';

type Usuario = {
  id: string;
  nome: string;
  email: string;
  papel: string;
  ativo: boolean;
  criado_em: string;
};

const PAPEIS: Record<string, { label: string; desc: string; icon: any; cor: string }> = {
  admin_loja: { label: 'Administrador', desc: 'Acesso total ao painel', icon: ShieldCheck, cor: 'bg-red-100 text-red-700' },
  atendente: { label: 'Atendente', desc: 'Pedidos, chat e cardápio', icon: Headset, cor: 'bg-blue-100 text-blue-700' },
  motoboy: { label: 'Motoboy', desc: 'App de entregas com GPS', icon: Bike, cor: 'bg-orange-100 text-orange-700' },
};

export default function UsuariosPage() {
  const { usuario: usuarioLogado } = useAuthStore();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ aberto: boolean; editando?: Usuario }>({ aberto: false });

  const carregar = async () => {
    try {
      setUsuarios(await adminListarUsuarios());
    } catch {
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); }, []);

  const remover = async (u: Usuario) => {
    if (!confirm(`Remover o acesso de ${u.nome}? Esta ação não pode ser desfeita.`)) return;
    try {
      await adminRemoverUsuario(u.id);
      toast.success('Usuário removido');
      carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao remover');
    }
  };

  const alternarAtivo = async (u: Usuario) => {
    try {
      await adminAtualizarUsuario(u.id, { ativo: !u.ativo });
      toast.success(u.ativo ? 'Acesso desativado' : 'Acesso reativado');
      carregar();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao atualizar');
    }
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <UserCog size={22} /> Usuários
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">Cadastre sua equipe e defina o perfil de cada um</p>
          </div>
          <button onClick={() => setModal({ aberto: true })}
            className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
            <Plus size={16} /> Novo usuário
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin w-8 h-8 border-4 border-gray-200 border-t-red-500 rounded-full" />
          </div>
        ) : (
          <div className="space-y-2">
            {usuarios.map(u => {
              const papel = PAPEIS[u.papel] || PAPEIS.atendente;
              const Icon = papel.icon;
              const souEu = u.id === usuarioLogado?.id;
              return (
                <div key={u.id}
                  className={`card p-4 flex items-center gap-3 ${!u.ativo ? 'opacity-60' : ''}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${papel.cor}`}>
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                      {u.nome}
                      {souEu && <span className="text-xs font-normal text-gray-400">(você)</span>}
                      {!u.ativo && <span className="text-xs font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Inativo</span>}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${papel.cor}`}>
                    {papel.label}
                  </span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => setModal({ aberto: true, editando: u })}
                      className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors" title="Editar">
                      <Pencil size={15} />
                    </button>
                    {!souEu && (
                      <button onClick={() => remover(u)}
                        className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors" title="Remover">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {usuarios.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-12">Nenhum usuário cadastrado ainda.</p>
            )}
          </div>
        )}

        <p className="text-xs text-gray-400 mt-6 leading-relaxed">
          <strong>Administrador:</strong> acessa tudo, inclusive esta tela e as configurações da loja.<br />
          <strong>Atendente:</strong> opera pedidos, chat e cardápio, sem acesso a usuários/configurações.<br />
          <strong>Motoboy:</strong> usa apenas o app de entregas em <code className="bg-gray-100 px-1 rounded">/motoboy</code>.
        </p>
      </div>

      {modal.aberto && (
        <UsuarioModal
          editando={modal.editando}
          onFechar={() => setModal({ aberto: false })}
          onSalvo={() => { setModal({ aberto: false }); carregar(); }}
        />
      )}
    </AdminLayout>
  );
}

function UsuarioModal({ editando, onFechar, onSalvo }: {
  editando?: Usuario;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [nome, setNome] = useState(editando?.nome || '');
  const [email, setEmail] = useState(editando?.email || '');
  const [senha, setSenha] = useState('');
  const [papel, setPapel] = useState(editando?.papel || 'atendente');
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    if (!nome.trim()) { toast.error('Informe o nome'); return; }
    if (!editando && !email.trim()) { toast.error('Informe o e-mail'); return; }
    if (!editando && senha.length < 6) { toast.error('A senha deve ter pelo menos 6 caracteres'); return; }
    if (editando && senha && senha.length < 6) { toast.error('A senha deve ter pelo menos 6 caracteres'); return; }

    setSalvando(true);
    try {
      if (editando) {
        const patch: any = { nome: nome.trim(), papel };
        if (senha) patch.senha = senha;
        await adminAtualizarUsuario(editando.id, patch);
        toast.success('Usuário atualizado');
      } else {
        await adminCriarUsuario({ nome: nome.trim(), email: email.trim(), senha, papel });
        toast.success('Usuário criado');
      }
      onSalvo();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => e.target === e.currentTarget && onFechar()}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-900 text-lg">{editando ? 'Editar usuário' : 'Novo usuário'}</h2>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
            <input value={nome} onChange={e => setNome(e.target.value)} className="input" placeholder="Nome do funcionário" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail (login)</label>
            <input value={email} onChange={e => setEmail(e.target.value)} className="input disabled:bg-gray-100 disabled:text-gray-400"
              type="email" placeholder="email@exemplo.com" disabled={!!editando} />
            {editando && <p className="text-xs text-gray-400 mt-1">O e-mail de login não pode ser alterado.</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {editando ? 'Nova senha (deixe em branco para manter)' : 'Senha'}
            </label>
            <input value={senha} onChange={e => setSenha(e.target.value)} className="input"
              type="password" placeholder={editando ? '••••••' : 'Mínimo 6 caracteres'} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Perfil de acesso</label>
            <div className="space-y-2">
              {Object.entries(PAPEIS).map(([valor, info]) => {
                const Icon = info.icon;
                return (
                  <button key={valor} type="button" onClick={() => setPapel(valor)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                      papel === valor ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${info.cor}`}>
                      <Icon size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{info.label}</p>
                      <p className="text-xs text-gray-400">{info.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <button onClick={salvar} disabled={salvando}
          className="btn-primary bg-red-500 w-full mt-5 flex items-center justify-center gap-2 py-3.5">
          {salvando
            ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : (editando ? 'Salvar alterações' : 'Criar usuário')}
        </button>
      </div>
    </div>
  );
}
