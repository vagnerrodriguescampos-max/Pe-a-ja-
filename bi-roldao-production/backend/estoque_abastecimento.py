"""Motor de decisão de abastecimento e compra do Estoque 360.

A necessidade é classificada em três camadas, nesta ordem:
1. abastecimento já previsto (trânsito + pedido pendente + carteira);
2. transferência interna usando somente excesso da rede acima do DDV-alvo;
3. compra residual do fornecedor.

A compra é sempre recomendação analítica. Este módulo não emite pedido.
O CTE central é reutilizado pelo detalhamento e pelos KPIs executivos para evitar
fórmulas paralelas.
"""
from __future__ import annotations

from dataclasses import replace
from typing import Any

from .estoque_queries import FiltroEstoque, _rows, resolver_data_posicao
from .estoque_transferencias import _where_transferencia


def cte_decisao_abastecimento(
    f: FiltroEstoque,
    *,
    data_posicao: Any,
    escopo_origem: list[str] | None,
) -> tuple[str, list[Any]]:
    """Retorna o CTE canônico e seus parâmetros, sem SELECT final nem LIMIT."""
    if escopo_origem is None:
        f_origem = replace(f, lojas=(), status_estoque=None)
    else:
        f_origem = replace(
            f,
            lojas=tuple(str(x).strip() for x in escopo_origem if str(x).strip()),
            status_estoque=None,
        )

    where_d, p_d = _where_transferencia(
        f, data_posicao, alias="v", regional_expr="COALESCE(v.regional, lrd.regional)"
    )
    where_o, p_o = _where_transferencia(
        f_origem, data_posicao, alias="v", regional_expr="COALESCE(v.regional, lro.regional)"
    )

    alvo = max(1.0, min(float(f.ddv_alvo), 365.0))
    cte = f"""
      WITH loja_regional AS (
        SELECT loja, MAX(regional) FILTER (WHERE regional IS NOT NULL AND TRIM(regional)<>'') regional
        FROM ruptura_diaria
        WHERE data_posicao = ?
        GROUP BY loja
      ),
      destino_base AS (
        SELECT v.*, COALESCE(v.regional, lrd.regional) regional_resolvida
        FROM vw_estoque_360 v
        LEFT JOIN loja_regional lrd ON lrd.loja=v.loja
        WHERE {where_d}
      ),
      origem_base AS (
        SELECT v.*, COALESCE(v.regional, lro.regional) regional_resolvida
        FROM vw_estoque_360 v
        LEFT JOIN loja_regional lro ON lro.loja=v.loja
        WHERE {where_o}
      ),
      capacidade_rede AS (
        SELECT
          regional_resolvida regional,
          sku,
          SUM(
            GREATEST(
              COALESCE(estoque_disponivel_qtd,0) -
              (COALESCE(venda_31d_qtd,0)/31.0)*?,
              0
            )
          ) transferivel_rede_qtd
        FROM origem_base
        WHERE regional_resolvida IS NOT NULL
          AND COALESCE(venda_31d_qtd,0)>0
          AND COALESCE(ddv_atual_31d,0)>?
        GROUP BY regional_resolvida, sku
      ),
      necessidade AS (
        SELECT
          loja, sku, descricao, regional_resolvida regional,
          departamento, categoria, fornecedor, comprador, curva_abc,
          top_300, nbo, tabloide, item_ativo, ruptura, pedido_aberto_qtd,
          pack, estoque_disponivel_qtd, estoque_disponivel_valor,
          transito_qtd, pedido_pendente_qtd, carteira_qtd,
          venda_31d_qtd, cmv_31d, ddv_atual_31d, ddv_projetado_31d,
          (COALESCE(venda_31d_qtd,0)/31.0)*? estoque_alvo_qtd,
          COALESCE(transito_qtd,0)+COALESCE(pedido_pendente_qtd,0)+COALESCE(carteira_qtd,0) abastecimento_previsto_qtd,
          GREATEST(
            (COALESCE(venda_31d_qtd,0)/31.0)*? - COALESCE(estoque_disponivel_qtd,0),
            0
          ) necessidade_bruta_qtd,
          GREATEST(
            (COALESCE(venda_31d_qtd,0)/31.0)*? -
            COALESCE(estoque_disponivel_qtd,0) -
            COALESCE(transito_qtd,0) -
            COALESCE(pedido_pendente_qtd,0) -
            COALESCE(carteira_qtd,0),
            0
          ) necessidade_liquida_qtd,
          CASE
            WHEN COALESCE(item_ativo,FALSE) AND COALESCE(ruptura,FALSE) AND COALESCE(pedido_aberto_qtd,0)<=0 THEN 0
            WHEN COALESCE(item_ativo,FALSE) AND COALESCE(ruptura,FALSE) THEN 1
            WHEN COALESCE(ddv_projetado_31d,999)<7 THEN 2
            WHEN COALESCE(top_300,FALSE) THEN 3
            WHEN curva_abc='A' THEN 4
            ELSE 5
          END prioridade_ordem
        FROM destino_base
        WHERE COALESCE(venda_31d_qtd,0)>0
      ),
      priorizado AS (
        SELECT
          n.*,
          COALESCE(c.transferivel_rede_qtd,0) transferivel_rede_qtd,
          COALESCE(
            SUM(n.necessidade_liquida_qtd) OVER (
              PARTITION BY n.regional, n.sku
              ORDER BY n.prioridade_ordem, n.ddv_projetado_31d ASC NULLS FIRST,
                       n.necessidade_liquida_qtd DESC, n.loja
              ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
            ), 0
          ) necessidade_anterior_qtd
        FROM necessidade n
        LEFT JOIN capacidade_rede c
          ON c.sku=n.sku AND c.regional=n.regional
      ),
      alocado AS (
        SELECT
          *,
          GREATEST(
            LEAST(
              necessidade_liquida_qtd,
              transferivel_rede_qtd - necessidade_anterior_qtd
            ), 0
          ) transferencia_interna_qtd
        FROM priorizado
      ),
      calculado AS (
        SELECT
          *,
          GREATEST(necessidade_liquida_qtd-transferencia_interna_qtd,0) compra_base_qtd,
          CASE
            WHEN COALESCE(venda_31d_qtd,0)>0
            THEN ddv_projetado_31d + transferencia_interna_qtd/(venda_31d_qtd/31.0)
          END ddv_pos_transferencia,
          CASE
            WHEN COALESCE(venda_31d_qtd,0)>0 THEN cmv_31d/venda_31d_qtd
          END custo_unit_estimado
        FROM alocado
      ),
      decidido AS (
        SELECT
          *,
          CASE
            WHEN item_ativo IS FALSE THEN 0
            WHEN compra_base_qtd<=0 THEN 0
            WHEN COALESCE(pack,0)>0 THEN CEIL(compra_base_qtd/pack)*pack
            ELSE compra_base_qtd
          END compra_sugerida_qtd,
          CASE
            WHEN item_ativo IS FALSE THEN 0
            WHEN compra_base_qtd<=0 THEN 0
            WHEN COALESCE(custo_unit_estimado,0)>0 THEN
              (CASE WHEN COALESCE(pack,0)>0 THEN CEIL(compra_base_qtd/pack)*pack ELSE compra_base_qtd END)
              * custo_unit_estimado
            ELSE NULL
          END compra_valor_estimado,
          CASE
            WHEN item_ativo IS FALSE THEN 0
            WHEN transferencia_interna_qtd>0 AND COALESCE(custo_unit_estimado,0)>0
              THEN transferencia_interna_qtd*custo_unit_estimado
            ELSE 0
          END transferencia_valor_estimado,
          CASE
            WHEN item_ativo IS FALSE THEN 'REVISAR_SORTIMENTO'
            WHEN necessidade_bruta_qtd>0 AND necessidade_liquida_qtd<=0 THEN 'AGUARDAR_ABASTECIMENTO'
            WHEN necessidade_liquida_qtd>0 AND transferencia_interna_qtd>=necessidade_liquida_qtd THEN 'TRANSFERIR'
            WHEN transferencia_interna_qtd>0 AND compra_base_qtd>0 THEN 'TRANSFERIR_E_COMPRAR'
            WHEN compra_base_qtd>0 THEN 'COMPRAR'
            ELSE 'SEM_ACAO'
          END acao_recomendada,
          CASE
            WHEN item_ativo IS FALSE THEN 'ITEM_INATIVO'
            WHEN necessidade_bruta_qtd>0 AND necessidade_liquida_qtd<=0 THEN 'ABASTECIMENTO_PREVISTO_COBRE_ALVO'
            WHEN necessidade_liquida_qtd>0 AND transferencia_interna_qtd>=necessidade_liquida_qtd THEN 'EXCESSO_INTERNO_COBRE_ALVO'
            WHEN transferencia_interna_qtd>0 AND compra_base_qtd>0 THEN 'REDE_COBRE_PARCIALMENTE'
            WHEN compra_base_qtd>0 THEN 'DEFICIT_APOS_ESTOQUE_REDE'
            ELSE 'COBERTURA_SUFICIENTE'
          END motivo
        FROM calculado
      ),
      decisao AS (
        SELECT
          *,
          CASE
            WHEN COALESCE(item_ativo,FALSE) AND COALESCE(ruptura,FALSE)
              AND COALESCE(pedido_aberto_qtd,0)<=0
              AND acao_recomendada IN ('COMPRAR','TRANSFERIR','TRANSFERIR_E_COMPRAR') THEN 'P1'
            WHEN COALESCE(item_ativo,FALSE) AND COALESCE(ruptura,FALSE) THEN 'P2'
            WHEN COALESCE(ddv_projetado_31d,999)<7 THEN 'P2'
            WHEN acao_recomendada<>'SEM_ACAO' THEN 'P3'
            ELSE 'OK'
          END prioridade_operacional
        FROM decidido
      )
    """
    params = [data_posicao, *p_d, *p_o, alvo, alvo, alvo, alvo, alvo]
    return cte, params


def abastecimento_compra(
    con: Any,
    f: FiltroEstoque,
    *,
    escopo_origem: list[str] | None,
    limite: int = 200,
) -> list[dict]:
    """Classifica a necessidade por loja/SKU sem recomendar compra desnecessária."""
    data = resolver_data_posicao(con, f.data_posicao)
    if not data or f.sem_acesso:
        return []

    cte, params = cte_decisao_abastecimento(
        f,
        data_posicao=data,
        escopo_origem=escopo_origem,
    )
    limit = max(1, min(int(limite), 2000))
    sql = cte + """
      SELECT
        loja, sku, descricao, regional, departamento, categoria, fornecedor, comprador,
        curva_abc, top_300, nbo, tabloide, item_ativo, ruptura,
        ddv_atual_31d, ddv_projetado_31d, ddv_pos_transferencia,
        estoque_disponivel_qtd, estoque_alvo_qtd,
        abastecimento_previsto_qtd,
        necessidade_bruta_qtd,
        necessidade_liquida_qtd,
        necessidade_liquida_qtd AS necessidade_qtd,
        transferivel_rede_qtd,
        transferencia_interna_qtd,
        transferencia_valor_estimado,
        compra_sugerida_qtd,
        compra_valor_estimado,
        acao_recomendada,
        motivo,
        prioridade_operacional
      FROM decisao
      WHERE necessidade_bruta_qtd>0
      ORDER BY prioridade_ordem,
        CASE acao_recomendada
          WHEN 'COMPRAR' THEN 0
          WHEN 'TRANSFERIR_E_COMPRAR' THEN 1
          WHEN 'TRANSFERIR' THEN 2
          WHEN 'AGUARDAR_ABASTECIMENTO' THEN 3
          ELSE 4 END,
        compra_sugerida_qtd DESC NULLS LAST,
        necessidade_liquida_qtd DESC
      LIMIT ?
    """
    return _rows(con.execute(sql, [*params, limit]))
