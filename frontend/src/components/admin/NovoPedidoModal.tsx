'use client';

import { useEffect, useMemo, useState } from 'react';
import { adminGetLoja, adminCriarPedidoManual, getCardapio } from '@/lib/api';
import { buscarCep, cepCompleto, formatarCep } from '@/lib/cep';
import { formatCurrency } from '@/lib/utils';
import { Categoria, GrupoOpcao, Opcao, Produto } from '@/types';
import { Minus, Plus, Search, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';

type ItemMontado = {
  chave: string;
  produto: Produto;
  quantidade: number;
  opcoes: Opcao[];
  observacao: string;
};

/**
 * Lançamento manual de pedido que chegou por telefone/WhatsApp.
 *
 * Repete a montagem de item do cardápio do cliente (inclusive grupos de opção
 * obrigatórios) porque o backend recusa o pedido se um grupo obrigatório vier
 * sem seleção — deixar isso de fora tornaria a tela inútil para pizza, tamanho
 * e qualquer produto com escolha.
 */
export default function NovoPedidoModal({ onFechar, onCriado }: {
  onFechar: () => void;
  onCriado: () => void;
}) {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [busca, setBusca] = useState('');
  const [montando, setMontando] = useState<Produto | null>(null);
  const [selecao, setSelecao] = useState<Record<string, Opcao[]>>({});
  const [obsItem, setObsItem] = useState('');
  const [itens, setItens] = useState<ItemMontado[]>([]);

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [tipo, setTipo] = useState<'entrega' | 'retirada'>('entrega');
  const [formaPagamento, setFormaPagamento] = useState('dinheiro');
  const [observacoes, setObservacoes] = useState('');

  const [cep, setCep] = useState('');
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [buscandoCep, setBuscandoCep] = useState(false);

  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    adminGetLoja()
      .then(loja => getCardapio(loja.slug))
      .then(setCategorias)
      .catch(() => toast.error('Não foi possível carregar o cardápio'));
  }, []);

  // CEP preenche o endereço; o atendente ainda pode corrigir tudo na mão.
  useEffect(() => {
    if (!cepCompleto(cep)) return;
    let cancelado = false;
    setBuscandoCep(true);
    buscarCep(cep)
      .then(end => {
        if (cancelado || !end) return;
        if (end.logradouro) setRua(end.logradouro);
        if (end.bairro) setBairro(end.bairro);
        if (end.cidade) setCidade(end.cidade);
        if (end.estado) setEstado(end.estado);
      })
      .finally(() => { if (!cancelado) setBuscandoCep(false); });
    return () => { cancelado = true; };
  }, [cep]);

  const produtos = useMemo(() => {
    const todos = categorias.flatMap(c => c.produtos || []);
    const termo = busca.trim().toLowerCase();
    const disponiveis = todos.filter(p => p.status === 'ativo');
    if (!termo) return disponiveis.slice(0, 8);
    return disponiveis.filter(p => p.nome.toLowerCase().includes(termo)).slice(0, 8);
  }, [categorias, busca]);

  const subtotal = itens.reduce((acc, it) => {
    const adicionais = it.opcoes.reduce((s, o) => s + Number(o.preco_adicional), 0);
    const base = Number(it.produto.preco_promocional || it.produto.preco);
    return acc + (base + adicionais) * it.quantidade;
  }, 0);

  function abrirProduto(p: Produto) {
    setMontando(p);
    setObsItem('');
    // Grupo de escolha única já vem com a primeira opção marcada: é o caso mais
    // comum no balcão e poupa um clique por item.
    const inicial: Record<string, Opcao[]> = {};
    for (const g of p.grupos_opcao || []) {
      if (g.tipo === 'unico' && g.obrigatorio && g.opcoes?.length) inicial[g.id] = [g.opcoes[0]];
    }
    setSelecao(inicial);
  }

  function alternarOpcao(grupo: GrupoOpcao, opcao: Opcao) {
    setSelecao(atual => {
      const atuais = atual[grupo.id] || [];
      if (grupo.tipo === 'unico') return { ...atual, [grupo.id]: [opcao] };
      const jaTem = atuais.some(o => o.id === opcao.id);
      if (jaTem) return { ...atual, [grupo.id]: atuais.filter(o => o.id !== opcao.id) };
      if (grupo.max && atuais.length >= grupo.max) {
        toast.error(`Máximo de ${grupo.max} em ${grupo.nome}`);
        return atual;
      }
      return { ...atual, [grupo.id]: [...atuais, opcao] };
    });
  }

  function confirmarItem() {
    if (!montando) return;
    for (const g of montando.grupos_opcao || []) {
      const escolhidas = selecao[g.id] || [];
      if (g.obrigatorio && escolhidas.length < Math.max(1, g.min || 1)) {
        toast.error(`Escolha ${Math.max(1, g.min || 1)} em "${g.nome}"`);
        return;
      }
    }
    const opcoes = Object.values(selecao).flat();
    setItens(prev => [...prev, {
      chave: `${montando.id}-${Date.now()}`,
      produto: montando,
      quantidade: 1,
      opcoes,
      observacao: obsItem.trim(),
    }]);
    setMontando(null);
    setBusca('');
  }

  function mudarQuantidade(chave: string, delta: number) {
    setItens(prev => prev.flatMap(it => {
      if (it.chave !== chave) return [it];
      const q = it.quantidade + delta;
      return q <= 0 ? [] : [{ ...it, quantidade: q }];
    }));
  }

  async function salvar() {
    if (!nome.trim() || telefone.replace(/\D/g, '').length < 8) {
      toast.error('Informe nome e telefone do cliente');
      return;
    }
    if (itens.length === 0) {
      toast.error('Adicione pelo menos um item');
      return;
    }
    if (tipo === 'entrega' && (!rua.trim() || !numero.trim() || !bairro.trim() || !cidade.trim())) {
      toast.error('Preencha o endereço de entrega');
      return;
    }

    setSalvando(true);
    try {
      await adminCriarPedidoManual({
        tipo,
        forma_pagamento: formaPagamento,
        observacoes: observacoes.trim() || undefined,
        cliente: { nome: nome.trim(), telefone: telefone.replace(/\D/g, '') },
        endereco: tipo === 'entrega'
          ? { rua, numero, complemento, bairro, cidade, estado, cep, referencia: '' }
          : null,
        itens: itens.map(it => ({
          produto_id: it.produto.id,
          quantidade: it.quantidade,
          observacao: it.observacao || undefined,
          opcoes: it.opcoes.map(o => ({ opcao_id: o.id })),
        })),
      });
      toast.success('Pedido lançado');
      onCriado();
      onFechar();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Não foi possível lançar o pedido');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="admin-dark fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white w-full md:max-w-2xl md:rounded-2xl rounded-t-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 shrink-0">
          <h2 className="text-section-title text-gray-900">Novo pedido</h2>
          <button onClick={onFechar} aria-label="Fechar" className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Cliente */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input className="input" placeholder="Nome do cliente *" value={nome} onChange={e => setNome(e.target.value)} />
            <input className="input" placeholder="Telefone *" value={telefone} onChange={e => setTelefone(e.target.value)} inputMode="tel" />
          </div>

          {/* Tipo */}
          <div className="flex gap-2">
            {(['entrega', 'retirada'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTipo(t)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  tipo === t
                    ? 'bg-[var(--admin-accent)] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {t === 'entrega' ? 'Entrega' : 'Retirada'}
              </button>
            ))}
          </div>

          {tipo === 'entrega' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <input
                    className="input"
                    placeholder="CEP"
                    value={cep}
                    onChange={e => setCep(formatarCep(e.target.value))}
                    inputMode="numeric"
                  />
                  {buscandoCep && <p className="text-caption text-gray-400 mt-1">Buscando endereço...</p>}
                </div>
                <input className="input" placeholder="Bairro *" value={bairro} onChange={e => setBairro(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input className="input sm:col-span-2" placeholder="Rua *" value={rua} onChange={e => setRua(e.target.value)} />
                <input className="input" placeholder="Nº *" value={numero} onChange={e => setNumero(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input className="input" placeholder="Complemento" value={complemento} onChange={e => setComplemento(e.target.value)} />
                <input className="input" placeholder="Cidade *" value={cidade} onChange={e => setCidade(e.target.value)} />
                <input className="input" placeholder="UF" value={estado} onChange={e => setEstado(e.target.value)} maxLength={2} />
              </div>
            </div>
          )}

          {/* Itens já montados */}
          {itens.length > 0 && (
            <div className="space-y-2">
              {itens.map(it => (
                <div key={it.chave} className="p-3 rounded-xl bg-gray-50 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{it.produto.nome}</p>
                    {it.opcoes.length > 0 && (
                      <p className="text-caption text-gray-500 mt-0.5">
                        {it.opcoes.map(o => o.nome).join(', ')}
                      </p>
                    )}
                    {it.observacao && (
                      <p className="text-caption text-gray-400 mt-0.5">Obs: {it.observacao}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => mudarQuantidade(it.chave, -1)} aria-label="Diminuir" className="w-7 h-7 rounded-lg bg-gray-200 text-gray-700 flex items-center justify-center">
                      <Minus size={14} />
                    </button>
                    <span className="text-sm w-5 text-center text-gray-900">{it.quantidade}</span>
                    <button onClick={() => mudarQuantidade(it.chave, 1)} aria-label="Aumentar" className="w-7 h-7 rounded-lg bg-gray-200 text-gray-700 flex items-center justify-center">
                      <Plus size={14} />
                    </button>
                    <button onClick={() => setItens(p => p.filter(x => x.chave !== it.chave))} aria-label="Remover" className="text-red-500 ml-1">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Buscar produto */}
          {!montando && (
            <div>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className="input pl-9"
                  placeholder="Buscar produto para adicionar"
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                />
              </div>
              {produtos.length > 0 && (
                <div className="mt-2 space-y-1">
                  {produtos.map(p => (
                    <button
                      key={p.id}
                      onClick={() => abrirProduto(p)}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-gray-100 flex justify-between items-center transition-colors"
                    >
                      <span className="text-sm text-gray-800 truncate">{p.nome}</span>
                      <span className="text-caption text-gray-500 shrink-0 ml-2">
                        {formatCurrency(Number(p.preco_promocional || p.preco))}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Montagem do item selecionado */}
          {montando && (
            <div className="p-3 rounded-xl border border-[var(--admin-accent)]/40 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">{montando.nome}</p>
                <button onClick={() => setMontando(null)} className="text-caption text-gray-500">Cancelar</button>
              </div>

              {(montando.grupos_opcao || []).map(g => (
                <div key={g.id}>
                  <p className="text-caption text-gray-600 mb-1">
                    {g.nome}{g.obrigatorio && <span className="text-red-500"> *</span>}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(g.opcoes || []).filter(o => o.ativa !== false).map(o => {
                      const ativa = (selecao[g.id] || []).some(s => s.id === o.id);
                      return (
                        <button
                          key={o.id}
                          onClick={() => alternarOpcao(g, o)}
                          className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                            ativa
                              ? 'bg-[var(--admin-accent)] text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {o.nome}
                          {Number(o.preco_adicional) > 0 && ` +${formatCurrency(Number(o.preco_adicional))}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <input
                className="input"
                placeholder="Observação do item (opcional)"
                value={obsItem}
                onChange={e => setObsItem(e.target.value)}
              />
              <button onClick={confirmarItem} className="btn-admin-primary w-full py-2.5">
                Adicionar ao pedido
              </button>
            </div>
          )}

          {/* Pagamento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select className="input" value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)}>
              <option value="dinheiro">Dinheiro</option>
              <option value="pix">PIX</option>
              <option value="debito">Débito</option>
              <option value="credito">Crédito</option>
            </select>
            <input
              className="input"
              placeholder="Observações do pedido"
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
            />
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 shrink-0">
          <div className="flex justify-between text-sm mb-3">
            <span className="text-gray-600">Subtotal dos itens</span>
            <span className="font-semibold text-gray-900">{formatCurrency(subtotal)}</span>
          </div>
          <p className="text-caption text-gray-400 mb-3">
            A taxa de entrega e o total final são calculados pelo sistema ao salvar.
          </p>
          <button onClick={salvar} disabled={salvando} className="btn-admin-primary w-full py-3">
            {salvando ? 'Lançando...' : 'Lançar pedido'}
          </button>
        </div>
      </div>
    </div>
  );
}
