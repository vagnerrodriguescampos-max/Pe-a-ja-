# Roldão BI — Cockpit de Performance Comercial

Sistema de Business Intelligence para a rede de atacarejo **Roldão Atacadista**. Importa a planilha "INFORMATIVO DE VENDAS" (ou qualquer versão futura dela), reconhece automaticamente abas/colunas/dimensões, e alimenta um cockpit executivo com KPIs, rankings, forecast, alertas e oportunidades — tudo recalculado ao vivo a partir dos filtros globais.

> Este diretório é um app Next.js independente dentro do monorepo, sem qualquer relação com o `frontend/`/`backend/` do projeto "Peça Já" já existente no repositório.

## Como rodar

O armazenamento (histórico de importações, fatos, configurações) usa **Netlify Blobs** — para ter isso emulado localmente, rode com o Netlify CLI:

```bash
cd roldao-bi
npm install
npx netlify link --id <SITE_ID>   # uma vez, para conectar ao site bi-roldao
npx netlify dev                    # http://localhost:8888
```

`npm run dev` (sem o CLI) também sobe o site, mas qualquer rota que leia/grave dados (import, KPIs, config...) falha com "environment has not been configured to use Netlify Blobs" — use `netlify dev` para ter isso funcionando localmente.

Não há nenhuma base pré-carregada — a tela inicial pede para importar uma planilha. Para gerar uma planilha de exemplo (dados fictícios, mesma estrutura de abas do Roldão) e testar o fluxo completo sem precisar do arquivo real:

```bash
npm run sample:generate     # gera sample/roldao-informativo-vendas-exemplo.xlsx
```

Depois é só ir em **Importar Base** e enviar o arquivo gerado (ou a planilha real do Roldão).

```bash
npm run build && npm start  # build de produção
```

## Arquitetura

```
src/
  lib/
    types.ts              modelo de dados (FactRow, SheetRole, CanonicalField, ImportRecord...)
    mapping/               motor de mapeamento semântico
      aliases.ts            dicionário de sinônimos por campo/aba, extraído dos cabeçalhos reais do Roldão
      normalize.ts           normalização de texto (acentos, maiúsculas, pontuação)
      fuzzy.ts                similaridade aproximada (Levenshtein) p/ pequenas variações de nomenclatura
      columnClassifier.ts    reconhece coluna de período ("1/8", "14-ago.", "jun.-25") vs. dimensão vs. métrica
      sheetRoles.ts           classifica o NOME da aba em um papel de negócio conhecido
      canal.ts                canoniza grafias de canal ("TELEVENDAS"/"Televendas" -> "Televendas")
    ingest/
      parseWorkbook.ts       motor de importação: lê o .xlsx, monta o plano de colunas por aba,
                              "despivota" colunas de período em linhas de fato, enriquece dimensões
      cellUtils.ts            parsing de número/data tolerante a formatos BR
      runImport.ts             orquestra parseWorkbook + grava no histórico
    store/                  persistência em Netlify Blobs — registry de importações + fatos por importação
    query/                  filtros, agregação, ranking, resolução de "abas primárias" (evita dupla contagem)
    kpi/                    fórmulas executivas, forecast, gauge, alertas/oportunidades, qualidade da base
  app/
    api/                    rotas server-side (upload, kpis, rankings, séries, alertas, etc.)
    <páginas>/page.tsx      Visão Executiva, Vendas, Orçamento, Regionais, Lojas, Categorias, Segmentos,
                              Subcategorias, Canais, Piso, Venda Diária, Acumulado, Alertas, Oportunidades,
                              Importar Base, Qualidade dos Dados, Configurações
  components/               design system (KPI card, gauge, gráficos, tabelas, filtros, layout)
```

### Modelo de dados (camada bruta → camada tratada)

Cada linha original de cada aba é preservada (nunca alterada). Sobre ela, o motor de mapeamento reconhece dimensões (`loja_codigo`, `loja_nome`, `regional`, `empresa`, `categoria`, `segmento`, `subcategoria`, `canal`, `data`/`ano`/`mes`/`dia`) e métricas (`venda_bruta`, `orcamento`, `piso`, `margem`, `clientes`, `ticket_medio`, `crescimento_pct`, `atingimento_pct`, `participacao_pct`) por **similaridade semântica de cabeçalho** — não por nome exato — para tolerar planilhas futuras com pequenas variações ("Loja" vs "Nº Loja" vs "Cod Loja"). Tudo que não é reconhecido continua disponível em `extras` de cada linha — nada é descartado.

Colunas de período (dias do mês, "jun.-25", anos lado a lado) são automaticamente "despivotadas": cada uma vira uma leitura própria com sua dimensão de tempo, para permitir comparações ano a ano sem depender de uma coluna "% vs ano anterior" pronta.

Uma camada de **enriquecimento** roda depois da importação: relação loja→regional/empresa e subcategoria→segmento→categoria é aprendida a partir de qualquer aba que já traga essa relação (`Base nova regional`, `Base loja`, `Base Segmento`, `Procv categoria`...) e aplicada às linhas que não têm essa dimensão — sem nunca sobrescrever um valor já existente.

### Evitando dupla contagem entre abas

Várias abas descrevem a mesma venda em recortes diferentes (por loja/dia, por segmento, por canal, resumo mensal executivo...). Somar a métrica de vendas de todas elas indiscriminadamente multiplicaria o total. Por isso, os KPIs de **empresa/loja/regional** usam como fonte primária apenas as abas mais granulares (`ORÇADO` e `base`, ver `lib/query/primary.ts`); as análises de categoria/segmento/subcategoria/canal usam integralmente as abas específicas de cada corte, que não se sobrepõem às primárias.

### Regra de confiabilidade

Cada indicador carrega uma `source`:
- **`planilha`** — soma direta de uma métrica que existe literalmente na base.
- **`calculado`** — resultado de uma fórmula do BI (razão, diferença, projeção).
- **`indisponivel`** — a base filtrada não contém a métrica; o sistema nunca preenche com valor fictício.

Isso é exibido no tooltip de cada KPI card. Quando a própria planilha já fornece um indicador oficial (ex.: "Meta %"), ele é priorizado sobre o equivalente calculado pelo BI, no grão em que está disponível.

## Importação de novas planilhas

`Importar Base` aceita qualquer nova versão do arquivo — não é preciso reconstruir nada. O histórico de importações fica no Netlify Blobs (store `roldao-bi`, escopo global — sobrevive a novos deploys) e nunca é apagado automaticamente; é possível reativar uma importação anterior a qualquer momento para comparação. Cada importação registra, por aba: papel identificado, linhas válidas/erro, colunas mapeadas e colunas não reconhecidas — visível também em **Qualidade dos Dados**.

## Deploy no Netlify

O site `bi-roldao` (https://bi-roldao.netlify.app) já foi criado na conta Netlify do usuário. `netlify.toml` já configura o build (`npm run build`) e o plugin oficial `@netlify/plugin-nextjs`.

Duas formas de publicar:

1. **CLI/API** (deploy único, a partir de `roldao-bi/`):
   ```bash
   npx @netlify/mcp@latest --site-id <SITE_ID> --proxy-path "<PROXY_PATH_TOKEN>"
   ```
   (peça um comando com token novo — o token de deploy expira).

2. **Git-based (recomendado, deploy contínuo)**: no painel do site → *Site configuration → Build & deploy → Link repository* → repositório `vagnerrodriguescampos-max/Pe-a-ja-`, **base directory** `roldao-bi`, branch desejada. A partir daí todo push já builda e publica automaticamente.

A persistência via Netlify Blobs funciona sem nenhuma configuração adicional em produção (provisionada automaticamente pelo runtime do Netlify).

## Limitações conhecidas / próximos passos

- **Margem**: nenhuma das abas do arquivo padrão traz margem bruta explicitamente — os KPIs de margem aparecem como "indisponível" até que uma aba com essa métrica exista (o motor a reconheceria automaticamente).
- **Exportação**: implementada em CSV (`/api/export/csv`); exportação em Excel/PDF/imagem do dashboard ficou fora do escopo desta primeira versão.
- **Heatmaps**: implementado Loja × Dia (Venda Diária). Categoria/Segmento/Subcategoria × Período podem ser adicionados reaproveitando `HeatmapGrid` + uma nova rota de agregação 2D.
- **Autenticação**: o "usuário logado" no cabeçalho é configurável em Configurações; não há login/multiusuário nesta versão.
- **Consistência dos Blobs**: leitura "eventualmente consistente" por padrão (propagação em até ~60s); como o volume de escritas é baixo (uma por importação/config), isso raramente é perceptível. Para múltiplos usuários editando simultaneamente, considerar `consistency: 'strong'` no store.

## Segurança

O parser de Excel (`xlsx`/SheetJS) tem advisories públicos conhecidos (ReDoS e prototype pollution ao processar arquivos adversariais) sem uma versão corrigida publicada no registro npm no momento — a correção oficial da SheetJS está disponível apenas via CDN próprio, inacessível a partir deste ambiente de build. Mitigações aplicadas: limite de 200 MB por upload, e a rota de upload deve ficar atrás de autenticação em produção (este BI é uma ferramenta interna, não um endpoint público). Reavalie a origem do pacote `xlsx` antes de expor a importação publicamente.
