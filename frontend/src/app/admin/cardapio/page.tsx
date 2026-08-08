'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { adminGetCardapio, adminCriarCategoria, adminAtualizarCategoria, adminDeletarCategoria,
  adminCriarProduto, adminAtualizarProduto, adminDeletarProduto,
  adminCriarGrupo, adminAtualizarGrupo, adminDeletarGrupo,
  adminCriarOpcao, adminAtualizarOpcao, adminDeletarOpcao } from '@/lib/api';
import { Categoria, Produto, GrupoOpcao } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, ToggleLeft, ToggleRight, ImageIcon, SlidersHorizontal, X, Check, CheckCircle2, XCircle } from 'lucide-react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import ImageUpload from '@/components/ImageUpload';

export default function CardapioAdminPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [catAberta, setCatAberta] = useState<string | null>(null);

  // Modais
  const [modalCat, setModalCat] = useState<{ aberto: boolean; editando?: Categoria }>({ aberto: false });
  const [modalProd, setModalProd] = useState<{ aberto: boolean; categoriaId?: string; editando?: Produto }>({ aberto: false });
  const [modalOpcoes, setModalOpcoes] = useState<{ aberto: boolean; produto?: Produto }>({ aberto: false });

  async function carregar() {
    try {
      const data = await adminGetCardapio();
      setCategorias(data);
    } finally {
      setLoading(false);
    }
  }

  // Recarrega o cardápio e devolve a versão fresca do produto (com grupos/opções atualizados)
  async function recarregarProduto(produtoId: string): Promise<Produto | null> {
    const data: Categoria[] = await adminGetCardapio();
    setCategorias(data);
    for (const cat of data) {
      const p = cat.produtos.find(pp => pp.id === produtoId);
      if (p) return p;
    }
    return null;
  }

  useEffect(() => { carregar(); }, []);

  async function salvarCategoria(nome: string, fotoUrl: string, id?: string) {
    try {
      const data = { nome, foto_url: fotoUrl || null };
      if (id) await adminAtualizarCategoria(id, data);
      else await adminCriarCategoria(data);
      await carregar();
      setModalCat({ aberto: false });
      toast.success(id ? 'Categoria atualizada' : 'Categoria criada');
    } catch { toast.error('Erro ao salvar categoria'); }
  }

  async function deletarCategoria(id: string) {
    if (!confirm('Deletar categoria e todos seus produtos?')) return;
    try {
      await adminDeletarCategoria(id);
      await carregar();
      toast.success('Categoria removida');
    } catch { toast.error('Erro ao remover'); }
  }

  async function salvarProduto(data: any, id?: string) {
    try {
      if (id) await adminAtualizarProduto(id, data);
      else await adminCriarProduto(data);
      await carregar();
      setModalProd({ aberto: false });
      toast.success(id ? 'Produto atualizado' : 'Produto criado');
    } catch { toast.error('Erro ao salvar produto'); }
  }

  async function toggleStatus(produto: Produto) {
    const novoStatus = produto.status === 'ativo' ? 'inativo' : 'ativo';
    try {
      await adminAtualizarProduto(produto.id, { status: novoStatus });
      await carregar();
    } catch { toast.error('Erro'); }
  }

  async function toggleEsgotado(produto: Produto) {
    const novoStatus = produto.status === 'esgotado' ? 'ativo' : 'esgotado';
    try {
      await adminAtualizarProduto(produto.id, { status: novoStatus });
      await carregar();
    } catch { toast.error('Erro'); }
  }

  async function deletarProduto(id: string) {
    if (!confirm('Deletar produto?')) return;
    try {
      await adminDeletarProduto(id);
      await carregar();
      toast.success('Produto removido');
    } catch { toast.error('Erro ao remover'); }
  }

  if (loading) return (
    <AdminLayout>
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-gray-200 border-t-[var(--admin-accent)] rounded-full" />
      </div>
    </AdminLayout>
  );

  return (
    <AdminLayout>
      <div className="px-4 md:px-6 pt-3 md:pt-5 pb-6 max-w-3xl">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-page-title text-gray-900">Cardápio</h1>
          <button onClick={() => setModalCat({ aberto: true })}
            className="btn-admin-primary flex items-center gap-2 text-sm py-2.5 px-4">
            <Plus size={16} /> Nova Categoria
          </button>
        </div>

        <div className="space-y-3">
          {categorias.map(cat => (
            <div key={cat.id} className="card overflow-hidden">
              {/* Header categoria */}
              <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => setCatAberta(catAberta === cat.id ? null : cat.id)}>
                <div className="flex items-center gap-3">
                  {catAberta === cat.id ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center">
                    {cat.foto_url
                      ? <Image src={cat.foto_url} alt={cat.nome} width={40} height={40} className="w-full h-full object-cover" unoptimized />
                      : <ImageIcon size={16} className="text-gray-300" />}
                  </div>
                  <span className="font-semibold text-gray-800">{cat.nome}</span>
                  <span className="text-xs text-gray-400">{cat.produtos.length} itens</span>
                </div>
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  <button onClick={() => setModalProd({ aberto: true, categoriaId: cat.id })}
                    className="bg-[var(--admin-accent-soft)] text-[var(--admin-accent)] text-xs px-3 py-1.5 rounded-lg font-medium hover:opacity-80 flex items-center gap-1">
                    <Plus size={12} /> Produto
                  </button>
                  <button onClick={() => setModalCat({ aberto: true, editando: cat })}
                    className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => deletarCategoria(cat.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* Produtos */}
              {catAberta === cat.id && (
                <div className="border-t border-gray-100 divide-y divide-gray-50">
                  {cat.produtos.length === 0 && (
                    <p className="text-center text-sm text-gray-400 py-6">
                      Nenhum produto. <button onClick={() => setModalProd({ aberto: true, categoriaId: cat.id })} className="text-[var(--admin-accent)] font-medium">Adicionar</button>
                    </p>
                  )}
                  {cat.produtos.map(prod => (
                    <div key={prod.id} className={`flex items-center gap-4 px-4 py-3 ${prod.status !== 'ativo' ? 'opacity-60' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 text-sm">{prod.nome}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-bold text-[var(--admin-accent)]">{formatCurrency(Number(prod.preco))}</span>
                          {prod.status === 'esgotado' && <span className="text-xs text-orange-500 font-medium">Esgotado</span>}
                          {prod.status === 'inativo' && <span className="text-xs text-gray-400">Inativo</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => setModalOpcoes({ aberto: true, produto: prod })}
                          title="Tamanhos, sabores e adicionais"
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-[var(--admin-accent-border)]">
                          <SlidersHorizontal size={13} /> {prod.grupos_opcao?.length || 0}
                        </button>
                        <button onClick={() => toggleEsgotado(prod)}
                          title={prod.status === 'esgotado' ? 'Marcar disponível' : 'Marcar esgotado'}
                          className="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
                          {prod.status === 'esgotado' ? <CheckCircle2 size={14} className="text-green-500" /> : <XCircle size={14} className="text-red-500" />}
                        </button>
                        <button onClick={() => toggleStatus(prod)} title={prod.status === 'ativo' ? 'Desativar' : 'Ativar'}
                          className={`text-gray-400 hover:text-gray-700 transition-colors`}>
                          {prod.status === 'ativo' ? <ToggleRight size={20} className="text-green-500" /> : <ToggleLeft size={20} />}
                        </button>
                        <button onClick={() => setModalProd({ aberto: true, categoriaId: cat.id, editando: prod })}
                          className="p-1 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => deletarProduto(prod.id)}
                          className="p-1 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Modal Categoria */}
      {modalCat.aberto && (
        <ModalCategoria
          editando={modalCat.editando}
          onSalvar={salvarCategoria}
          onFechar={() => setModalCat({ aberto: false })} />
      )}

      {/* Modal Produto */}
      {modalProd.aberto && (
        <ModalProduto
          categorias={categorias}
          categoriaIdPadrao={modalProd.categoriaId}
          editando={modalProd.editando}
          onSalvar={salvarProduto}
          onFechar={() => setModalProd({ aberto: false })} />
      )}

      {/* Modal Opções (tamanhos, sabores, adicionais) */}
      {modalOpcoes.aberto && modalOpcoes.produto && (
        <GerenciarOpcoesModal
          produto={modalOpcoes.produto}
          onFechar={() => { setModalOpcoes({ aberto: false }); carregar(); }}
          reload={recarregarProduto} />
      )}
    </AdminLayout>
  );
}

function ModalCategoria({ editando, onSalvar, onFechar }: {
  editando?: Categoria; onSalvar: (nome: string, fotoUrl: string, id?: string) => void; onFechar: () => void;
}) {
  const [nome, setNome] = useState(editando?.nome || '');
  const [fotoUrl, setFotoUrl] = useState(editando?.foto_url || '');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => e.target === e.currentTarget && onFechar()}>
      <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
        <h2 className="font-bold text-gray-900 mb-4">{editando ? 'Editar' : 'Nova'} Categoria</h2>
        <div className="space-y-4">
          <input value={nome} onChange={e => setNome(e.target.value)}
            placeholder="Nome da categoria" className="input" autoFocus />
          <ImageUpload
            label="Foto da categoria"
            value={fotoUrl}
            onChange={setFotoUrl}
            previewSize={80}
          />
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onFechar} className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 text-sm font-medium">Cancelar</button>
          <button onClick={() => onSalvar(nome, fotoUrl, editando?.id)}
            className="flex-1 btn-admin-primary py-3">Salvar</button>
        </div>
      </div>
    </div>
  );
}

function ModalProduto({ categorias, categoriaIdPadrao, editando, onSalvar, onFechar }: {
  categorias: Categoria[]; categoriaIdPadrao?: string; editando?: Produto;
  onSalvar: (data: any, id?: string) => void; onFechar: () => void;
}) {
  const [nome, setNome] = useState(editando?.nome || '');
  const [descricao, setDescricao] = useState(editando?.descricao || '');
  const [preco, setPreco] = useState(editando?.preco?.toString() || '');
  const [precoPromo, setPrecoPromo] = useState(editando?.preco_promocional?.toString() || '');
  const [catId, setCatId] = useState(editando?.categoria_id || categoriaIdPadrao || '');
  const [destaque, setDestaque] = useState(editando?.destaque || false);
  const [imagemUrl, setImagemUrl] = useState(editando?.imagem_url || '');

  function salvar() {
    if (!nome.trim() || !preco || !catId) { toast.error('Preencha nome, preço e categoria'); return; }
    onSalvar({
      nome, descricao, preco: parseFloat(preco),
      preco_promocional: precoPromo ? parseFloat(precoPromo) : null,
      categoria_id: catId, destaque, imagem_url: imagemUrl || null,
    }, editando?.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => e.target === e.currentTarget && onFechar()}>
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl max-h-[85vh] overflow-y-auto">
        <h2 className="font-bold text-gray-900 mb-4">{editando ? 'Editar' : 'Novo'} Produto</h2>
        <div className="space-y-3">
          <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do produto *" className="input" />
          <textarea value={descricao} onChange={e => setDescricao(e.target.value)}
            placeholder="Descrição (opcional)" className="input resize-none h-20" />
          <div className="grid grid-cols-2 gap-3">
            <input value={preco} onChange={e => setPreco(e.target.value)}
              placeholder="Preço R$ *" className="input" type="number" min="0" step="0.01" />
            <input value={precoPromo} onChange={e => setPrecoPromo(e.target.value)}
              placeholder="Promo R$ (opcional)" className="input" type="number" min="0" step="0.01" />
          </div>
          <select value={catId} onChange={e => setCatId(e.target.value)} className="input">
            <option value="">Selecione a categoria *</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <ImageUpload
            label="Foto do produto"
            value={imagemUrl}
            onChange={setImagemUrl}
            previewSize={72}
          />
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={destaque} onChange={e => setDestaque(e.target.checked)}
              className="w-4 h-4 rounded accent-[var(--admin-accent)]" />
            <span className="text-sm text-gray-700">Produto em destaque</span>
          </label>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onFechar} className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 text-sm font-medium">Cancelar</button>
          <button onClick={salvar} className="flex-1 btn-admin-primary py-3">Salvar</button>
        </div>
      </div>
    </div>
  );
}

/* ── Gerenciar grupos de opção (tamanhos, sabores, adicionais) ── */
function GerenciarOpcoesModal({ produto, onFechar, reload }: {
  produto: Produto;
  onFechar: () => void;
  reload: (produtoId: string) => Promise<Produto | null>;
}) {
  const [grupos, setGrupos] = useState<GrupoOpcao[]>(produto.grupos_opcao || []);
  const [novoGrupo, setNovoGrupo] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function refresh() {
    const p = await reload(produto.id);
    if (p) setGrupos(p.grupos_opcao || []);
  }

  async function criarGrupo(data: any) {
    setSalvando(true);
    try { await adminCriarGrupo(produto.id, data); await refresh(); setNovoGrupo(false); toast.success('Grupo criado'); }
    catch (e: any) { toast.error(e?.response?.data?.message || 'Erro ao criar grupo'); }
    finally { setSalvando(false); }
  }
  async function salvarGrupo(id: string, data: any) {
    try { await adminAtualizarGrupo(id, data); await refresh(); toast.success('Grupo salvo'); }
    catch (e: any) { toast.error(e?.response?.data?.message || 'Erro ao salvar'); }
  }
  async function removerGrupo(id: string) {
    if (!confirm('Remover este grupo e todas as suas opções?')) return;
    try { await adminDeletarGrupo(id); await refresh(); toast.success('Grupo removido'); }
    catch { toast.error('Erro ao remover'); }
  }
  async function criarOpcao(grupoId: string, data: any) {
    try { await adminCriarOpcao(grupoId, data); await refresh(); }
    catch (e: any) { toast.error(e?.response?.data?.message || 'Erro ao adicionar opção'); }
  }
  async function salvarOpcao(id: string, data: any) {
    try { await adminAtualizarOpcao(id, data); await refresh(); toast.success('Opção salva'); }
    catch (e: any) { toast.error(e?.response?.data?.message || 'Erro'); }
  }
  async function removerOpcao(id: string) {
    try { await adminDeletarOpcao(id); await refresh(); }
    catch { toast.error('Erro ao remover'); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={e => e.target === e.currentTarget && onFechar()}>
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-900">Opções — {produto.nome}</h2>
            <p className="text-xs text-gray-400">Tamanhos, sabores e adicionais</p>
          </div>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-700"><X size={20} /></button>
        </div>

        <div className="overflow-y-auto px-6 py-4 space-y-4 flex-1">
          {grupos.length === 0 && !novoGrupo && (
            <p className="text-center text-sm text-gray-400 py-8">
              Nenhum grupo ainda.<br />Crie "Tamanho", "Sabores", "Adicionais"...
            </p>
          )}
          {grupos.map(g => (
            <GrupoEditor key={g.id} grupo={g}
              onSalvar={d => salvarGrupo(g.id, d)}
              onRemover={() => removerGrupo(g.id)}
              onCriarOpcao={d => criarOpcao(g.id, d)}
              onSalvarOpcao={salvarOpcao}
              onRemoverOpcao={removerOpcao} />
          ))}

          {novoGrupo ? (
            <NovoGrupoForm salvando={salvando} onCriar={criarGrupo} onCancelar={() => setNovoGrupo(false)} />
          ) : (
            <button onClick={() => setNovoGrupo(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-200 text-gray-500 text-sm font-medium hover:border-[var(--admin-accent-border)] hover:text-[var(--admin-accent)] transition-colors">
              <Plus size={16} /> Adicionar grupo
            </button>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={onFechar} className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-semibold">Concluir</button>
        </div>
      </div>
    </div>
  );
}

function GrupoEditor({ grupo, onSalvar, onRemover, onCriarOpcao, onSalvarOpcao, onRemoverOpcao }: {
  grupo: GrupoOpcao;
  onSalvar: (d: any) => void; onRemover: () => void;
  onCriarOpcao: (d: any) => void; onSalvarOpcao: (id: string, d: any) => void; onRemoverOpcao: (id: string) => void;
}) {
  const [nome, setNome] = useState(grupo.nome);
  const [tipo, setTipo] = useState<'unico' | 'multiplo'>(grupo.tipo);
  const [obrigatorio, setObrigatorio] = useState(grupo.obrigatorio);
  const [min, setMin] = useState(String(grupo.min ?? 0));
  const [max, setMax] = useState(grupo.max == null ? '' : String(grupo.max));
  const [novaOpNome, setNovaOpNome] = useState('');
  const [novaOpPreco, setNovaOpPreco] = useState('');

  const maxOriginal = grupo.max == null ? '' : String(grupo.max);
  const alterado = nome !== grupo.nome || tipo !== grupo.tipo || obrigatorio !== grupo.obrigatorio
    || String(grupo.min ?? 0) !== min || maxOriginal !== max;

  function salvar() {
    const data: any = { nome: nome.trim(), tipo, obrigatorio, min: parseInt(min) || 0 };
    data.max = tipo === 'unico' ? 1 : (max === '' ? null : parseInt(max));
    onSalvar(data);
  }

  return (
    <div className="border border-gray-200 rounded-2xl p-3">
      <div className="flex items-center gap-2 mb-2">
        <input value={nome} onChange={e => setNome(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold text-gray-800 outline-none focus:border-[var(--admin-accent)]" />
        <button onClick={onRemover} className="p-2 text-gray-300 hover:text-red-500" title="Remover grupo"><Trash2 size={15} /></button>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <select value={tipo} onChange={e => setTipo(e.target.value as any)}
          className="px-2 py-2 rounded-lg border border-gray-200 text-xs text-gray-700 outline-none">
          <option value="unico">Escolha 1 (ex: Tamanho)</option>
          <option value="multiplo">Escolha vários (ex: Sabores)</option>
        </select>
        <label className="flex items-center gap-2 text-xs text-gray-600 px-2">
          <input type="checkbox" checked={obrigatorio} onChange={e => setObrigatorio(e.target.checked)} className="w-4 h-4 accent-[var(--admin-accent)]" />
          Obrigatório
        </label>
      </div>
      {tipo === 'multiplo' && (
        <div className="grid grid-cols-2 gap-2 mb-2">
          <label className="text-[11px] text-gray-500 font-medium">Mín. de escolhas
            <input value={min} onChange={e => setMin(e.target.value)} type="number" min="0"
              className="w-full mt-0.5 px-2 py-1.5 rounded-lg border border-gray-200 text-sm outline-none" />
          </label>
          <label className="text-[11px] text-gray-500 font-medium">Máx. de escolhas
            <input value={max} onChange={e => setMax(e.target.value)} type="number" min="1" placeholder="ilimitado"
              className="w-full mt-0.5 px-2 py-1.5 rounded-lg border border-gray-200 text-sm outline-none" />
          </label>
        </div>
      )}
      {alterado && (
        <button onClick={salvar}
          className="w-full mb-3 py-2 bg-[var(--admin-accent)] hover:bg-[var(--admin-accent-hover)] text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors">
          <Check size={13} /> Salvar alterações do grupo
        </button>
      )}

      <div className="space-y-1.5">
        {(grupo.opcoes || []).map(o => (
          <OpcaoRow key={o.id} opcao={o} onSalvar={d => onSalvarOpcao(o.id, d)} onRemover={() => onRemoverOpcao(o.id)} />
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <input value={novaOpNome} onChange={e => setNovaOpNome(e.target.value)}
          placeholder="Nova opção (ex: Grande)" className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-[var(--admin-accent)]" />
        <div className="relative w-24">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">+R$</span>
          <input value={novaOpPreco} onChange={e => setNovaOpPreco(e.target.value)} type="number" step="0.01" placeholder="0,00"
            className="w-full pl-9 pr-2 py-1.5 rounded-lg border border-gray-200 text-sm outline-none" />
        </div>
        <button onClick={() => { if (!novaOpNome.trim()) return; onCriarOpcao({ nome: novaOpNome.trim(), preco_adicional: parseFloat(novaOpPreco) || 0 }); setNovaOpNome(''); setNovaOpPreco(''); }}
          className="p-2 bg-[var(--admin-accent-soft)] text-[var(--admin-accent)] rounded-lg hover:opacity-80" title="Adicionar opção"><Plus size={16} /></button>
      </div>
    </div>
  );
}

function OpcaoRow({ opcao, onSalvar, onRemover }: {
  opcao: { id: string; nome: string; preco_adicional: number };
  onSalvar: (d: any) => void; onRemover: () => void;
}) {
  const [nome, setNome] = useState(opcao.nome);
  const [preco, setPreco] = useState(String(Number(opcao.preco_adicional) || 0));
  const alterado = nome !== opcao.nome || String(Number(opcao.preco_adicional) || 0) !== preco;
  return (
    <div className="flex items-center gap-2">
      <input value={nome} onChange={e => setNome(e.target.value)}
        className="flex-1 px-3 py-1.5 rounded-lg border border-gray-100 bg-gray-50 text-sm outline-none focus:border-[var(--admin-accent)] focus:bg-white" />
      <div className="relative w-24">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">R$</span>
        <input value={preco} onChange={e => setPreco(e.target.value)} type="number" step="0.01"
          className="w-full pl-7 pr-2 py-1.5 rounded-lg border border-gray-100 bg-gray-50 text-sm outline-none focus:border-[var(--admin-accent)] focus:bg-white" />
      </div>
      {alterado ? (
        <button onClick={() => onSalvar({ nome: nome.trim(), preco_adicional: parseFloat(preco) || 0 })}
          className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg" title="Salvar"><Check size={16} /></button>
      ) : (
        <button onClick={onRemover} className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg" title="Remover opção"><Trash2 size={14} /></button>
      )}
    </div>
  );
}

function NovoGrupoForm({ salvando, onCriar, onCancelar }: {
  salvando: boolean; onCriar: (d: any) => void; onCancelar: () => void;
}) {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<'unico' | 'multiplo'>('multiplo');
  const [obrigatorio, setObrigatorio] = useState(false);
  const [max, setMax] = useState('');

  return (
    <div className="border-2 border-[var(--admin-accent-border)] rounded-2xl p-3 space-y-2">
      <input value={nome} onChange={e => setNome(e.target.value)} autoFocus
        placeholder="Nome do grupo (ex: Sabores, Tamanho, Borda...)"
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-[var(--admin-accent)]" />
      <select value={tipo} onChange={e => setTipo(e.target.value as any)}
        className="w-full px-2 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 outline-none">
        <option value="unico">Escolha 1 (ex: Tamanho)</option>
        <option value="multiplo">Escolha vários (ex: Sabores, Adicionais)</option>
      </select>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={obrigatorio} onChange={e => setObrigatorio(e.target.checked)} className="w-4 h-4 accent-[var(--admin-accent)]" />
          Obrigatório
        </label>
        {tipo === 'multiplo' && (
          <label className="flex items-center gap-1.5 text-sm text-gray-600 ml-auto">Máx. de escolhas
            <input value={max} onChange={e => setMax(e.target.value)} type="number" min="1" placeholder="∞"
              className="w-16 px-2 py-1 rounded-lg border border-gray-200 text-sm outline-none" />
          </label>
        )}
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={onCancelar} className="flex-1 py-2 border border-gray-200 rounded-lg text-gray-600 text-sm">Cancelar</button>
        <button disabled={salvando || !nome.trim()}
          onClick={() => {
            const data: any = { nome: nome.trim(), tipo, obrigatorio };
            if (tipo === 'unico') data.max = 1;
            else if (max) data.max = parseInt(max);
            if (obrigatorio) data.min = 1;
            onCriar(data);
          }}
          className="flex-1 py-2 bg-[var(--admin-accent)] hover:bg-[var(--admin-accent-hover)] text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors">Criar grupo</button>
      </div>
    </div>
  );
}
