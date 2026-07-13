'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Produto, Loja, GrupoOpcao, Opcao } from '@/types';
import { useCarrinhoStore } from '@/stores/carrinho.store';
import { formatCurrency, cn } from '@/lib/utils';
import { X, Plus, Minus, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  produto: Produto;
  loja: Loja;
  onClose: () => void;
  onAdicionado: () => void;
}

export default function ProdutoModal({ produto, loja, onClose, onAdicionado }: Props) {
  const [quantidade, setQuantidade] = useState(1);
  const [observacao, setObservacao] = useState('');
  const [selecionadas, setSelecionadas] = useState<Record<string, Opcao[]>>({});
  const { adicionarItem } = useCarrinhoStore();

  const precoBase = Number(produto.preco_promocional || produto.preco);

  const totalAdicionais = Object.values(selecionadas)
    .flat()
    .reduce((acc, op) => acc + Number(op.preco_adicional), 0);

  const totalItem = (precoBase + totalAdicionais) * quantidade;

  function toggleOpcao(grupo: GrupoOpcao, opcao: Opcao) {
    setSelecionadas(prev => {
      const atuais = prev[grupo.id] || [];
      if (grupo.tipo === 'unico') {
        return { ...prev, [grupo.id]: [opcao] };
      }
      const jaExiste = atuais.find(o => o.id === opcao.id);
      if (jaExiste) {
        return { ...prev, [grupo.id]: atuais.filter(o => o.id !== opcao.id) };
      }
      const max = grupo.max || 99;
      if (atuais.length >= max) {
        toast.error(`Máximo de ${max} opções para "${grupo.nome}"`);
        return prev;
      }
      return { ...prev, [grupo.id]: [...atuais, opcao] };
    });
  }

  function isOpcaoSelecionada(grupoId: string, opcaoId: string) {
    return (selecionadas[grupoId] || []).some(o => o.id === opcaoId);
  }

  function validarEAdicionar() {
    for (const grupo of produto.grupos_opcao) {
      if (grupo.obrigatorio) {
        const qtd = (selecionadas[grupo.id] || []).length;
        if (qtd < (grupo.min || 1)) {
          toast.error(`Escolha ao menos ${grupo.min || 1} opção em "${grupo.nome}"`);
          return;
        }
      }
    }
    adicionarItem(produto, quantidade, selecionadas, observacao);
    toast.success(`${produto.nome} adicionado!`);
    onAdicionado();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/50"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto">

        {/* Imagem */}
        <div className="relative">
          {produto.imagem_url ? (
            <Image src={produto.imagem_url} alt={produto.nome} width={600} height={280}
              className="w-full h-52 object-cover rounded-t-3xl sm:rounded-t-3xl" />
          ) : (
            <div className="w-full h-40 bg-gradient-to-br from-orange-100 to-red-100 rounded-t-3xl flex items-center justify-center text-6xl">
              🥙
            </div>
          )}
          <button onClick={onClose}
            className="absolute top-4 right-4 bg-black/40 text-white rounded-full p-1.5 hover:bg-black/60 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-5">
          <h2 className="text-xl font-bold text-gray-900">{produto.nome}</h2>
          {produto.descricao && <p className="text-gray-500 text-sm mt-1">{produto.descricao}</p>}
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xl font-bold" style={{ color: loja.cor_primaria }}>
              {formatCurrency(precoBase)}
            </span>
            {produto.preco_promocional && (
              <span className="text-sm text-gray-400 line-through">{formatCurrency(Number(produto.preco))}</span>
            )}
          </div>

          {/* Grupos de opção */}
          {produto.grupos_opcao
            .sort((a, b) => a.ordem - b.ordem)
            .map(grupo => (
              <GrupoOpcaoSection key={grupo.id} grupo={grupo} loja={loja}
                selecionadas={selecionadas[grupo.id] || []}
                onToggle={opcao => toggleOpcao(grupo, opcao)}
                isSelected={(oid) => isOpcaoSelecionada(grupo.id, oid)} />
            ))}

          {/* Observação */}
          <div className="mt-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">Alguma observação?</label>
            <textarea value={observacao} onChange={e => setObservacao(e.target.value)}
              placeholder="Ex: sem cebola, ponto da carne..."
              className="input resize-none h-20 text-sm" maxLength={200} />
          </div>

          {/* Quantidade + Adicionar */}
          <div className="flex items-center gap-4 mt-5">
            <div className="flex items-center gap-3 border border-gray-200 rounded-xl px-3 py-2">
              <button onClick={() => setQuantidade(q => Math.max(1, q - 1))}
                className="text-gray-600 hover:text-gray-900 transition-colors">
                <Minus size={18} />
              </button>
              <span className="font-bold text-lg w-8 text-center">{quantidade}</span>
              <button onClick={() => setQuantidade(q => q + 1)}
                className="text-gray-600 hover:text-gray-900 transition-colors">
                <Plus size={18} />
              </button>
            </div>
            <button onClick={validarEAdicionar}
              className="btn-primary flex-1 flex items-center justify-between"
              style={{ backgroundColor: loja.cor_primaria }}>
              <span>Adicionar</span>
              <span className="font-bold">{formatCurrency(totalItem)}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GrupoOpcaoSection({ grupo, loja, selecionadas, onToggle, isSelected }: {
  grupo: GrupoOpcao; loja: Loja; selecionadas: Opcao[];
  onToggle: (op: Opcao) => void; isSelected: (id: string) => boolean;
}) {
  const [aberto, setAberto] = useState(true);
  const opcoesFiltradas = grupo.opcoes.filter(o => o.ativa).sort((a, b) => a.ordem - b.ordem);

  return (
    <div className="mt-5 border-t border-gray-100 pt-5">
      <button className="w-full flex items-center justify-between" onClick={() => setAberto(!aberto)}>
        <div>
          <span className="font-bold text-gray-800">{grupo.nome}</span>
          {grupo.obrigatorio && (
            <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Obrigatório</span>
          )}
          {!grupo.obrigatorio && grupo.max && (
            <span className="ml-2 text-xs text-gray-400">Até {grupo.max}</span>
          )}
        </div>
        <ChevronDown size={18} className={cn('text-gray-400 transition-transform', aberto && 'rotate-180')} />
      </button>

      {aberto && (
        <div className="mt-3 space-y-2">
          {opcoesFiltradas.map(opcao => {
            const sel = isSelected(opcao.id);
            return (
              <button key={opcao.id} onClick={() => onToggle(opcao)}
                className={cn(
                  'w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left',
                  sel ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5' : 'border-gray-100 hover:border-gray-200'
                )}
                style={sel ? { borderColor: loja.cor_primaria } : {}}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
                    grupo.tipo === 'unico' ? 'rounded-full' : 'rounded-md',
                    sel ? 'bg-[var(--color-primary)] border-[var(--color-primary)]' : 'border-gray-300'
                  )} style={sel ? { backgroundColor: loja.cor_primaria, borderColor: loja.cor_primaria } : {}}>
                    {sel && <div className="w-2 h-2 bg-white rounded-full" />}
                  </div>
                  <span className="text-sm font-medium text-gray-800">{opcao.nome}</span>
                </div>
                {Number(opcao.preco_adicional) > 0 && (
                  <span className="text-sm font-semibold" style={{ color: loja.cor_primaria }}>
                    +{formatCurrency(Number(opcao.preco_adicional))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
