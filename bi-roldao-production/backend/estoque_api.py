"""Adaptador de API do Estoque 360.

Mantém a lógica HTTP separada do main.py de produção. O main real poderá delegar
para estas funções sem duplicar filtros, regras ou escopo.
"""
from __future__ import annotations

from typing import Any, Callable

from .estoque_queries import (
    FiltroEstoque,
    excesso,
    faixas_cobertura,
    metadados_posicao,
    ranking_ruptura,
    resumo,
)
from .estoque_abastecimento import abastecimento_compra
from .estoque_transferencias import transferencias
from .estoque_plano_acao import plano_acao_operacional
from .estoque_cockpit import kpis_executivos


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


def _payload_base(con: Any, filtro: FiltroEstoque) -> dict[str, Any]:
    if filtro.sem_acesso:
        return {"ok": True, "sem_acesso": True, "data_posicao": None, "dados": []}
    meta = metadados_posicao(con, filtro)
    return {"ok": True, "sem_acesso": False, "data_posicao": meta.get("data_posicao"), "posicao": meta}


def endpoint_resumo(con: Any, corpo: dict | None, usuario: dict[str, Any]) -> dict[str, Any]:
    filtro, escopo = filtro_estoque(corpo, usuario)
    base = _payload_base(con, filtro)
    if base.get("sem_acesso"):
        return {**base, "dados": {}}
    dados = resumo(con, filtro)
    dados.update(kpis_executivos(con, filtro, escopo_origem=escopo))
    return {**base, "dados": dados}


def endpoint_ruptura(con: Any, corpo: dict | None, usuario: dict[str, Any]) -> dict[str, Any]:
    filtro, _ = filtro_estoque(corpo, usuario)
    base = _payload_base(con, filtro)
    if base.get("sem_acesso"):
        return base
    corpo = corpo or {}
    dimensao = str(corpo.get("dimensao") or "loja")
    limite = int(corpo.get("limite") or 50)
    return {**base, "dados": ranking_ruptura(con, filtro, dimensao, limite)}


def endpoint_cobertura(con: Any, corpo: dict | None, usuario: dict[str, Any]) -> dict[str, Any]:
    filtro, _ = filtro_estoque(corpo, usuario)
    base = _payload_base(con, filtro)
    if base.get("sem_acesso"):
        return base
    return {**base, "dados": faixas_cobertura(con, filtro)}


def endpoint_excesso(con: Any, corpo: dict | None, usuario: dict[str, Any]) -> dict[str, Any]:
    filtro, _ = filtro_estoque(corpo, usuario)
    base = _payload_base(con, filtro)
    if base.get("sem_acesso"):
        return base
    limite = int((corpo or {}).get("limite") or 200)
    return {**base, "dados": excesso(con, filtro, limite)}


def endpoint_abastecimento(con: Any, corpo: dict | None, usuario: dict[str, Any]) -> dict[str, Any]:
    filtro, escopo = filtro_estoque(corpo, usuario)
    base = _payload_base(con, filtro)
    if base.get("sem_acesso"):
        return base
    limite = int((corpo or {}).get("limite") or 200)
    return {
        **base,
        "politica_abastecimento": {
            "ddv_alvo_dias": filtro.ddv_alvo,
            "considera_transito": True,
            "considera_pedido_pendente": True,
            "considera_carteira": True,
            "considera_transferencia_interna": True,
            "transferencia_so_excesso_acima_alvo": True,
            "compra_e_recomendacao": True,
        },
        "dados": abastecimento_compra(
            con,
            filtro,
            escopo_origem=escopo,
            limite=limite,
        ),
    }


def endpoint_transferencias(con: Any, corpo: dict | None, usuario: dict[str, Any]) -> dict[str, Any]:
    filtro, _ = filtro_estoque(corpo, usuario)
    base = _payload_base(con, filtro)
    if base.get("sem_acesso"):
        return base
    corpo = corpo or {}
    limite = int(corpo.get("limite") or 200)
    reserva = max(1.0, min(float(corpo.get("reserva_origem") or 30), 365.0))
    alvo = max(1.0, min(float(corpo.get("alvo_destino") or 30), 365.0))
    permitir_interregional = bool(corpo.get("permitir_interregional") is True)
    return {
        **base,
        "politica_transferencia": {
            "reserva_origem_dias": reserva,
            "alvo_destino_dias": alvo,
            "interregional": permitir_interregional,
            "considera_abastecimento_destino": True,
        },
        "dados": transferencias(
            con,
            filtro,
            limite=limite,
            reserva_origem=reserva,
            alvo_destino=alvo,
            permitir_interregional=permitir_interregional,
        ),
    }


def endpoint_plano_acao(con: Any, corpo: dict | None, usuario: dict[str, Any]) -> dict[str, Any]:
    filtro, escopo = filtro_estoque(corpo, usuario)
    base = _payload_base(con, filtro)
    if base.get("sem_acesso"):
        return base
    limite = int((corpo or {}).get("limite") or 300)
    dados = plano_acao_operacional(
        con,
        filtro,
        escopo_origem=escopo,
        limite=limite,
    )
    contagem_prioridade: dict[str, int] = {}
    contagem_acao: dict[str, int] = {}
    for item in dados:
        p = str(item.get("prioridade") or "SEM_PRIORIDADE")
        a = str(item.get("acao") or "SEM_ACAO")
        contagem_prioridade[p] = contagem_prioridade.get(p, 0) + 1
        contagem_acao[a] = contagem_acao.get(a, 0) + 1
    return {
        **base,
        "resumo_plano": {
            "total_acoes": len(dados),
            "por_prioridade": contagem_prioridade,
            "por_acao": contagem_acao,
        },
        "dados": dados,
    }


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
