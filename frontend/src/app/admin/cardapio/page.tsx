'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { adminGetCardapio, adminCriarCategoria, adminAtualizarCategoria, adminDeletarCategoria,
  adminCriarProduto, adminAtualizarProduto, adminDeletarProduto } from '@/lib/api';
import { Categoria, Produto } from '@/types';
import { formatCurrency } from '@/lib/utils';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, ToggleLeft, ToggleRight, ImageIcon } from 'lucide-react';
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

  async function carregar() {
    try {
      const data = await adminGetCardapio();
      setCategorias(data);
    } finally {
      setLoading(false);
    }
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
        <div className="animate-spin w-8 h-8 border-4 border-gray-200 border-t-red-500 rounded-full" />
      </div>
    </AdminLayout>
  );

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">Cardápio</h1>
          <button onClick={() => setModalCat({ aberto: true })}
            className="btn-primary bg-red-500 flex items-center gap-2 text-sm py-2.5 px-4">
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
                    className="bg-red-50 text-red-600 text-xs px-3 py-1.5 rounded-lg font-medium hover:bg-red-100 flex items-center gap-1">
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
                      Nenhum produto. <button onClick={() => setModalProd({ aberto: true, categoriaId: cat.id })} className="text-red-500 font-medium">Adicionar</button>
                    </p>
                  )}
                  {cat.produtos.map(prod => (
                    <div key={prod.id} className={`flex items-center gap-4 px-4 py-3 ${prod.status !== 'ativo' ? 'opacity-60' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 text-sm">{prod.nome}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-bold text-red-600">{formatCurrency(Number(prod.preco))}</span>
                          {prod.status === 'esgotado' && <span className="text-xs text-orange-500 font-medium">Esgotado</span>}
                          {prod.status === 'inativo' && <span className="text-xs text-gray-400">Inativo</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => toggleEsgotado(prod)}
                          title={prod.status === 'esgotado' ? 'Marcar disponível' : 'Marcar esgotado'}
                          className="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
                          {prod.status === 'esgotado' ? '✅' : '❌'}
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
            className="flex-1 py-3 bg-red-500 text-white rounded-xl text-sm font-semibold">Salvar</button>
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
              className="w-4 h-4 rounded accent-red-500" />
            <span className="text-sm text-gray-700">Produto em destaque</span>
          </label>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onFechar} className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 text-sm font-medium">Cancelar</button>
          <button onClick={salvar} className="flex-1 py-3 bg-red-500 text-white rounded-xl text-sm font-semibold">Salvar</button>
        </div>
      </div>
    </div>
  );
}
