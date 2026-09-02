"""Hook mínimo para registrar o Estoque 360 no Analista de BI existente.

O ia.py de produção continua sendo a fonte de verdade. Quando sua versão real for
recuperada, ele só precisa incorporar este hook em três pontos: catálogo de tools,
executor de tool calls e instruções do sistema.
"""
from __future__ import annotations

from typing import Any

from .estoque_ia import (
    FERRAMENTAS_ESTOQUE_360,
    executar_ferramenta_estoque_360,
    instrucoes_estoque_360,
    nomes_ferramentas_estoque_360,
)


def adicionar_ferramentas_estoque_360(catalogo: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    """Retorna novo catálogo sem duplicar ferramentas pelo nome."""
    saida = list(catalogo or [])
    nomes = {
        str((item.get("function") or {}).get("name") or item.get("name") or "")
        for item in saida
        if isinstance(item, dict)
    }

    for ferramenta in FERRAMENTAS_ESTOQUE_360:
        if ferramenta["name"] in nomes:
            continue
        # Aceita catálogo no formato OpenAI tool/function ou formato interno simples.
        saida.append({
            "type": "function",
            "function": ferramenta,
        })
    return saida


def eh_ferramenta_estoque_360(nome: str | None) -> bool:
    return bool(nome and nome in nomes_ferramentas_estoque_360())


def executar_tool_call_estoque_360(
    nome: str,
    argumentos: dict[str, Any] | None,
    *,
    con: Any,
    usuario: dict[str, Any],
    contexto_tela: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return executar_ferramenta_estoque_360(
        nome=nome,
        con=con,
        argumentos=argumentos,
        usuario=usuario,
        contexto=contexto_tela,
    )


def adicionar_instrucoes_estoque_360(prompt_sistema: str | None) -> str:
    base = (prompt_sistema or "").rstrip()
    bloco = instrucoes_estoque_360()
    if bloco in base:
        return base
    return f"{base}\n\n{bloco}".strip()
