"""KPIs executivos do Cockpit Estoque 360.

Agrega as mesmas decisões canônicas de abastecimento/transferência/compra sem
limitação de linhas, para que os totais executivos não dependam da paginação.
"""
from __future__ import annotations

from typing import Any

from .estoque_abastecimento import cte_decisao_abastecimento
from .estoque_queries import FiltroEstoque, resolver_data_posicao


def kpis_executivos(
    con: Any,
    f: FiltroEstoque,
    *,
    escopo_origem: list[str] | None,
) -> dict[str, Any]:
    data = resolver_data_posicao(con, f.data_posicao)
    if not data or f.sem_acesso:
        return {
            "compra_sugerida_qtd": 0,
            "compra_valor_estimado": 0,
            "transferencia_potencial_qtd": 0,
            "transferencia_valor_estimado": 0,
            "itens_para_comprar": 0,
            "itens_para_transferir": 0,
            "itens_transferir_e_comprar": 0,
            "itens_aguardar_abastecimento": 0,
            "acoes_p1": 0,
            "acoes_p2": 0,
            "acoes_p3": 0,
        }

    cte, params = cte_decisao_abastecimento(
        f,
        data_posicao=data,
        escopo_origem=escopo_origem,
    )
    sql = cte + """
      SELECT
        SUM(COALESCE(compra_sugerida_qtd,0)) compra_sugerida_qtd,
        SUM(COALESCE(compra_valor_estimado,0)) compra_valor_estimado,
        SUM(COALESCE(transferencia_interna_qtd,0)) transferencia_potencial_qtd,
        SUM(COALESCE(transferencia_valor_estimado,0)) transferencia_valor_estimado,
        SUM(CASE WHEN acao_recomendada='COMPRAR' THEN 1 ELSE 0 END) itens_para_comprar,
        SUM(CASE WHEN acao_recomendada='TRANSFERIR' THEN 1 ELSE 0 END) itens_para_transferir,
        SUM(CASE WHEN acao_recomendada='TRANSFERIR_E_COMPRAR' THEN 1 ELSE 0 END) itens_transferir_e_comprar,
        SUM(CASE WHEN acao_recomendada='AGUARDAR_ABASTECIMENTO' THEN 1 ELSE 0 END) itens_aguardar_abastecimento,
        SUM(CASE WHEN prioridade_operacional='P1' THEN 1 ELSE 0 END) acoes_p1,
        SUM(CASE WHEN prioridade_operacional='P2' THEN 1 ELSE 0 END) acoes_p2,
        SUM(CASE WHEN prioridade_operacional='P3' THEN 1 ELSE 0 END) acoes_p3,
        SUM(COALESCE(necessidade_bruta_qtd,0)) necessidade_bruta_qtd,
        SUM(COALESCE(necessidade_liquida_qtd,0)) necessidade_liquida_qtd,
        SUM(COALESCE(abastecimento_previsto_qtd,0)) abastecimento_previsto_qtd
      FROM decisao
      WHERE necessidade_bruta_qtd>0
    """
    cur = con.execute(sql, params)
    row = cur.fetchone()
    nomes = [d[0] for d in cur.description]
    out = dict(zip(nomes, row)) if row else {}
    for chave in nomes:
        if out.get(chave) is None:
            out[chave] = 0
    return out
