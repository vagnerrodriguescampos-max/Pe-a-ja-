"""Ferramentas do Analista de BI para o Estoque 360.

A IA nunca consulta as planilhas brutas diretamente. Todas as respostas passam pela
mesma camada de API/queries usada pelo frontend e, portanto, herdam data de posição,
filtros e escopo de lojas do usuário.
"""
from __future__ import annotations

from typing import Any

from .estoque_api import executar_endpoint


FERRAMENTAS_ESTOQUE_360 = [
    {
        "name": "estoque_resumo",
        "description": (
            "Resume a posição de estoque com valor disponível, DDV atual e projetado, "
            "ruptura, ruptura com/sem pedido, carteira, estoque sem venda e capital excedente."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "data_posicao": {"type": "string", "description": "Data YYYY-MM-DD. Omitir para última posição completa."},
                "loja": {"type": "string"},
                "lojas": {"type": "array", "items": {"type": "string"}},
                "departamento": {"type": "string"},
                "secao": {"type": "string"},
                "categoria": {"type": "string"},
                "fornecedor": {"type": "string"},
                "comprador": {"type": "string"},
                "curva_abc": {"type": "string"},
                "top_300": {"type": "boolean"},
                "nbo": {"type": "boolean"},
                "tabloide": {"type": "boolean"},
                "ddv_alvo": {"type": "number"},
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "estoque_ruptura",
        "description": (
            "Analisa ruptura por loja, categoria, fornecedor, comprador, seção, departamento ou curva ABC, "
            "separando ruptura com pedido e sem pedido."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "data_posicao": {"type": "string"},
                "loja": {"type": "string"},
                "lojas": {"type": "array", "items": {"type": "string"}},
                "departamento": {"type": "string"},
                "secao": {"type": "string"},
                "categoria": {"type": "string"},
                "fornecedor": {"type": "string"},
                "comprador": {"type": "string"},
                "curva_abc": {"type": "string"},
                "top_300": {"type": "boolean"},
                "nbo": {"type": "boolean"},
                "tabloide": {"type": "boolean"},
                "dimensao": {
                    "type": "string",
                    "enum": ["loja", "departamento", "secao", "categoria", "fornecedor", "comprador", "curva_abc"],
                },
                "limite": {"type": "integer", "minimum": 1, "maximum": 500},
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "estoque_cobertura",
        "description": "Distribui o estoque nas faixas de DDV/cobertura, incluindo sem venda e acima de 90 dias.",
        "parameters": {
            "type": "object",
            "properties": {
                "data_posicao": {"type": "string"},
                "loja": {"type": "string"},
                "lojas": {"type": "array", "items": {"type": "string"}},
                "departamento": {"type": "string"},
                "categoria": {"type": "string"},
                "fornecedor": {"type": "string"},
                "comprador": {"type": "string"},
                "curva_abc": {"type": "string"},
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "estoque_excesso",
        "description": (
            "Lista SKUs com cobertura acima do alvo e estima quantidade e capital excedente. "
            "Use para perguntas sobre estoque alto, capital parado e redução de compras."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "data_posicao": {"type": "string"},
                "loja": {"type": "string"},
                "lojas": {"type": "array", "items": {"type": "string"}},
                "departamento": {"type": "string"},
                "categoria": {"type": "string"},
                "fornecedor": {"type": "string"},
                "comprador": {"type": "string"},
                "curva_abc": {"type": "string"},
                "ddv_alvo": {"type": "number", "minimum": 1, "maximum": 365},
                "limite": {"type": "integer", "minimum": 1, "maximum": 2000},
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "estoque_abastecimento",
        "description": (
            "Lista necessidades sugeridas de abastecimento considerando venda média, estoque disponível, "
            "trânsito, pedido pendente e carteira. Não gera pedido de compra."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "data_posicao": {"type": "string"},
                "loja": {"type": "string"},
                "lojas": {"type": "array", "items": {"type": "string"}},
                "categoria": {"type": "string"},
                "fornecedor": {"type": "string"},
                "comprador": {"type": "string"},
                "curva_abc": {"type": "string"},
                "top_300": {"type": "boolean"},
                "nbo": {"type": "boolean"},
                "tabloide": {"type": "boolean"},
                "ddv_alvo": {"type": "number", "minimum": 1, "maximum": 365},
                "limite": {"type": "integer", "minimum": 1, "maximum": 2000},
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "estoque_transferencias",
        "description": (
            "Encontra oportunidades de transferência do mesmo SKU entre lojas: origem com excesso e destino com baixa cobertura."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "data_posicao": {"type": "string"},
                "lojas": {"type": "array", "items": {"type": "string"}},
                "categoria": {"type": "string"},
                "fornecedor": {"type": "string"},
                "curva_abc": {"type": "string"},
                "reserva_origem": {"type": "number", "minimum": 1, "maximum": 365},
                "alvo_destino": {"type": "number", "minimum": 1, "maximum": 365},
                "limite": {"type": "integer", "minimum": 1, "maximum": 2000},
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "estoque_plano_acao",
        "description": (
            "Gera a fila de ação operacional do estoque, ordenada por prioridade: ruptura sem pedido, "
            "ruptura com pedido, baixa cobertura, excesso e estoque sem venda."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "data_posicao": {"type": "string"},
                "loja": {"type": "string"},
                "lojas": {"type": "array", "items": {"type": "string"}},
                "departamento": {"type": "string"},
                "categoria": {"type": "string"},
                "fornecedor": {"type": "string"},
                "comprador": {"type": "string"},
                "curva_abc": {"type": "string"},
                "top_300": {"type": "boolean"},
                "nbo": {"type": "boolean"},
                "tabloide": {"type": "boolean"},
                "limite": {"type": "integer", "minimum": 1, "maximum": 3000},
            },
            "additionalProperties": False,
        },
    },
]


_MAPA_ENDPOINTS = {
    "estoque_resumo": "resumo",
    "estoque_ruptura": "ruptura",
    "estoque_cobertura": "cobertura",
    "estoque_excesso": "excesso",
    "estoque_abastecimento": "abastecimento",
    "estoque_transferencias": "transferencias",
    "estoque_plano_acao": "plano-acao",
}


def nomes_ferramentas_estoque_360() -> set[str]:
    return set(_MAPA_ENDPOINTS)


def _filtros_contexto(contexto: dict[str, Any] | None) -> dict[str, Any]:
    contexto = contexto or {}
    if str(contexto.get("modulo") or "").upper() != "ESTOQUE_360":
        return {}
    filtros = dict(contexto.get("filtros") or {})
    data_posicao = contexto.get("data_posicao")
    if data_posicao and not filtros.get("data_posicao"):
        filtros["data_posicao"] = str(data_posicao)[:10]
    return filtros


def combinar_argumentos_contexto(
    argumentos: dict[str, Any] | None,
    contexto: dict[str, Any] | None,
) -> dict[str, Any]:
    """Contexto da tela fornece defaults; argumentos explícitos da IA prevalecem."""
    base = _filtros_contexto(contexto)
    base.update(argumentos or {})
    # Campos de período de venda do BI comercial não entram no estoque.
    base.pop("periodo_inicio", None)
    base.pop("periodo_fim", None)
    base.pop("mes", None)
    return base


def executar_ferramenta_estoque_360(
    nome: str,
    con: Any,
    argumentos: dict[str, Any] | None,
    usuario: dict[str, Any],
    contexto: dict[str, Any] | None = None,
) -> dict[str, Any]:
    endpoint = _MAPA_ENDPOINTS.get(nome)
    if not endpoint:
        raise ValueError(f"Ferramenta do Estoque 360 desconhecida: {nome}")

    corpo = combinar_argumentos_contexto(argumentos, contexto)
    resposta = executar_endpoint(endpoint, con, corpo, usuario)
    resposta["ferramenta"] = nome
    resposta["contexto_aplicado"] = {
        "modulo": (contexto or {}).get("modulo"),
        "subaba": (contexto or {}).get("subaba"),
    }
    return resposta


def instrucoes_estoque_360() -> str:
    """Bloco curto para acrescentar ao prompt de sistema do Analista de BI."""
    return (
        "Quando a pergunta envolver estoque, ruptura, DDV/DDE, cobertura, carteira, "
        "pedido pendente, abastecimento, excesso, estoque sem venda, Top 300, NBO, tabloide "
        "ou transferência entre lojas, use as ferramentas estoque_* antes de responder. "
        "Nunca estime números de estoque sem ferramenta. Diferencie DDV atual de DDV projetado; "
        "o projetado incorpora estoque, trânsito, pedido pendente e carteira. Sugestão de abastecimento "
        "é recomendação analítica e não representa pedido emitido. Respeite sempre o escopo do usuário."
    )
