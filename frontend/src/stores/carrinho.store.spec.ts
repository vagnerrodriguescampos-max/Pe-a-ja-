import { useCarrinhoStore } from './carrinho.store';
import { Produto, Opcao } from '@/types';

function criarProduto(overrides: Partial<Produto> = {}): Produto {
  return {
    id: 'produto-1',
    loja_id: 'loja-1',
    categoria_id: 'categoria-1',
    nome: 'Shawarma',
    preco: 22,
    status: 'ativo',
    destaque: false,
    ordem: 0,
    grupos_opcao: [],
    ...overrides,
  };
}

function criarOpcao(overrides: Partial<Opcao> = {}): Opcao {
  return {
    id: 'opcao-1',
    grupo_opcao_id: 'grupo-1',
    nome: 'Queijo extra',
    preco_adicional: 3,
    ativa: true,
    ordem: 0,
    ...overrides,
  };
}

describe('useCarrinhoStore', () => {
  beforeEach(() => {
    useCarrinhoStore.setState({ lojaId: null, lojaSlug: null, itens: [] });
  });

  it('adiciona um item simples com o total igual ao preço unitário x quantidade', () => {
    useCarrinhoStore.getState().adicionarItem(criarProduto(), 2, {});

    const itens = useCarrinhoStore.getState().itens;
    expect(itens).toHaveLength(1);
    expect(itens[0].total).toBe(44);
    expect(itens[0].quantidade).toBe(2);
  });

  it('usa o preço promocional quando disponível', () => {
    useCarrinhoStore.getState().adicionarItem(criarProduto({ preco: 22, preco_promocional: 18 }), 1, {});

    expect(useCarrinhoStore.getState().itens[0].preco_unitario).toBe(18);
  });

  it('soma o preço das opções selecionadas ao total do item', () => {
    const opcao = criarOpcao({ preco_adicional: 5 });
    useCarrinhoStore.getState().adicionarItem(criarProduto({ preco: 22 }), 1, { 'grupo-1': [opcao] });

    const item = useCarrinhoStore.getState().itens[0];
    expect(item.opcoes).toHaveLength(1);
    expect(item.total).toBe(27);
  });

  it('remove um item pelo id', () => {
    useCarrinhoStore.getState().adicionarItem(criarProduto(), 1, {});
    const id = useCarrinhoStore.getState().itens[0].id;

    useCarrinhoStore.getState().removerItem(id);

    expect(useCarrinhoStore.getState().itens).toHaveLength(0);
  });

  it('recalcula o total ao alterar a quantidade', () => {
    useCarrinhoStore.getState().adicionarItem(criarProduto({ preco: 22 }), 1, {});
    const id = useCarrinhoStore.getState().itens[0].id;

    useCarrinhoStore.getState().alterarQuantidade(id, 3);

    expect(useCarrinhoStore.getState().itens[0].total).toBe(66);
  });

  it('remove o item quando a quantidade cai para zero ou menos', () => {
    useCarrinhoStore.getState().adicionarItem(criarProduto(), 1, {});
    const id = useCarrinhoStore.getState().itens[0].id;

    useCarrinhoStore.getState().alterarQuantidade(id, 0);

    expect(useCarrinhoStore.getState().itens).toHaveLength(0);
  });

  it('soma o subtotal e o total de todos os itens do carrinho', () => {
    useCarrinhoStore.getState().adicionarItem(criarProduto({ preco: 22 }), 1, {});
    useCarrinhoStore.getState().adicionarItem(criarProduto({ id: 'produto-2', preco: 10 }), 2, {});

    expect(useCarrinhoStore.getState().subtotal()).toBe(42);
    expect(useCarrinhoStore.getState().total()).toBe(42);
  });

  it('soma a quantidade total de itens', () => {
    useCarrinhoStore.getState().adicionarItem(criarProduto(), 2, {});
    useCarrinhoStore.getState().adicionarItem(criarProduto({ id: 'produto-2' }), 3, {});

    expect(useCarrinhoStore.getState().quantidadeTotal()).toBe(5);
  });

  it('limpar esvazia os itens e desvincula a loja', () => {
    useCarrinhoStore.getState().setLoja('loja-1', 'minha-loja');
    useCarrinhoStore.getState().adicionarItem(criarProduto(), 1, {});

    useCarrinhoStore.getState().limpar();

    expect(useCarrinhoStore.getState()).toMatchObject({ itens: [], lojaId: null, lojaSlug: null });
  });
});
