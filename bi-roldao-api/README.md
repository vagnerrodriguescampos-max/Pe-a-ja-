# bi-roldao-api

Backend do BI que atende **bi-roldao-comercial.netlify.app**.
Roda no Railway (projeto `bi-roldao-api`), com volume persistente montado em `/data`.

> **Origem deste diretório.** Este serviço foi publicado originalmente por linha de
> comando, sem repositório Git vinculado — o código existia em um único lugar: dentro
> do container em execução. Os arquivos abaixo foram recuperados de lá e conferidos
> byte a byte contra os originais, para que passem a existir sob controle de versão.

| Arquivo | Bytes | Conferido |
|---|---|---|
| `server.js` | 5.768 | ⚠️ uma alteração deliberada (ver abaixo) |
| `lib.js` | 17.946 | ✅ idêntico |
| `package.json` | 312 | ✅ idêntico |
| `.gitignore` | 24 | ✅ idêntico |
| `.railwayignore` | 18 | ✅ idêntico |

## Única diferença em relação ao original

O `server.js` do container define a senha com um valor embutido como fallback.
Como este repositório é **público**, esse valor foi removido e a senha passou a vir
apenas de `BIR_PW`, com comportamento *fail-closed* (sem a variável, nenhuma
requisição autentica). Em produção `BIR_PW` já está definida, então o comportamento
em execução é idêntico ao de antes.

## Não recuperados (grandes, e desnecessários enquanto o volume existir)

- `seed-initial.json` (~1,9 MB) — base inicial, copiada para o volume só no primeiro
  boot (`if (!fs.existsSync(SEED_FILE))`).
- `dre-initial.json` (~65 KB) — DRE inicial, injetada só se o seed ainda não tiver `dre`.

Como o volume já contém `seed.json` populado, nenhum dos dois é lido em um novo deploy.
Eles só fariam falta se o volume fosse perdido/recriado do zero.

## Arquitetura

```
Excel (INFORMATIVO DE VENDAS, ~48 MB)
        │  POST /api/upload   (senha via header x-bir-pw)
        ▼
buildSeedFromWorkbook()   lê só 10 abas → economiza memória
        │
        ▼
mergeSeed()   união incremental: nunca apaga, só adiciona/atualiza o novo
        │
        ▼
/data/seed.json  ──  GET /api/seed  ──▶  front-end (Netlify)
```

A DRE é independente da venda: `POST /api/upload-dre` grava `seed.dre` sem tocar no
restante da base, e o merge do informativo preserva a DRE existente.

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | `/` | ping em texto |
| GET | `/health` | status + `meta` + resumo da DRE |
| GET | `/api/seed` | base completa (protegida) |
| POST | `/api/upload` | importa o informativo de vendas |
| POST | `/api/upload-dre` | importa a planilha de DRE |

## Variáveis de ambiente

- `BIR_PW` — senha de acesso (há um padrão embutido no código; **convém trocar**).
- `DATA_DIR` — diretório do volume onde vive `seed.json`.
- `PORT` — injetada pelo Railway.
