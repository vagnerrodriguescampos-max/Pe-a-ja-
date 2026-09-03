"""Adaptador de API do Estoque 360.

Mantém a lógica HTTP separada do main.py de produção. O main real poderá delegar
para estas funções sem duplicar filtros, regras ou escopo.
"""
from __future__ import annotations

import re
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
from .estoque_qualidade import qualidade_posicao
from .estoque_filtros import opcoes_filtros

_RE_LOJA = re.compile(r"\bR\s*0*(\d{1,4})\b", re.IGNORECASE)


def _inteiro_limitado(valor: Any, padrao: int, minimo: int, maximo: int) -> int:
    try:
        numero = int(valor)
    except (TypeError, ValueError, OverflowError):
        numero = padrao
    return max(minimo, min(numero, maximo))


def _float_limitado(valor: Any, padrao: float, minimo: float, maximo: float) -> float:
    try:
        numero = float(valor)
    except (TypeError, ValueError, OverflowError):
        numero = padrao
    return max(minimo, min(numero, maximo))


def normalizar_codigo_loja(valor: Any) -> str | None:
    """Converte IDs legados do shell para a chave Rxxx usada no estoque.

    Exemplos: 46 -> R046, '018' -> R018, 'R35' -> R035 e
    'R002 ROLDÃO FREGUESIA' -> R002. Valores não reconhecidos são preservados
    para compatibilidade com ambientes que já forneçam outra chave canônica.
    """
    if valor is None:
        return None
    texto = str(valor).strip()
    if not texto:
        return None
    match = _RE_LOJA.search(texto)
    if match:
        numero = str(int(match.group(1)))
        return f"R{numero.zfill(3)}"
    if texto.isdigit() and len(texto) <= 4:
        numero = str(int(texto))
        return f"R{numero.zfill(3)}"
    return texto


def _normalizar_lojas_corpo(corpo: dict | None) -> dict:
    saida = dict(corpo or {})
    if "lojas" in saida and saida.get("lojas") not in (None, ""):
        valores = saida.get("lojas")
        if isinstance(valores, str):
            valores = [valores]
        saida["lojas"] = [x for x in (normalizar_codigo_loja(v) for v in valores or []) if x]
    elif "loja" in saida and saida.get("loja") not in (None, ""):
        saida["loja"] = normalizar_codigo_loja(saida.get("loja"))
    return saida


def extrair_escopo_lojas(usuario: dict[str, Any]) -> list[str] | None:
    """Replica a semântica de segurança do BI: None=irrestrito, []=zero acesso."""
    escopo = (usuario or {}).get("escopo") or {}
    if bool(escopo.get("irrestrito")):
        return None
    lojas = escopo.get("lojas")
    if lojas is None:
        return []
    return [x for x in (normalizar_codigo_loja(loja) for loja in lojas) if x]


def filtro_estoque(corpo: dict | None, usuario: dict[str, Any]) -> tuple[FiltroEstoque, list[str] | None]:
    escopo = extrair_escopo_lojas(usuario)
    corpo_normalizado = _normalizar_lojas_corpo(corpo)
    return FiltroEstoque.de_dict(corpo_normalizado, escopo_lojas=escopo), escopo


def _payload_base(con: Any, filtro: FiltroEstoque) -> dict[str, Any]:
    if filtro.sem_acesso:
        return {"ok": True, "sem_acesso": True, "data_posicao": None, "dados": []}
    meta = metadados_posicao(con, filtro)
    return {"ok": True, "sem_acesso": False, "data_posicao": meta.get("data_posicao"), "posicao": meta}


def endpoint_resumo(con: Any, corpo: dict | None, usuario: dict[str, Any]) -> dict[str, Any]:
    filtro, escopo = filtro_estoque(corpo, usuario)
    base = _payload_base(con, filtro)
    if base.get("sem_acesso"):
        return {**base, "dados": {}, "qualidade_posicao": None, "filtros_disponiveis": {}}
    dados = resumo(con, filtro)
    dados.update(kpis_executivos(con, filtro, escopo_origem=escopo))
    return {
        **base,
        "qualidade_posicao": qualidade_posicao(con, filtro.data_posicao),
        "filtros_disponiveis": opcoes_filtros(con, filtro, escopo),
        "dados": dados,
    }


def endpoint_ruptura(con: Any, corpo: dict | None, usuario: dict[str, Any]) -> dict[str, Any]:
    filtro, _ = filtro_estoque(corpo, usuario)
    base = _payload_base(con, filtro)
    if base.get("sem_acesso"):
        return base
    corpo = corpo or {}
    dimensao = str(corpo.get("dimensao") or "loja")
    limite = _inteiro_limitado(corpo.get("limite"), 50, 1, 500)
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
    limite = _inteiro_limitado((corpo or {}).get("limite"), 200, 1, 2000)
    return {**base, "dados": excesso(con, filtro, limite)}


def endpoint_abastecimento(con: Any, corpo: dict | None, usuario: dict[str, Any]) -> dict[str, Any]:
    filtro, escopo = filtro_estoque(corpo, usuario)
    base = _payload_base(con, filtro)
    if base.get("sem_acesso"):
        return base
    limite = _inteiro_limitado((corpo or {}).get("limite"), 200, 1, 2000)
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
    limite = _inteiro_limitado(corpo.get("limite"), 200, 1, 2000)
    reserva = _float_limitado(corpo.get("reserva_origem"), 30.0, 1.0, 365.0)
    alvo = _float_limitado(corpo.get("alvo_destino"), 30.0, 1.0, 365.0)
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
    limite = _inteiro_limitado((corpo or {}).get("limite"), 300, 1, 3000)
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
