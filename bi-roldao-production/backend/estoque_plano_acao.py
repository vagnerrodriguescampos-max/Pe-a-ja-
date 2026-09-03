"""Plano de Ação operacional do Estoque 360.

O plano reutiliza a decisão oficial de abastecimento/transferência/compra e soma
as ações de excesso e estoque sem venda. Não recalcula compra por uma regra paralela.
"""
from __future__ import annotations

from typing import Any

from .estoque_abastecimento import abastecimento_compra
from .estoque_queries import FiltroEstoque, _rows, _where, resolver_data_posicao


def _prioridade_abastecimento(item: dict[str, Any]) -> str:
    ruptura = bool(item.get("item_ativo")) and bool(item.get("ruptura"))
    sem_pedido = ruptura and float(item.get("pedido_aberto_qtd") or 0) <= 0
    acao = str(item.get("acao_recomendada") or "")
    ddv_proj = item.get("ddv_projetado_31d")

    if sem_pedido and acao in {"COMPRAR", "TRANSFERIR", "TRANSFERIR_E_COMPRAR"}:
        return "P1"
    if ruptura:
        return "P2"
    if ddv_proj is not None and float(ddv_proj) < 7:
        return "P2"
    if acao == "REVISAR_SORTIMENTO":
        return "P3"
    return "P3"


def _responsavel(acao: str, comprador: Any = None) -> tuple[str, str | None]:
    comprador_txt = str(comprador).strip() if comprador not in (None, "") else None
    if acao == "COMPRAR":
        return "COMPRAS", comprador_txt
    if acao == "TRANSFERIR_E_COMPRAR":
        return "COMPRAS + ABASTECIMENTO", comprador_txt
    if acao == "TRANSFERIR":
        return "ABASTECIMENTO / OPERAÇÕES", comprador_txt
    if acao == "AGUARDAR_ABASTECIMENTO":
        return "ABASTECIMENTO / LOGÍSTICA", comprador_txt
    if acao == "REDUZIR_COMPRA_OU_TRANSFERIR":
        return "COMPRAS + ESTOQUE", comprador_txt
    if acao == "REVISAR_SORTIMENTO":
        return "COMERCIAL / COMPRAS", comprador_txt
    return "GESTÃO DE ESTOQUE", comprador_txt


def _acao_legivel(acao: str) -> str:
    return {
        "AGUARDAR_ABASTECIMENTO": "AGUARDAR ABASTECIMENTO",
        "TRANSFERIR": "TRANSFERIR",
        "TRANSFERIR_E_COMPRAR": "TRANSFERIR + COMPRAR",
        "COMPRAR": "COMPRAR",
        "REDUZIR_COMPRA_OU_TRANSFERIR": "REDUZIR COMPRA / TRANSFERIR",
        "REVISAR_SORTIMENTO": "REVISAR SORTIMENTO",
    }.get(acao, acao.replace("_", " "))


def _motivo_legivel(motivo: str) -> str:
    return {
        "ABASTECIMENTO_PREVISTO_COBRE_ALVO": "Trânsito/pedido/carteira já cobrem o alvo",
        "EXCESSO_INTERNO_COBRE_ALVO": "Excesso interno da Regional cobre o déficit",
        "REDE_COBRE_PARCIALMENTE": "Rede cobre parte do déficit; há compra residual",
        "DEFICIT_APOS_ESTOQUE_REDE": "Déficit permanece após considerar abastecimento e estoque da rede",
        "ITEM_INATIVO": "Item inativo requer revisão de sortimento",
        "EXCESSO_COBERTURA": "Cobertura acima do DDV-alvo",
        "SEM_VENDA": "Estoque disponível sem venda no período-base",
    }.get(motivo, motivo.replace("_", " ").capitalize())


def plano_acao_operacional(
    con: Any,
    f: FiltroEstoque,
    *,
    escopo_origem: list[str] | None,
    limite: int = 300,
) -> list[dict[str, Any]]:
    data = resolver_data_posicao(con, f.data_posicao)
    if not data or f.sem_acesso:
        return []

    limite = max(1, min(int(limite), 3000))
    # Busca margem maior antes da ordenação unificada para não perder P1/P2.
    limite_abastecimento = min(max(limite * 3, 300), 2000)
    abastecimento = abastecimento_compra(
        con,
        f,
        escopo_origem=escopo_origem,
        limite=limite_abastecimento,
    )

    acoes: list[dict[str, Any]] = []
    for item in abastecimento:
        acao = str(item.get("acao_recomendada") or "SEM_ACAO")
        if acao == "SEM_ACAO":
            continue
        area, referencia = _responsavel(acao, item.get("comprador"))
        acoes.append({
            "prioridade": _prioridade_abastecimento(item),
            "acao": acao,
            "acao_label": _acao_legivel(acao),
            "motivo": item.get("motivo"),
            "motivo_label": _motivo_legivel(str(item.get("motivo") or "")),
            "responsavel_area": area,
            "responsavel_referencia": referencia,
            "regional": item.get("regional"),
            "loja": item.get("loja"),
            "sku": item.get("sku"),
            "descricao": item.get("descricao"),
            "categoria": item.get("categoria"),
            "fornecedor": item.get("fornecedor"),
            "comprador": item.get("comprador"),
            "curva_abc": item.get("curva_abc"),
            "top_300": item.get("top_300"),
            "nbo": item.get("nbo"),
            "ruptura": item.get("ruptura"),
            "ddv_atual_31d": item.get("ddv_atual_31d"),
            "ddv_projetado_31d": item.get("ddv_projetado_31d"),
            "ddv_pos_transferencia": item.get("ddv_pos_transferencia"),
            "abastecimento_previsto_qtd": item.get("abastecimento_previsto_qtd"),
            "necessidade_qtd": item.get("necessidade_liquida_qtd"),
            "transferencia_sugerida_qtd": item.get("transferencia_interna_qtd"),
            "compra_sugerida_qtd": item.get("compra_sugerida_qtd"),
            "compra_valor_estimado": item.get("compra_valor_estimado"),
        })

    # Excesso e sem venda não pertencem ao motor de reposição; entram como P3.
    where, params = _where(f, data)
    extras = _rows(con.execute(f"""
        SELECT
          regional, loja, sku, descricao, categoria, fornecedor, comprador, curva_abc,
          top_300, nbo, ruptura, ddv_atual_31d, ddv_projetado_31d,
          estoque_disponivel_qtd, estoque_disponivel_valor, venda_31d_qtd,
          CASE
            WHEN COALESCE(venda_31d_qtd,0)=0 AND COALESCE(estoque_disponivel_qtd,0)>0 THEN 'REVISAR_SORTIMENTO'
            WHEN COALESCE(ddv_atual_31d,0)>? THEN 'REDUZIR_COMPRA_OU_TRANSFERIR'
          END acao,
          CASE
            WHEN COALESCE(venda_31d_qtd,0)=0 AND COALESCE(estoque_disponivel_qtd,0)>0 THEN 'SEM_VENDA'
            WHEN COALESCE(ddv_atual_31d,0)>? THEN 'EXCESSO_COBERTURA'
          END motivo,
          CASE WHEN COALESCE(ddv_atual_31d,0)>? AND COALESCE(estoque_disponivel_valor,0)>0
            THEN estoque_disponivel_valor*(1-?/ddv_atual_31d) ELSE 0 END capital_excedente_estimado
        FROM vw_estoque_360 v
        WHERE {where}
          AND (
            (COALESCE(venda_31d_qtd,0)=0 AND COALESCE(estoque_disponivel_qtd,0)>0)
            OR COALESCE(ddv_atual_31d,0)>?
          )
        ORDER BY capital_excedente_estimado DESC NULLS LAST
        LIMIT ?
    """, [f.ddv_alvo, f.ddv_alvo, f.ddv_alvo, f.ddv_alvo, *params, f.ddv_alvo, min(limite * 2, 3000)]))

    chaves_existentes = {(x.get("loja"), x.get("sku"), x.get("acao")) for x in acoes}
    for item in extras:
        acao = str(item.get("acao") or "")
        if not acao or (item.get("loja"), item.get("sku"), acao) in chaves_existentes:
            continue
        area, referencia = _responsavel(acao, item.get("comprador"))
        acoes.append({
            "prioridade": "P3",
            "acao": acao,
            "acao_label": _acao_legivel(acao),
            "motivo": item.get("motivo"),
            "motivo_label": _motivo_legivel(str(item.get("motivo") or "")),
            "responsavel_area": area,
            "responsavel_referencia": referencia,
            "regional": item.get("regional"),
            "loja": item.get("loja"),
            "sku": item.get("sku"),
            "descricao": item.get("descricao"),
            "categoria": item.get("categoria"),
            "fornecedor": item.get("fornecedor"),
            "comprador": item.get("comprador"),
            "curva_abc": item.get("curva_abc"),
            "top_300": item.get("top_300"),
            "nbo": item.get("nbo"),
            "ruptura": item.get("ruptura"),
            "ddv_atual_31d": item.get("ddv_atual_31d"),
            "ddv_projetado_31d": item.get("ddv_projetado_31d"),
            "estoque_disponivel_qtd": item.get("estoque_disponivel_qtd"),
            "estoque_disponivel_valor": item.get("estoque_disponivel_valor"),
            "capital_excedente_estimado": item.get("capital_excedente_estimado"),
            "transferencia_sugerida_qtd": 0,
            "compra_sugerida_qtd": 0,
            "compra_valor_estimado": 0,
        })

    ordem_p = {"P1": 0, "P2": 1, "P3": 2, "P4": 3}
    ordem_a = {
        "COMPRAR": 0,
        "TRANSFERIR_E_COMPRAR": 1,
        "TRANSFERIR": 2,
        "AGUARDAR_ABASTECIMENTO": 3,
        "REDUZIR_COMPRA_OU_TRANSFERIR": 4,
        "REVISAR_SORTIMENTO": 5,
    }
    acoes.sort(key=lambda x: (
        ordem_p.get(str(x.get("prioridade")), 9),
        0 if x.get("top_300") else 1,
        0 if str(x.get("curva_abc") or "").upper() == "A" else 1,
        ordem_a.get(str(x.get("acao")), 9),
        -float(x.get("compra_valor_estimado") or x.get("capital_excedente_estimado") or 0),
        str(x.get("loja") or ""),
        str(x.get("sku") or ""),
    ))
    return acoes[:limite]
