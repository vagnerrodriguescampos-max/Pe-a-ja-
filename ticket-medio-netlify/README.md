# Ticket médio por canal (Netlify)

Dashboard estático que separa a performance do **piso** do que veio de
**televendas** e **e-commerce**, loja a loja. Página única, sem build e sem API:
os dados do período estão embutidos no próprio `site/index.html`.

## O cálculo

A aba `PISO+E-COMMERCE+TELEVENDAS` da base traz os três canais somados. O piso é
o resíduo:

```
piso = consolidada − televendas − e-commerce
```

aplicado **dia a dia e loja a loja**, tanto no valor quanto na contagem de
clientes — que é o denominador do ticket médio.

| canal | regra de contagem |
|---|---|
| televendas | mesmo cliente + mesma loja + mesmo dia = **1 venda** |
| e-commerce | 1 pedido iFood = 1 venda, valor de mercadoria sem frete |
| piso | o que sobra da subtração, inclusive nos clientes |

A de-duplicação do televendas importa: sem ela o ticket do canal cai de
R$ 2.936,50 para R$ 2.555,27, porque um pedido quebrado em quatro lançamentos
por limite de cartão contaria como quatro vendas.

## O resultado que motivou o painel

O ticket médio que a base publica (R$ 146,07) **não é o do piso**. O televendas
atende 0,37% dos clientes e leva 7,3% do faturamento, com ticket 22× maior — ele
sozinho puxa o indicador para cima.

| canal | ticket médio | clientes | faturamento |
|---|---|---|---|
| piso | R$ 133,35 | 1.420.037 | R$ 189,4 mi |
| televendas | R$ 2.936,50 | 5.389 | R$ 15,8 mi |
| e-commerce | R$ 208,02 | 48.872 | R$ 10,2 mi |
| total | R$ 146,07 | 1.474.298 | R$ 215,4 mi |

Lido por loja, a distorção acompanha o peso do televendas: onde ele passa de 13%
da venda, o ticket publicado está inflado em 15% ou mais.

## Seleção de período

A página carrega a base diária inteira (38 lojas x 27 dias) e recalcula tudo no
navegador quando o período muda — indicadores, gráficos, ranking e tabela. Não
há servidor nem chamada de rede: o filtro é aritmética sobre uma matriz
embarcada.

Os clientes únicos são o único número que não sai de soma: um cliente que compra
em três dias é um só no mês, mas apareceria como três. Para resolver isso a
página guarda, por loja e por dia, os ids dos clientes em base36 — só os ids, os
nomes não vão para o ar — e faz a união do conjunto no período escolhido. Custa
cerca de 240 KB e é o que permite responder "quantos clientes distintos" para
qualquer recorte.

O bloco de dia da semana some quando a seleção cobre menos de três dias
diferentes da semana: comparar "melhor dia" com uma ou duas barras não diz nada.

## Publicação

O site é servido da subpasta `site/`, então só o `index.html` vai para o ar.
Base disponível: 01/08 a 27/08/2026.

Para atualizar com um novo mês, gere o `index.html` novamente e substitua o
arquivo — não há estado nem dependência externa além das fontes do Google.

## Ponto de atenção

A de-duplicação do televendas usa o **nome** do cliente. Nomes curtos e repetidos
("ANTONIO", "CARLA") podem juntar pessoas distintas da mesma loja no mesmo dia.
O efeito é pequeno, mas havendo código de cliente na base ele daria um corte
exato — vale trocar o critério quando a coluna existir.
