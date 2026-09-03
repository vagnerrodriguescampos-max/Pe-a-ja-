"""Hook mínimo para integrar Estoque 360 ao /api/admin/importar existente.

O main.py de produção ainda não foi recuperado para a branch. Este módulo mantém
a integração isolada para que o endpoint atual precise apenas delegar ESTOQUE e
RUPTURA, sem alterar o comportamento dos demais tipos de importação.
"""

from __future__ import annotations

from datetime import date
from pathlib import Path
from typing import Any

from .estoque_importacao import (
    ImportacaoEstoqueErro,
    eh_tipo_estoque_360,
    processar_arquivo_estoque_360,
)


def tratar_importacao_estoque_360(
    con: Any,
    *,
    tipo: str,
    caminho_arquivo: str | Path,
    usuario_login: str | None,
    data_posicao: date | None = None,
) -> dict[str, Any] | None:
    """Retorna None para tipos que pertencem ao importador legado.

    Para ESTOQUE/RUPTURA, processa a carga e retorna o payload que o endpoint pode
    devolver diretamente ao frontend.
    """
    if not eh_tipo_estoque_360(tipo):
        return None

    return processar_arquivo_estoque_360(
        con,
        caminho=caminho_arquivo,
        tipo=tipo,
        usuario=usuario_login,
        data_posicao=data_posicao,
    )


def resposta_erro_importacao_estoque_360(exc: Exception) -> dict[str, Any]:
    """Normaliza erro de contrato/arquivo para resposta administrativa segura."""
    if isinstance(exc, ImportacaoEstoqueErro):
        mensagem = str(exc)
    else:
        mensagem = "Falha ao processar a base de Estoque 360. Consulte a auditoria da importação."
    return {
        "ok": False,
        "modulo": "ESTOQUE_360",
        "status": "FALHA",
        "mensagem": mensagem,
    }


# Exemplo de encaixe no endpoint existente (não executar aqui):
#
# resultado_estoque = tratar_importacao_estoque_360(
#     con,
#     tipo=tipo,
#     caminho_arquivo=caminho_salvo,
#     usuario_login=usuario.get("login"),
#     data_posicao=data_posicao_opcional,
# )
# if resultado_estoque is not None:
#     return resultado_estoque
#
# ... fluxo legado de VENDA/META/AREA/CANAL/PRODUTO/CALENDARIO permanece igual ...
