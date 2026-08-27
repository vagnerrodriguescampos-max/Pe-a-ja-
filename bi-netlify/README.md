# BI Roldão (Netlify) — Painel Executivo da DRE

O BI que a operação usa no dia a dia é **um arquivo estático** publicado em
`bi-roldao-comercial.netlify.app`. Ele não tem base embutida: ao abrir, pede a
senha e busca o `seed` na API do Railway (`bi-roldao-api-production`). Interface
mora aqui; dado mora na API.

## O que mudou

A aba **DRE** abria numa "Visão geral" que era um resumo de números soltos. No
lugar dela entrou o **Painel**, que responde na primeira tela as quatro perguntas
de quem decide:

| bloco | pergunta |
|---|---|
| 6 indicadores com sparkline | o que aconteceu no mês |
| *O que mudou vs \<mês\>* | quais contas puxaram o resultado, com valor e % |
| *Exige atenção* | o que precisa de decisão — e **não** repete a lista ao lado |
| Cascata, rankings por loja, evolução | onde agir, para quem for aprofundar |

As quatro abas de detalhamento (Variação de contas, DRE completa, Por loja, Por
regional) continuam como drill-down.

## Convenção de sinal — o detalhe que derruba o relatório

Custo é gravado **negativo**. Então `mês atual − mês anterior` já é o impacto no
resultado, mas a leitura humana exige o verbo certo: uma despesa que piora o
resultado **subiu**, uma receita que piora **caiu**. Publicar "Receita Bruta —
subiu -1,7%" acaba com a credibilidade do painel na primeira reunião.

O mesmo vale para a cor: CMV +8,4% é uma seta para cima e uma notícia ruim.
`deltaBadge(v,{ruimSubir:true})` separa as duas coisas — o sinal segue o número,
a cor segue o impacto.

## Como mexer

`painel.js` é a fonte; `index.html` é o artefato publicado.

```sh
node mock.js seed-teste.json   # base sintética com a forma de parseDreWorkbook
python3 resplice.py            # troca o bloco do painel dentro do index.html
node teste.js                  # Playwright: renderização, textos, layout, erros
```

`mock.js` lê a tabela de linhas do **próprio parser** (`bi-roldao-api/lib.js`) em
vez de copiá-la — uma cópia envelheceria em silêncio e o teste passaria a validar
um formato que a produção não gera mais.

`teste.js` intercepta `/api/seed`, passa pelo portão e confere, entre outras
coisas, que nenhum texto diz "subiu -N%", que os dois painéis da primeira tela
não repetem conteúdo, que nada vaza da largura da tela e que o console fica limpo.

## Publicação

O único arquivo que vai para o ar é `site/index.html`. As ferramentas acima
ficam **fora** de `site/` de propósito: o que está no diretório publicado é
servido a quem abrir a URL.

Existem dois caminhos:

**Manual** — arrastar a pasta `site/` em Netlify → Deploys.

**Automático** — ligar o site `bi-roldao-comercial` a este repositório com
**base directory = `bi-netlify`**. Aí o Netlify lê o `netlify.toml` *desta pasta*
(não o da raiz, que constrói o app Next.js do Peça Já) e publica `site/` sem
rodar build. Cada push na branch de produção vira um deploy; qualquer outra
branch vira só um preview.

O `netlify.toml` da raiz e este aqui não brigam: cada site do Netlify lê o
arquivo da sua própria base directory.
