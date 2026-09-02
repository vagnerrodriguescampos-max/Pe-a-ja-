"""Ponto único de integração aditiva do Estoque 360 com o backend existente.

Este módulo NÃO cria aplicação, autenticação, conexão ou banco próprios. O host
continua dono dessas responsabilidades e delega ao Estoque 360 apenas quando a
rota/tipo/tool pertence explicitamente ao novo módulo.
"""
from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Any

from .estoque_api import executar_endpoint
from .estoque_admin_hook import tratar_importacao_estoque_360
from .estoque_ia import FERRAMENTAS_ESTOQUE_360
from .estoque_ia_hook import (
    adicionar_ferramentas_estoque_360,
    adicionar_instrucoes_estoque_360,
    eh_ferramenta_estoque_360,
    executar_tool_call_estoque_360,
)

PREFIXO_API = "/api/estoque/"
ACOES_API = frozenset({
    "resumo",
    "ruptura",
    "cobertura",
    "excesso",
    "abastecimento",
    "transferencias",
    "plano-acao",
})
TIPOS_IMPORTACAO = frozenset({"ESTOQUE", "RUPTURA"})


def eh_rota_estoque360(caminho: str | None) -> bool:
    if not caminho:
        return False
    texto = str(caminho).split("?", 1)[0].rstrip("/")
    if not texto.startswith(PREFIXO_API):
        return False
    acao = texto[len(PREFIXO_API):]
    return acao in ACOES_API


def acao_da_rota(caminho: str) -> str:
    texto = str(caminho).split("?", 1)[0].rstrip("/")
    if not texto.startswith(PREFIXO_API):
        raise ValueError("Rota não pertence ao Estoque 360")
    acao = texto[len(PREFIXO_API):]
    if acao not in ACOES_API:
        raise ValueError(f"Rota Estoque 360 desconhecida: {caminho}")
    return acao


def executar_rota_estoque360(
    caminho: str,
    *,
    con: Any,
    corpo: dict | None,
    usuario: dict[str, Any],
) -> dict[str, Any]:
    """Executa uma rota nova usando conexão e usuário já resolvidos pelo BI host."""
    return executar_endpoint(acao_da_rota(caminho), con, corpo or {}, usuario or {})


def eh_importacao_estoque360(tipo: str | None) -> bool:
    return bool(tipo and str(tipo).strip().upper() in TIPOS_IMPORTACAO)


def executar_importacao_estoque360(
    con: Any,
    *,
    tipo: str,
    caminho_arquivo: str | Path,
    usuario_login: str | None = None,
    data_posicao: date | None = None,
) -> dict[str, Any]:
    """Delegação mínima para o /api/admin/importar já existente.

    Não aceita tipos legados; isso impede que este módulo intercepte VENDA, META,
    AREA, CANAL, PRODUTO ou CALENDARIO.
    """
    tipo_norm = str(tipo or "").strip().upper()
    if tipo_norm not in TIPOS_IMPORTACAO:
        raise ValueError(f"Tipo não pertence ao Estoque 360: {tipo}")
    resultado = tratar_importacao_estoque_360(
        con,
        tipo=tipo_norm,
        caminho_arquivo=caminho_arquivo,
        usuario_login=usuario_login,
        data_posicao=data_posicao,
    )
    if resultado is None:
        raise RuntimeError("Hook de importação não tratou um tipo Estoque 360 reconhecido")
    return resultado


def catalogo_ia_estoque360() -> list[dict[str, Any]]:
    """Retorna as sete definições simples das tools, sem alterar catálogo existente."""
    return list(FERRAMENTAS_ESTOQUE_360)


def adicionar_catalogo_ia_estoque360(catalogo_atual: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    return adicionar_ferramentas_estoque_360(catalogo_atual)


def executar_ia_estoque360(
    nome_ferramenta: str,
    argumentos: dict | None,
    *,
    con: Any,
    usuario: dict[str, Any],
    contexto_tela: dict | None = None,
) -> dict[str, Any]:
    """Executa somente tools estoque_*; o roteador legado continua responsável pelas demais."""
    if not eh_ferramenta_estoque_360(nome_ferramenta):
        raise ValueError(f"Ferramenta não pertence ao Estoque 360: {nome_ferramenta}")
    return executar_tool_call_estoque_360(
        nome_ferramenta,
        argumentos or {},
        con=con,
        usuario=usuario or {},
        contexto_tela=contexto_tela or {},
    )


def adicionar_prompt_ia_estoque360(prompt_atual: str | None) -> str:
    return adicionar_instrucoes_estoque_360(prompt_atual)


INTEGRACAO_MINIMA = {
    "frontend": {
        "item_menu": "Estoque 360",
        "apos": "Canais",
        "data_page": "estoque360",
        "container_host": "#view",
        "bootstrap": "/js/estoque360_bootstrap.js",
        "regra": "aditiva; não substituir nem alterar páginas existentes",
    },
    "api": sorted(f"{PREFIXO_API}{acao}" for acao in ACOES_API),
    "importacao": sorted(TIPOS_IMPORTACAO),
    "ia": {
        "tools": sorted(x["name"] for x in FERRAMENTAS_ESTOQUE_360),
        "regra": "somar catálogo, prompt e dispatcher; não substituir o roteador atual",
    },
}
