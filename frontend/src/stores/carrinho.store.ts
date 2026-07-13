import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ItemCarrinho, Produto, Opcao } from '@/types';

interface CarrinhoState {
  lojaId: string | null;
  lojaSlug: string | null;
  itens: ItemCarrinho[];
  adicionarItem: (produto: Produto, quantidade: number, opcoesSelecionadas: Record<string, Opcao[]>, observacao?: string) => void;
  removerItem: (id: string) => void;
  alterarQuantidade: (id: string, quantidade: number) => void;
  limpar: () => void;
  setLoja: (lojaId: string, slug: string) => void;
  total: () => number;
  subtotal: () => number;
  quantidadeTotal: () => number;
}

function calcularTotalItem(item: ItemCarrinho): number {
  const adicionais = item.opcoes.reduce((acc, o) => acc + o.preco_adicional, 0);
  return (item.preco_unitario + adicionais) * item.quantidade;
}

export const useCarrinhoStore = create<CarrinhoState>()(
  persist(
    (set, get) => ({
      lojaId: null,
      lojaSlug: null,
      itens: [],

      setLoja: (lojaId, slug) => set({ lojaId, lojaSlug: slug }),

      adicionarItem: (produto, quantidade, opcoesSelecionadas, observacao) => {
        const opcoes: ItemCarrinho['opcoes'] = [];
        for (const [grupoId, selecionadas] of Object.entries(opcoesSelecionadas)) {
          for (const op of selecionadas) {
            opcoes.push({
              grupo_id: grupoId,
              grupo_nome: '',
              opcao_id: op.id,
              nome_snapshot: op.nome,
              preco_adicional: Number(op.preco_adicional),
            });
          }
        }

        const item: ItemCarrinho = {
          id: Math.random().toString(36).substr(2, 9),
          produto_id: produto.id,
          nome_snapshot: produto.nome,
          preco_unitario: Number(produto.preco_promocional || produto.preco),
          quantidade,
          observacao,
          opcoes,
          total: 0,
        };
        item.total = calcularTotalItem(item);

        set(state => ({ itens: [...state.itens, item] }));
      },

      removerItem: (id) => set(state => ({ itens: state.itens.filter(i => i.id !== id) })),

      alterarQuantidade: (id, quantidade) => {
        if (quantidade <= 0) {
          get().removerItem(id);
          return;
        }
        set(state => ({
          itens: state.itens.map(i =>
            i.id === id ? { ...i, quantidade, total: calcularTotalItem({ ...i, quantidade }) } : i,
          ),
        }));
      },

      limpar: () => set({ itens: [], lojaId: null, lojaSlug: null }),

      subtotal: () => get().itens.reduce((acc, i) => acc + i.total, 0),
      total: () => get().subtotal(),
      quantidadeTotal: () => get().itens.reduce((acc, i) => acc + i.quantidade, 0),
    }),
    { name: 'carrinho' },
  ),
);
