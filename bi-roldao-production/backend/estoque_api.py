"""Adaptador de API do Estoque 360.

Mantém a lógica HTTP separada do main.py de produção. O main real poderá delegar
para estas funções sem duplicar filtros, regras ou escopo.
"""
from __future__ import annotations

from typing import Any, Callable

from .estoque_queries import (
    FiltroEstoque,
    abastecimento,
    excesso,
    faixas_cobertura,
    metadados_posicao,
    plano_acao,
    ranking_ruptura,
    resumo,
    transferencias,
)


def extrair_escopo_lojas(usuario: dict[str, Any]) -> list[str] | None:
    """Replica a semântica de segurança do BI: None=irrestrito, []=zero acesso."""
    escopo = (usuario or {}).get("escopo") or {}
    if bool(escopo.get("irrestrito")):
        return None
    lojas = escopo.get("lojas")
    if lojas is None:
        return []
    return [str(loja).strip() for loja in lojas if str(loja).strip()]


def filtro_estoque(corpo: dict | None, usuario: dict[str, Any]) -> tuple[FiltroEstoque, list[str] | None]:
    escopo = extrair_escopo_lojas(usuario)
    return FiltroEstoque.de_dict(corpo or {}, escopo_lojas=escopo), escopo


def _sem_acesso(escopo: list[str] | None) -> bool:
    return escopo is not None and len(escopo) == 0


def _payload_base(con: Any, filtro: FiltroEstoque, escopo: list[str] | None) -> dict[str, Any]:
    if _sem_acesso(escopo):
        return {"ok": True, "sem_acesso": True, "data_posicao": None, "dados": []}
    meta = metadados_posicao(con, filtro)
    return {
        "ok": True,
        "sem_acesso": False,
        "data_posicao": meta.get("data_posicao"),
        "posicao": meta,
    }


def endpoint_resumo(con: Any, corpo: dict | None, usuario: dict[str, Any]) -> dict[str, Any]:
    filtro, escopo = filtro_estoque(corpo, usuario)
    base = _payload_base(con, filtro, escopo)
    if base.get("sem_acesso"): return {**base, "dados": {}}
    return {**base, "dados": resumo(con, filtro, escopo)}


def endpoint_ruptura(con: Any, corpo: dict | None, usuario: dict[str, Any]) -> dict[str, Any]:
    filtro, escopo = filtro_estoque(corpo, usuario)
    base = _payload_base(con, filtro, escopo)
    if base.get("sem_acesso"): return base
    corpo = corpo or {}
    dimensao = str(corpo.get("dimensao") or "loja")
    limite = int(corpo.get("limite") or 50)
    return {**base, "dados": ranking_ruptura(con, filtro, dimensao, limite)}


def endpoint_cobertura(con: Any, corpo: dict | None, usuario: dict[str, Any]) -> dict[str, Any]:
    filtro, escopo = filtro_estoque(corpo, usuario)
    base = _payload_base(con, filtro, escopo)
    if base.get("sem_acesso"): return base
    return {**base, "dados": faixas_cobertura(con, filtro)}


def endpoint_excesso(con: Any, corpo: dict | None, usuario: dict[str, Any]) -> dict[str, Any]:
    filtro, escopo = filtro_estoque(corpo, usuario)
    base = _payload_base(con, filtro, escopo)
    if base.get("sem_acesso"): return base
    limite = int((corpo or {}).get("limite") or 200)
    return {**base, "dados": excesso(con, filtro, limite)}


def endpoint_abastecimento(con: Any, corpo: dict | None, usuario: dict[str, Any]) -> dict[str, Any]:
    filtro, escopo = filtro_estoque(corpo, usuario)
    base = _payload_base(con, filtro, escopo)
    if base.get("sem_acesso"): return base
    limite = int((corpo or {}).get("limite") or 200)
    return {**base, "dados": abastecimento(con, filtro, limite)}


def endpoint_transferencias(con: Any, corpo: dict | None, usuario: dict[str, Any]) -> dict[str, Any]:
    filtro, escopo = filtro_estoque(corpo, usuario)
    base = _payload_base(con, filtro, escopo)
    if base.get("sem_acesso"): return base
    corpo = corpo or {}
    limite = int(corpo.get("limite") or 200)
    reserva = float(corpo.get("reserva_origem") or 30)
    alvo = float(corpo.get("alvo_destino") or 30)
    return {
        **base,
        "dados": transferencias(
            con, filtro, limite=limite,
            reserva_origem=max(1.0, min(reserva,365.0)),
            alvo_destino=max(1.0, min(alvo,365.0)),
        ),
    }


def endpoint_plano_acao(con: Any, corpo: dict | None, usuario: dict[str, Any]) -> dict[str, Any]:
    filtro, escopo = filtro_estoque(corpo, usuario)
    base = _payload_base(con, filtro, escopo)
    if base.get("sem_acesso"): return base
    limite = int((corpo or {}).get("limite") or 300)
    return {**base, "dados": plano_acao(con, filtro, limite)}


ENDPOINTS_ESTOQUE_360: dict[str, Callable[[Any, dict | None, dict[str, Any]], dict[str, Any]]] = {
    "resumo": endpoint_resumo,
    "ruptura": endpoint_ruptura,
    "cobertura": endpoint_cobertura,
    "excesso": endpoint_excesso,
    "abastecimento": endpoint_abastecimento,
    "transferencias": endpoint_transferencias,
    "plano-acao": endpoint_plano_acao,
}


def executar_endpoint(nome: str, con: Any, corpo: dict | None, usuario: dict[str, Any]) -> dict[str, Any]:
    funcao = ENDPOINTS_ESTOQUE_360.get(nome)
    if not funcao:
        raise ValueError(f"Endpoint Estoque 360 desconhecido: {nome}")
    return funcao(con, corpo, usuario)
