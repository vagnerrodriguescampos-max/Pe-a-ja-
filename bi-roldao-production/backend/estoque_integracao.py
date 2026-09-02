"""Ponto único de integração aditiva do Estoque 360 com o backend existente.

Este arquivo deliberadamente NÃO cria aplicação, autenticação ou conexão própria.
O main.py real continua dono dessas responsabilidades e apenas delega aqui as
rotas novas. Isso reduz a alteração no código existente ao mínimo necessário.
"""
from __future__ import annotations

from typing import Any

from .estoque_api import executar_endpoint
from .estoque_admin_hook import processar_importacao_admin_estoque360
from .estoque_ia_hook import executar_ferramenta_estoque, ferramentas_estoque_para_ia

PREFIXO_API = "/api/estoque/"
ACOES_API = {
    "resumo",
    "ruptura",
    "cobertura",
    "excesso",
    "abastecimento",
    "transferencias",
    "plano-acao",
}
TIPOS_IMPORTACAO = {"ESTOQUE", "RUPTURA"}


def eh_rota_estoque360(caminho: str | None) -> bool:
    return bool(caminho and str(caminho).startswith(PREFIXO_API))


def acao_da_rota(caminho: str) -> str:
    if not eh_rota_estoque360(caminho):
        raise ValueError("Rota não pertence ao Estoque 360")
    acao = str(caminho)[len(PREFIXO_API):].strip("/")
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
    """Executa uma das sete rotas novas usando a autenticação já resolvida pelo host."""
    return executar_endpoint(acao_da_rota(caminho), con, corpo or {}, usuario or {})


def eh_importacao_estoque360(tipo: str | None) -> bool:
    return bool(tipo and str(tipo).strip().upper() in TIPOS_IMPORTACAO)


def executar_importacao_estoque360(
    con: Any,
    *,
    tipo: str,
    caminho_arquivo: str,
    usuario: str | None = None,
    data_posicao=None,
) -> dict[str, Any]:
    """Delegação mínima a ser chamada pelo /api/admin/importar existente."""
    if not eh_importacao_estoque360(tipo):
        raise ValueError(f"Tipo não pertence ao Estoque 360: {tipo}")
    return processar_importacao_admin_estoque360(
        con,
        tipo=tipo,
        caminho_arquivo=caminho_arquivo,
        usuario=usuario,
        data_posicao=data_posicao,
    )


def catalogo_ia_estoque360() -> list[dict[str, Any]]:
    """Catálogo a ser somado às ferramentas atuais do Analista de BI."""
    return ferramentas_estoque_para_ia()


def executar_ia_estoque360(
    nome_ferramenta: str,
    argumentos: dict | None,
    *,
    con: Any,
    usuario: dict[str, Any],
    contexto_tela: dict | None = None,
) -> dict[str, Any]:
    """Executa somente ferramentas do Estoque 360, preservando o roteador atual da IA."""
    return executar_ferramenta_estoque(
        nome_ferramenta,
        argumentos or {},
        con=con,
        usuario=usuario or {},
        contexto_tela=contexto_tela or {},
    )


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
    "ia": "somar catálogo e dispatcher às ferramentas atuais; não substituir o roteador existente",
}
