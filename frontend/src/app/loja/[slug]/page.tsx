'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { getLoja, getCardapio } from '@/lib/api';
import { Loja, Categoria, Produto } from '@/types';
import { useCarrinhoStore } from '@/stores/carrinho.store';
import { formatCurrency } from '@/lib/utils';
import { ShoppingCart, Search, Clock, ChevronRight, X, Star, Bike, MapPin, UtensilsCrossed } from 'lucide-react';
import { useFaviconLoja } from '@/hooks/useFaviconLoja';
import ProdutoModal from '@/components/cardapio/ProdutoModal';
import CarrinhoDrawer from '@/components/carrinho/CarrinhoDrawer';
import ChatWidget from '@/components/chat/ChatWidget';
import toast from 'react-hot-toast';

export default function CardapioPage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();

  const [loja, setLoja] = useState<Loja | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null);
  const [carrinhoAberto, setCarrinhoAberto] = useState(false);
  const [catDrawer, setCatDrawer] = useState<Categoria | null>(null);

  const { quantidadeTotal, total, setLoja: setLojaCarrinho, setOrigem } = useCarrinhoStore();

  useFaviconLoja(loja?.logo_url);

  // De onde veio o cliente (?origem=instagram, ?origem=qr-mesa...). Lido de
  // window em vez de useSearchParams para não exigir <Suspense> no build.
  useEffect(() => {
    const origem = new URLSearchParams(window.location.search).get('origem');
    if (origem) setOrigem(origem);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [lojaData, cardapioData] = await Promise.all([getLoja(slug), getCardapio(slug)]);
        setLoja(lojaData);
        setCategorias(cardapioData);
        setLojaCarrinho(lojaData.id, slug);
        document.documentElement.style.setProperty('--color-primary', lojaData.cor_primaria);
        document.title = lojaData.nome;
      } catch {
        toast.error('Loja não encontrada');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  const produtosFiltrados = categorias.map(cat => ({
    ...cat,
    produtos: cat.produtos.filter(p =>
      p.nome.toLowerCase().includes(busca.toLowerCase()) ||
      (p.descricao || '').toLowerCase().includes(busca.toLowerCase())
    ),
  })).filter(cat => cat.produtos.length > 0);

  const destaques = categorias.flatMap(c => c.produtos).filter(p => p.destaque && p.status === 'ativo').slice(0, 8);

  if (loading) return <LoadingSkeleton />;
  if (!loja) return (
    <div className="flex items-center justify-center min-h-screen bg-[#14110e] text-gray-400">
      Loja não encontrada
    </div>
  );

  const totalItens = quantidadeTotal();

  return (
    <div className="admin-dark min-h-screen bg-[#0d0b09] flex justify-center">
      <div className="w-full max-w-[500px] bg-[#14110e] min-h-screen relative flex flex-col">

        {/* Banner */}
        <div className="relative w-full overflow-hidden" style={{ height: 220 }}>
          {loja.banner_url ? (
            loja.banner_tipo === 'video' ? (
              <video
                src={loja.banner_url}
                autoPlay muted loop playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <Image src={loja.banner_url} alt={loja.nome} fill
                className="object-cover" unoptimized priority />
            )
          ) : (
            <div className="w-full h-full bg-[#201d16] flex items-center justify-center">
              <UtensilsCrossed size={64} className="text-gray-500 opacity-30" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

          {/* Logo + nome bottom-left */}
          <div className="absolute bottom-4 left-4 flex items-end gap-3">
            {loja.logo_url ? (
              <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-white/20 shadow-xl">
                <Image src={loja.logo_url} alt={loja.nome} width={64} height={64}
                  className="w-full h-full object-cover" unoptimized />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-white/20 border-2 border-white/30 flex items-center justify-center text-2xl font-bold text-white">
                {loja.nome[0]}
              </div>
            )}
            <div className="pb-0.5">
              <h1 className="text-white font-bold text-xl leading-tight drop-shadow-lg">{loja.nome}</h1>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`w-2 h-2 rounded-full ${loja.aberta ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className="text-white/70 text-xs">{loja.aberta ? 'Aberto agora' : 'Fechado'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Info bar */}
        <div className="bg-[#17140e] px-4 py-2.5 flex items-center gap-4 border-b border-white/5">
          <div className="flex items-center gap-1.5 text-gray-400 text-xs">
            <Clock size={12} />
            <span>{loja.prazo_medio_min} min</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-400 text-xs">
            <Bike size={12} />
            <span>
              {Number(loja.taxa_entrega_padrao) === 0
                ? 'Entrega grátis'
                : `Entrega ${formatCurrency(Number(loja.taxa_entrega_padrao))}`}
            </span>
          </div>
          {loja.endereco && (
            <div className="flex items-center gap-1 text-gray-500 text-xs ml-auto">
              <MapPin size={11} />
              <span className="truncate max-w-[130px]">{loja.endereco}</span>
            </div>
          )}
        </div>

        {/* Notification banner */}
        {loja.mensagem_topo && (
          <div className="bg-amber-500/15 border-b border-amber-500/20 px-4 py-2 text-amber-400 text-xs text-center">
            {loja.mensagem_topo}
          </div>
        )}

        {/* Search */}
        <div className="px-4 pt-4 pb-2">
          <div className="relative bg-[#201d16] rounded-xl border border-white/8">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar no cardápio..."
              className="w-full pl-10 pr-9 py-3 rounded-xl text-sm outline-none text-gray-200 bg-transparent placeholder-gray-600"
            />
            {busca && (
              <button onClick={() => setBusca('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 pb-32">

          {/* Search results */}
          {busca && (
            <div className="px-4 mt-2 space-y-px">
              {produtosFiltrados.map(cat => cat.produtos.map(produto => (
                <ProdutoRow key={produto.id} produto={produto} cor={loja.cor_primaria}
                  onClick={() => setProdutoSelecionado(produto)} />
              )))}
              {produtosFiltrados.length === 0 && (
                <div className="text-center py-16">
                  <Search size={36} className="mx-auto mb-3 text-gray-600" />
                  <p className="text-gray-500 text-sm">Nenhum resultado para "{busca}"</p>
                </div>
              )}
            </div>
          )}

          {/* Normal mode */}
          {!busca && (
            <>
              {/* Oferta do Dia */}
              {destaques.length > 0 && (
                <div className="mt-4 mb-2">
                  <div className="px-4 mb-3 flex items-center gap-2">
                    <Star size={14} className="text-amber-400 fill-amber-400" />
                    <h2 className="font-bold text-white text-sm">Oferta do Dia</h2>
                  </div>
                  <div className="flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-hide">
                    {destaques.map(p => (
                      <button key={p.id} onClick={() => setProdutoSelecionado(p)}
                        className="flex-shrink-0 w-36 bg-[#201d16] rounded-2xl overflow-hidden text-left hover:bg-[#262119] transition-colors border border-white/5">
                        <div className="relative w-full h-24 bg-[#17140e]">
                          {p.imagem_url ? (
                            <Image src={p.imagem_url} alt={p.nome} fill
                              className="object-cover" unoptimized />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <UtensilsCrossed size={28} className="text-gray-500 opacity-40" />
                            </div>
                          )}
                          {p.preco_promocional && (
                            <span className="absolute top-1.5 left-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                              -{Math.round((1 - Number(p.preco_promocional) / Number(p.preco)) * 100)}%
                            </span>
                          )}
                        </div>
                        <div className="p-2.5">
                          <p className="text-xs font-semibold text-white line-clamp-2 leading-snug">{p.nome}</p>
                          <p className="text-xs font-bold mt-1" style={{ color: loja.cor_primaria }}>
                            {formatCurrency(Number(p.preco_promocional || p.preco))}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Category grid */}
              <div className="px-4 mt-4">
                <h2 className="font-bold text-white text-sm mb-3">Cardápio</h2>
                <div className="grid grid-cols-2 gap-3">
                  {categorias.map(cat => (
                    <CategoriaCard key={cat.id} categoria={cat} onClick={() => setCatDrawer(cat)} />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Floating cart button */}
        {totalItens > 0 && !catDrawer && (
          <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[500px] px-4 pb-5 pt-2 z-30 bg-gradient-to-t from-[#14110e] to-transparent">
            <button onClick={() => setCarrinhoAberto(true)}
              className="flex items-center gap-3 text-white px-5 py-4 rounded-2xl shadow-2xl w-full"
              style={{ backgroundColor: loja.cor_primaria }}>
              <div className="relative">
                <ShoppingCart size={20} />
                <span className="absolute -top-2 -right-2 bg-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center"
                  style={{ color: loja.cor_primaria }}>
                  {totalItens}
                </span>
              </div>
              <span className="flex-1 text-left font-semibold text-sm">Ver carrinho</span>
              <span className="font-bold text-sm">{formatCurrency(total())}</span>
              <ChevronRight size={18} />
            </button>
          </div>
        )}

        <ChatWidget slug={slug} />
      </div>

      {/* Category bottom sheet */}
      {catDrawer && (
        <CategoriaBottomSheet
          categoria={catDrawer}
          cor={loja.cor_primaria}
          onClose={() => setCatDrawer(null)}
          onProdutoClick={p => { setCatDrawer(null); setProdutoSelecionado(p); }}
        />
      )}

      {produtoSelecionado && (
        <ProdutoModal produto={produtoSelecionado} loja={loja}
          onClose={() => setProdutoSelecionado(null)}
          onAdicionado={() => { setProdutoSelecionado(null); setCarrinhoAberto(true); }} />
      )}
      {carrinhoAberto && (
        <CarrinhoDrawer loja={loja} onClose={() => setCarrinhoAberto(false)}
          onCheckout={() => { setCarrinhoAberto(false); router.push(`/loja/${slug}/checkout`); }} />
      )}
    </div>
  );
}

/* ── 2-column category card (grid) ── */
function CategoriaCard({ categoria, onClick }: { categoria: Categoria; onClick: () => void }) {
  const count = categoria.produtos.filter(p => p.status !== 'inativo').length;

  return (
    <button onClick={onClick}
      className="relative rounded-2xl overflow-hidden text-left group"
      style={{ aspectRatio: '1/1' }}>
      {categoria.foto_url ? (
        <Image src={categoria.foto_url} alt={categoria.nome} fill
          className="object-cover group-hover:scale-105 transition-transform duration-300" unoptimized />
      ) : (
        <div className="w-full h-full bg-[#201d16] flex items-center justify-center">
          <UtensilsCrossed size={36} className="text-gray-500 opacity-40" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-3">
        <p className="text-white font-bold text-sm leading-tight">{categoria.nome}</p>
        <p className="text-white/50 text-xs mt-0.5">{count} {count === 1 ? 'item' : 'itens'}</p>
      </div>
    </button>
  );
}

/* ── Category bottom sheet ── */
function CategoriaBottomSheet({ categoria, cor, onClose, onProdutoClick }: {
  categoria: Categoria; cor: string;
  onClose: () => void; onProdutoClick: (p: Produto) => void;
}) {
  const ativos = categoria.produtos.filter(p => p.status !== 'inativo');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end items-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-[#14110e] rounded-t-3xl max-h-[88vh] flex flex-col w-full max-w-[500px]">
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>

        {/* Sheet header */}
        <div className="flex items-center justify-between px-5 pb-3 border-b border-white/8 flex-shrink-0">
          <div className="flex items-center gap-3">
            {categoria.foto_url && (
              <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
                <Image src={categoria.foto_url} alt={categoria.nome} width={40} height={40}
                  className="w-full h-full object-cover" unoptimized />
              </div>
            )}
            <div>
              <h2 className="font-bold text-white text-base">{categoria.nome}</h2>
              <p className="text-xs text-gray-600">{ativos.length} {ativos.length === 1 ? 'item' : 'itens'}</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Products list */}
        <div className="overflow-y-auto flex-1 divide-y divide-white/5">
          {ativos.map(produto => (
            <ProdutoRow key={produto.id} produto={produto} cor={cor}
              onClick={() => onProdutoClick(produto)} />
          ))}
          {ativos.length === 0 && (
            <p className="text-center text-sm text-gray-600 py-10">Nenhum produto disponível</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Product row (dark) ── */
function ProdutoRow({ produto, cor, onClick }: { produto: Produto; cor: string; onClick: () => void }) {
  const esgotado = produto.status === 'esgotado';

  return (
    <button onClick={onClick} disabled={esgotado}
      className={`w-full bg-transparent px-4 py-3.5 flex gap-4 text-left hover:bg-white/4 transition-colors group ${esgotado ? 'opacity-50' : ''}`}>
      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <p className="font-semibold text-white text-sm leading-snug">{produto.nome}</p>
          {produto.descricao && (
            <p className="text-gray-500 text-xs mt-1 line-clamp-2 leading-relaxed">{produto.descricao}</p>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {produto.preco_promocional ? (
            <>
              <span className="font-bold text-sm" style={{ color: cor }}>
                {formatCurrency(Number(produto.preco_promocional))}
              </span>
              <span className="text-xs text-gray-600 line-through">
                {formatCurrency(Number(produto.preco))}
              </span>
              <span className="text-xs bg-red-500/20 text-red-400 font-semibold px-1.5 py-0.5 rounded-md">
                -{Math.round((1 - Number(produto.preco_promocional) / Number(produto.preco)) * 100)}%
              </span>
            </>
          ) : (
            <span className="font-bold text-sm" style={{ color: cor }}>
              {formatCurrency(Number(produto.preco))}
            </span>
          )}
          {esgotado && (
            <span className="text-xs bg-orange-500/20 text-orange-400 font-semibold px-1.5 py-0.5 rounded-md">
              Esgotado
            </span>
          )}
        </div>
      </div>

      <div className="relative flex-shrink-0 w-24 h-24 rounded-xl overflow-hidden bg-[#201d16]">
        {produto.imagem_url ? (
          <Image src={produto.imagem_url} alt={produto.nome} fill
            className="object-cover group-hover:scale-105 transition-transform duration-300" unoptimized />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <UtensilsCrossed size={28} className="text-gray-500 opacity-30" />
          </div>
        )}
        {!esgotado && (
          <div className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-full bg-white shadow flex items-center justify-center"
            style={{ color: cor }}>
            <span className="text-lg font-bold leading-none">+</span>
          </div>
        )}
      </div>
    </button>
  );
}

function LoadingSkeleton() {
  return (
    <div className="admin-dark min-h-screen bg-[#0d0b09] flex justify-center">
      <div className="w-full max-w-[500px] bg-[#14110e] animate-pulse">
        <div className="h-[220px] bg-[#201d16]" />
        <div className="h-11 bg-[#17140e]" />
        <div className="p-4 space-y-4">
          <div className="h-11 bg-[#201d16] rounded-xl" />
          <div className="grid grid-cols-2 gap-3 mt-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-40 bg-[#201d16] rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
