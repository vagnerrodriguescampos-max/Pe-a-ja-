"""Opções de filtros do Estoque 360.

As opções são devolvidas junto do endpoint de resumo para evitar uma rota extra.
A consulta respeita a posição e o escopo de lojas do usuário, mas não altera os
filtros nem fluxos dos módulos legados do BI.
"""
from __future__ import annotations

from typing import Any

from .estoque_queries import FiltroEstoque, resolver_data_posicao


CAMPOS_OPCOES = {
    "regionais": "regional",
    "departamentos": "departamento",
    "categorias": "categoria",
    "fornecedores": "fornecedor",
    "compradores": "comprador",
    "curvas_abc": "curva_abc",
    "status_estoque": "status_estoque",
}


def _lista_distinta(con: Any, campo: str, data_posicao: Any, escopo_lojas: list[str] | None) -> list[str]:
    cond = ["data_posicao = ?", f"{campo} IS NOT NULL", f"TRIM(CAST({campo} AS VARCHAR)) <> ''"]
    params: list[Any] = [data_posicao]
    if escopo_lojas is not None:
        lojas = [str(x).strip() for x in escopo_lojas if str(x).strip()]
        if not lojas:
            return []
        cond.append(f"loja IN ({','.join('?' for _ in lojas)})")
        params.extend(lojas)
    sql = (
        f"SELECT DISTINCT CAST({campo} AS VARCHAR) valor FROM vw_estoque_360 "
        f"WHERE {' AND '.join(cond)} ORDER BY 1"
    )
    return [str(r[0]) for r in con.execute(sql, params).fetchall() if r and r[0] not in (None, "")]


def _posicoes(con: Any, escopo_lojas: list[str] | None, limite: int = 90) -> list[str]:
    cond = []
    params: list[Any] = []
    if escopo_lojas is not None:
        lojas = [str(x).strip() for x in escopo_lojas if str(x).strip()]
        if not lojas:
            return []
        cond.append(f"e.loja IN ({','.join('?' for _ in lojas)})")
        params.extend(lojas)
    where = f"WHERE {' AND '.join(cond)}" if cond else ""
    rows = con.execute(
        f"""
        SELECT DISTINCT e.data_posicao
        FROM estoque_diario e
        WHERE EXISTS (
          SELECT 1 FROM ruptura_diaria r WHERE r.data_posicao=e.data_posicao
        )
        {('AND ' + ' AND '.join(cond)) if cond else ''}
        ORDER BY e.data_posicao DESC
        LIMIT ?
        """,
        [*params, max(1, min(int(limite), 365))],
    ).fetchall()
    return [r[0].isoformat() if hasattr(r[0], "isoformat") else str(r[0]) for r in rows if r and r[0]]


def opcoes_filtros(con: Any, f: FiltroEstoque, escopo_lojas: list[str] | None) -> dict[str, Any]:
    data = resolver_data_posicao(con, f.data_posicao)
    if f.sem_acesso:
        return {"data_posicao": None, "posicoes": [], **{k: [] for k in CAMPOS_OPCOES}}
    if not data:
        return {"data_posicao": None, "posicoes": _posicoes(con, escopo_lojas), **{k: [] for k in CAMPOS_OPCOES}}

    out: dict[str, Any] = {
        "data_posicao": data.isoformat() if hasattr(data, "isoformat") else str(data),
        "posicoes": _posicoes(con, escopo_lojas),
    }
    for chave, campo in CAMPOS_OPCOES.items():
        out[chave] = _lista_distinta(con, campo, data, escopo_lojas)
    return out
