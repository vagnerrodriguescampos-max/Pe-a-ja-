'use client';

import { Loja } from '@/types';
import { useCarrinhoStore } from '@/stores/carrinho.store';
import { formatCurrency, cn } from '@/lib/utils';
import { X, Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';

interface Props {
  loja: Loja;
  onClose: () => void;
  onCheckout: () => void;
}

export default function CarrinhoDrawer({ loja, onClose, onCheckout }: Props) {
  const { itens, alterarQuantidade, removerItem, subtotal } = useCarrinhoStore();
  const sub = subtotal();

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full max-w-lg rounded-t-3xl max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ShoppingBag size={20} style={{ color: loja.cor_primaria }} />
            <h2 className="font-bold text-gray-800 text-lg">Carrinho</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={22} />
          </button>
        </div>

        {/* Itens */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {itens.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <ShoppingBag size={48} className="mx-auto mb-3 opacity-30" />
              <p>Carrinho vazio</p>
            </div>
          ) : (
            itens.map(item => (
              <div key={item.id} className="flex gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800">{item.nome_snapshot}</p>
                  {item.opcoes.length > 0 && (
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                      {item.opcoes.map(o => o.nome_snapshot).join(', ')}
                    </p>
                  )}
                  {item.observacao && (
                    <p className="text-xs text-gray-400 mt-0.5 italic">"{item.observacao}"</p>
                  )}
                  <p className="font-bold text-sm mt-1" style={{ color: loja.cor_primaria }}>
                    {formatCurrency(item.total)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button onClick={() => removerItem(item.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 size={15} />
                  </button>
                  <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-2 py-1">
                    <button onClick={() => alterarQuantidade(item.id, item.quantidade - 1)}
                      className="text-gray-500 hover:text-gray-800">
                      <Minus size={14} />
                    </button>
                    <span className="text-sm font-bold w-5 text-center">{item.quantidade}</span>
                    <button onClick={() => alterarQuantidade(item.id, item.quantidade + 1)}
                      className="text-gray-500 hover:text-gray-800">
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Rodapé */}
        {itens.length > 0 && (
          <div className="px-5 pb-8 pt-4 border-t border-gray-100">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Subtotal</span>
              <span className="font-medium">{formatCurrency(sub)}</span>
            </div>
            {Number(loja.pedido_minimo) > sub && (
              <p className="text-xs text-red-500 mb-2">
                Pedido mínimo: {formatCurrency(Number(loja.pedido_minimo))}
              </p>
            )}
            <button onClick={onCheckout}
              disabled={sub < Number(loja.pedido_minimo)}
              className="btn-primary w-full mt-3 flex items-center justify-between"
              style={{ backgroundColor: loja.cor_primaria }}>
              <span>Ir para o checkout</span>
              <span className="font-bold">{formatCurrency(sub)}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
