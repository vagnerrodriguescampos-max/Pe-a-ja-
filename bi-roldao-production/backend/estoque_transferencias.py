"""Motor conservador de transferências do Estoque 360.

Regras:
- usa somente estoque físico disponível da origem;
- preserva DDV mínimo da origem;
- necessidade do destino desconta trânsito, pedido pendente e carteira;
- mesma Regional é obrigatória por padrão;
- inter-regional somente quando explicitamente permitido;
- cada destino escolhe uma única melhor origem;
- a soma alocada por origem nunca ultrapassa o estoque transferível.
"""
from __future__ import annotations

from typing import Any

from .estoque_queries import FiltroEstoque, resolver_data_posicao, _rows


def _where_transferencia(
    f: FiltroEstoque,
    data_posicao,
    *,
    alias: str = "v",
    regional_expr: str = "regional_resolvida",
) -> tuple[str, list[Any]]:
    if f.sem_acesso:
        return "1=0", []
    cond = [f"{alias}.data_posicao = ?"]
    params: list[Any] = [data_posicao]
    if f.lojas:
        cond.append(f"{alias}.loja IN ({','.join('?' for _ in f.lojas)})")
        params.extend(f.lojas)
    if f.regional not in (None, ""):
        cond.append(f"{regional_expr} = ?")
        params.append(f.regional)
    for campo in ("departamento", "secao", "categoria", "fornecedor", "comprador", "curva_abc"):
        valor = getattr(f, campo)
        if valor not in (None, ""):
            cond.append(f"{alias}.{campo} = ?")
            params.append(valor)
    for campo in ("top_300", "nbo", "tabloide"):
        valor = getattr(f, campo)
        if valor is not None:
            cond.append(f"COALESCE({alias}.{campo}, FALSE) = ?")
            params.append(valor)
    if f.status_estoque:
        cond.append(f"{alias}.status_estoque = ?")
        params.append(f.status_estoque)
    return " AND ".join(cond), params


def transferencias(
    con: Any,
    f: FiltroEstoque,
    limite: int = 200,
    reserva_origem: float = 30.0,
    alvo_destino: float = 30.0,
    permitir_interregional: bool = False,
) -> list[dict]:
    """Sugere transferências sem consumir a reserva mínima da origem.

    O algoritmo é deliberadamente conservador: um destino recebe uma origem por
    rodada. Isso evita dupla alocação de necessidade e, combinado com a janela
    cumulativa por origem, impede que uma loja doe mais que seu excedente físico.
    """
    data = resolver_data_posicao(con, f.data_posicao)
    if not data or f.sem_acesso or len(f.lojas) == 1:
        return []

    reserva = max(1.0, min(float(reserva_origem), 365.0))
    alvo = max(1.0, min(float(alvo_destino), 365.0))
    limit = max(1, min(int(limite), 2000))

    where, p = _where_transferencia(f, data, alias="v", regional_expr="COALESCE(v.regional, lr.regional)")
    regra_regional = "TRUE" if permitir_interregional else (
        "o.regional IS NOT NULL AND d.regional IS NOT NULL AND o.regional = d.regional"
    )

    sql = f"""
      WITH loja_regional AS (
        SELECT loja, MAX(regional) FILTER (WHERE regional IS NOT NULL AND TRIM(regional)<>'') regional
        FROM ruptura_diaria
        WHERE data_posicao = ?
        GROUP BY loja
      ),
      base AS (
        SELECT v.*, COALESCE(v.regional, lr.regional) regional_resolvida
        FROM vw_estoque_360 v
        LEFT JOIN loja_regional lr ON lr.loja=v.loja
        WHERE {where}
      ),
      origem AS (
        SELECT
          loja, sku, descricao, regional_resolvida regional,
          curva_abc, top_300, nbo,
          estoque_disponivel_qtd,
          venda_31d_qtd,
          ddv_atual_31d,
          GREATEST(
            COALESCE(estoque_disponivel_qtd,0) - (COALESCE(venda_31d_qtd,0)/31.0)*?,
            0
          ) transferivel
        FROM base
        WHERE COALESCE(venda_31d_qtd,0)>0
          AND COALESCE(ddv_atual_31d,0)>?
      ),
      destino AS (
        SELECT
          loja, sku, descricao, regional_resolvida regional,
          curva_abc, top_300, nbo, item_ativo, ruptura,
          pedido_aberto_qtd,
          estoque_disponivel_qtd, transito_qtd, pedido_pendente_qtd, carteira_qtd,
          venda_31d_qtd, ddv_atual_31d, ddv_projetado_31d,
          GREATEST(
            (COALESCE(venda_31d_qtd,0)/31.0)*? -
            COALESCE(estoque_disponivel_qtd,0) -
            COALESCE(transito_qtd,0) -
            COALESCE(pedido_pendente_qtd,0) -
            COALESCE(carteira_qtd,0),
            0
          ) necessidade
        FROM base
        WHERE COALESCE(venda_31d_qtd,0)>0
      ),
      candidatos AS (
        SELECT
          d.sku, d.descricao,
          o.loja loja_origem, o.regional regional_origem,
          d.loja loja_destino, d.regional regional_destino,
          o.ddv_atual_31d ddv_origem,
          d.ddv_atual_31d ddv_destino,
          d.ddv_projetado_31d ddv_destino_projetado,
          o.transferivel,
          d.necessidade,
          CASE WHEN o.regional IS NOT NULL AND o.regional=d.regional THEN TRUE ELSE FALSE END mesma_regional,
          CASE
            WHEN COALESCE(d.item_ativo,FALSE) AND COALESCE(d.ruptura,FALSE) AND COALESCE(d.pedido_aberto_qtd,0)<=0 THEN 0
            WHEN COALESCE(d.item_ativo,FALSE) AND COALESCE(d.ruptura,FALSE) THEN 1
            WHEN COALESCE(d.ddv_projetado_31d,999)<7 THEN 2
            ELSE 3
          END prioridade_destino,
          ROW_NUMBER() OVER (
            PARTITION BY d.loja, d.sku
            ORDER BY
              CASE WHEN o.regional IS NOT NULL AND o.regional=d.regional THEN 0 ELSE 1 END,
              o.transferivel DESC,
              o.ddv_atual_31d DESC,
              o.loja
          ) escolha_origem
        FROM origem o
        JOIN destino d ON d.sku=o.sku AND d.loja<>o.loja
        WHERE o.transferivel>0
          AND d.necessidade>0
          AND {regra_regional}
      ),
      escolhidos AS (
        SELECT * FROM candidatos WHERE escolha_origem=1
      ),
      sequenciados AS (
        SELECT *,
          COALESCE(
            SUM(necessidade) OVER (
              PARTITION BY loja_origem, sku
              ORDER BY prioridade_destino, ddv_destino_projetado ASC NULLS FIRST, necessidade DESC, loja_destino
              ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
            ), 0
          ) necessidade_anterior
        FROM escolhidos
      ),
      alocados AS (
        SELECT *,
          GREATEST(LEAST(necessidade, transferivel-necessidade_anterior),0) sugestao_qtd
        FROM sequenciados
      )
      SELECT
        sku, descricao,
        loja_origem, regional_origem,
        loja_destino, regional_destino,
        mesma_regional,
        ddv_origem, ddv_destino, ddv_destino_projetado,
        sugestao_qtd,
        ddv_origem - (sugestao_qtd / NULLIF((SELECT venda_31d_qtd/31.0 FROM base b WHERE b.loja=loja_origem AND b.sku=alocados.sku LIMIT 1),0)) ddv_origem_pos,
        ddv_destino_projetado + (sugestao_qtd / NULLIF((SELECT venda_31d_qtd/31.0 FROM base b WHERE b.loja=loja_destino AND b.sku=alocados.sku LIMIT 1),0)) ddv_destino_pos,
        CASE WHEN mesma_regional THEN 'MESMA_REGIONAL' ELSE 'INTER_REGIONAL' END tipo_movimento
      FROM alocados
      WHERE sugestao_qtd>0
      ORDER BY prioridade_destino, mesma_regional DESC, ddv_destino_projetado ASC NULLS FIRST, sugestao_qtd DESC
      LIMIT ?
    """

    return _rows(con.execute(
        sql,
        [data, *p, reserva, reserva, alvo, limit],
    ))
