# Estoque 360 — Gate de Go-Live

Status atual: **BLOQUEADO POR FONTE DO RUNTIME NÃO RECUPERADA**.

Este arquivo registra o último gate antes de qualquer integração física/deploy do Estoque 360.

## Evidências confirmadas do Railway

- Projeto: `BI Roldao Atacadista`
- Serviço: `bi-roldao`
- Ambiente: `production`
- Runtime: Python 3.12 + FastAPI/Uvicorn
- Start configurado: patch `BI_PATCH_CANAL_IA` + `/app/entrypoint.sh`
- Build copia: `requirements.txt`, `requirements.lock.txt`, `backend/`, `frontend/`, `scripts/`, `entrypoint.sh`, `seed/`
- Volume persistente: `/app/data`
- `/app/data` deve permanecer intocado por qualquer integração de código
- Deployment ativo é redeploy de snapshot Railway; não há source GitHub literal exposto pelo conector
- O shell atual carrega os módulos legados e, nos logs, aparecem simultaneamente `nucleo.js?v=4` e `nucleo.js?v=3`; isso é assunto separado do Estoque 360 e não deve ser alterado neste deploy

## Pontos literais ainda obrigatórios antes do go-live

1. Conteúdo real de `/app/entrypoint.sh` e módulo exato passado ao Uvicorn.
2. Arquivo Python real onde o `FastAPI()` é criado e onde as rotas são registradas.
3. Implementação real de `/api/admin/importar`, para inserir o hook apenas para `ESTOQUE`/`RUPTURA`.
4. Trechos reais de `backend/ia.py` e `backend/ia_ferramentas.py` usados pelo catálogo/prompt/dispatcher atual.
5. HTML real do shell que contém `Canais` e `#view`, para carregar o bootstrap sem alterar páginas existentes.

## Regras de liberação

O go-live só pode avançar quando TODOS os pontos acima tiverem sido recuperados e revisados literalmente. Não é permitido inferir nomes de arquivo, substituir o runtime atual, fazer merge cego da branch Nest/Node antiga ou usar `/app/data` como destino de código.

Mesmo após a leitura literal, produção só pode receber deploy após autorização explícita do usuário.

## Validação já concluída antes deste gate

- Pipeline Excel → python-calamine → staging → DuckDB
- Normalização de lojas/SKUs e FULL OUTER JOIN
- Filtros e escopo de segurança
- 7 rotas FastAPI em runtime controlado
- Abastecimento, Transferências e Plano de Ação
- 7 ferramentas de IA alinhadas às decisões operacionais
- Dry-run fail-closed
- Homologação ponta a ponta
- Segurança/performance final
- CI final: 106 testes aprovados

Este gate existe para impedir que um deploy tecnicamente correto do Estoque 360 seja aplicado sobre o runtime errado do BI atual.
