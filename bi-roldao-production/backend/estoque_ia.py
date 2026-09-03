"""Ferramentas do Analista de BI para o Estoque 360.

A IA nunca consulta as planilhas brutas diretamente. Todas as respostas passam pela
mesma camada de API/queries usada pelo frontend e, portanto, herdam data de posição,
filtros, escopo de lojas e saúde da carga.
"""
from __future__ import annotations

from datetime import date
from typing import Any

from .estoque_api import executar_endpoint
from .estoque_qualidade import qualidade_posicao


_FILTROS_COMUNS = {
    "data_posicao": {"type": "string", "description": "Data YYYY-MM-DD. Omitir para última posição completa."},
    "regional": {"type": "string"},
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
}


def _props(*extras: tuple[str, dict[str, Any]]) -> dict[str, Any]:
    out = dict(_FILTROS_COMUNS)
    for nome, schema in extras:
        out[nome] = schema
    return out


FERRAMENTAS_ESTOQUE_360 = [
    {"name": "estoque_resumo", "description": "Resume a posição com saúde da carga, valor disponível, DDV atual/projetado, ruptura, compra sugerida, potencial de transferência, prioridades, carteira, estoque sem venda e capital excedente.", "parameters": {"type": "object", "properties": _props(("ddv_alvo", {"type": "number"})), "additionalProperties": False}},
    {"name": "estoque_ruptura", "description": "Analisa ruptura por loja, categoria, fornecedor, comprador, seção, departamento ou curva ABC, separando ruptura com pedido e sem pedido.", "parameters": {"type": "object", "properties": _props(("dimensao", {"type": "string", "enum": ["loja", "departamento", "secao", "categoria", "fornecedor", "comprador", "curva_abc"]}), ("limite", {"type": "integer", "minimum": 1, "maximum": 500})), "additionalProperties": False}},
    {"name": "estoque_cobertura", "description": "Distribui o estoque nas faixas de DDV/cobertura, incluindo sem venda e acima de 90 dias.", "parameters": {"type": "object", "properties": _props(), "additionalProperties": False}},
    {"name": "estoque_excesso", "description": "Lista SKUs com cobertura acima do alvo e estima quantidade e capital excedente. Use para perguntas sobre estoque alto, capital parado e redução de compras.", "parameters": {"type": "object", "properties": _props(("ddv_alvo", {"type": "number", "minimum": 1, "maximum": 365}), ("limite", {"type": "integer", "minimum": 1, "maximum": 2000})), "additionalProperties": False}},
    {"name": "estoque_abastecimento", "description": "Lista necessidades sugeridas de abastecimento considerando estoque, trânsito, pedido pendente, carteira e possibilidade de transferência antes da compra. Não gera pedido de compra.", "parameters": {"type": "object", "properties": _props(("ddv_alvo", {"type": "number", "minimum": 1, "maximum": 365}), ("limite", {"type": "integer", "minimum": 1, "maximum": 2000})), "additionalProperties": False}},
    {
        "name": "estoque_transferencias",
        "description": (
            "Encontra oportunidades conservadoras de transferência do mesmo SKU entre lojas. "
            "Preserva cobertura mínima da origem, desconta trânsito/pedidos/carteira do destino e, "
            "por padrão, só sugere movimentos dentro da mesma Regional."
        ),
        "parameters": {
            "type": "object",
            "properties": _props(
                ("reserva_origem", {"type": "number", "minimum": 1, "maximum": 365, "description": "DDV mínimo a preservar na origem; padrão 30 dias."}),
                ("alvo_destino", {"type": "number", "minimum": 1, "maximum": 365, "description": "DDV projetado desejado no destino; padrão 30 dias."}),
                ("permitir_interregional", {"type": "boolean", "description": "Somente true quando o usuário pedir explicitamente análise entre Regionais. Padrão false."}),
                ("limite", {"type": "integer", "minimum": 1, "maximum": 2000}),
            ),
            "additionalProperties": False,
        },
    },
    {"name": "estoque_plano_acao", "description": "Gera a fila operacional unificada com prioridades e decisões de aguardar, transferir, transferir+comprar, comprar, reduzir compra/transferir e revisar sortimento.", "parameters": {"type": "object", "properties": _props(("limite", {"type": "integer", "minimum": 1, "maximum": 3000})), "additionalProperties": False}},
]


_MAPA_ENDPOINTS = {
    "estoque_resumo": "resumo", "estoque_ruptura": "ruptura", "estoque_cobertura": "cobertura",
    "estoque_excesso": "excesso", "estoque_abastecimento": "abastecimento",
    "estoque_transferencias": "transferencias", "estoque_plano_acao": "plano-acao",
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


def combinar_argumentos_contexto(argumentos: dict[str, Any] | None, contexto: dict[str, Any] | None) -> dict[str, Any]:
    base = _filtros_contexto(contexto)
    base.update(argumentos or {})
    base.pop("periodo_inicio", None); base.pop("periodo_fim", None); base.pop("mes", None)
    return base


def _data_resposta(valor: Any) -> date | None:
    if isinstance(valor, date):
        return valor
    if isinstance(valor, str) and valor:
        try:
            return date.fromisoformat(valor[:10])
        except ValueError:
            return None
    return None


def executar_ferramenta_estoque_360(nome: str, con: Any, argumentos: dict[str, Any] | None, usuario: dict[str, Any], contexto: dict[str, Any] | None = None) -> dict[str, Any]:
    endpoint = _MAPA_ENDPOINTS.get(nome)
    if not endpoint:
        raise ValueError(f"Ferramenta do Estoque 360 desconhecida: {nome}")
    corpo = combinar_argumentos_contexto(argumentos, contexto)
    resposta = executar_endpoint(endpoint, con, corpo, usuario)
    if "qualidade_posicao" not in resposta:
        resposta["qualidade_posicao"] = qualidade_posicao(
            con,
            _data_resposta(resposta.get("data_posicao")),
        )
    resposta["ferramenta"] = nome
    resposta["contexto_aplicado"] = {"modulo": (contexto or {}).get("modulo"), "subaba": (contexto or {}).get("subaba")}
    return resposta


def instrucoes_estoque_360() -> str:
    return (
        "Quando a pergunta envolver estoque, ruptura, DDV/DDE, cobertura, carteira, pedido pendente, "
        "abastecimento, excesso, estoque sem venda, Top 300, NBO, tabloide ou transferência entre lojas, "
        "use as ferramentas estoque_* antes de responder. Nunca estime números de estoque sem ferramenta. "
        "Inspecione sempre qualidade_posicao na resposta da ferramenta. Se nivel=AMARELO, informe ao usuário "
        "qual é a posição operacional utilizada e a ressalva de carga. Se nivel=VERMELHO, não trate indicadores "
        "combinados de Estoque e Ruptura como uma posição válida; explique que as bases precisam ser alinhadas. "
        "Diferencie DDV atual de DDV projetado; o projetado incorpora estoque, trânsito, pedido pendente e carteira. "
        "Transferências devem preservar a reserva da origem e considerar o abastecimento já previsto no destino. "
        "Não permita análise inter-regional salvo pedido explícito do usuário. Sugestões são recomendações analíticas, "
        "não movimentações executadas. Respeite sempre o escopo do usuário."
    )
