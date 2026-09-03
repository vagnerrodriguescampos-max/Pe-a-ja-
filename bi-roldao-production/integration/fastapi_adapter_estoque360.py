"""Adaptador mínimo do Estoque 360 para o runtime Python/FastAPI real.

Este arquivo NÃO descobre sozinho app, autenticação ou conexão. O host deve fornecer
bindings explícitos depois da leitura literal do runtime. Sem esses bindings, a
integração aborta (fail closed).

Também não cria uma nova rota de importação ou de IA: fornece hooks para serem
somados às rotas/dispatchers já existentes no BI.
"""
from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass
from datetime import date
from inspect import isawaitable
from pathlib import Path
from typing import Any, Callable, Iterator

from backend.estoque_integracao import (
    ACOES_API,
    adicionar_catalogo_ia_estoque360,
    adicionar_prompt_ia_estoque360,
    eh_importacao_estoque360,
    executar_ia_estoque360,
    executar_importacao_estoque360,
    executar_rota_estoque360,
)
from integration.runtime_guard_estoque360 import validar_runtime_python


class IntegracaoFastAPIIncompleta(RuntimeError):
    pass


@dataclass(frozen=True)
class FastAPIHostBindings:
    """Dependências obrigatórias vindas do BI host.

    resolver_usuario(request): deve devolver o mesmo dict de usuário/escopo usado
    pelo BI atual. abrir_conexao(request): deve devolver uma conexão DuckDB ou um
    context manager que produza a conexão. request_type deve ser o Request real do
    Starlette/FastAPI usado pelo host. Nenhuma credencial é resolvida aqui.
    """

    app: Any
    resolver_usuario: Callable[[Any], Any]
    abrir_conexao: Callable[[Any], Any]
    runtime_root: str | Path
    request_type: Any = None


def _validar_bindings(bindings: FastAPIHostBindings) -> None:
    if bindings is None:
        raise IntegracaoFastAPIIncompleta("Bindings do host não informados; integração não instalada.")
    if bindings.app is None or not hasattr(bindings.app, "add_api_route"):
        raise IntegracaoFastAPIIncompleta("FastAPI app real não identificado; integração não instalada.")
    if not callable(bindings.resolver_usuario):
        raise IntegracaoFastAPIIncompleta("Resolver de usuário/escopo real não identificado.")
    if not callable(bindings.abrir_conexao):
        raise IntegracaoFastAPIIncompleta("Fábrica/resolver de conexão real não identificado.")
    if bindings.request_type is None or not isinstance(bindings.request_type, type):
        raise IntegracaoFastAPIIncompleta(
            "Tipo Request real do FastAPI/Starlette não identificado; integração não instalada."
        )
    validar_runtime_python(bindings.runtime_root)


async def _talvez_await(valor: Any) -> Any:
    return await valor if isawaitable(valor) else valor


@contextmanager
def _conexao_contexto(valor: Any) -> Iterator[Any]:
    """Aceita conexão direta ou context manager fornecido pelo host.

    Uma conexão direta (objeto que expõe ``execute``) pertence ao ciclo de vida do
    host e NÃO é fechada aqui, mesmo que a biblioteca também implemente
    ``__enter__/__exit__`` — como ocorre com DuckDB. Apenas wrappers de context
    manager sem interface de conexão são abertos/fechados pelo adaptador.
    """
    if callable(getattr(valor, "execute", None)):
        yield valor
        return
    if hasattr(valor, "__enter__") and hasattr(valor, "__exit__"):
        with valor as con:
            yield con
        return
    yield valor


def _normalizar_usuario(usuario: Any) -> dict[str, Any]:
    if not isinstance(usuario, dict):
        raise IntegracaoFastAPIIncompleta(
            "Resolver de usuário não devolveu dict compatível com o escopo do BI."
        )
    return usuario


def criar_handler_estoque360(acao: str, bindings: FastAPIHostBindings) -> Callable[..., Any]:
    if acao not in ACOES_API:
        raise ValueError(f"Ação Estoque 360 desconhecida: {acao}")

    async def handler(request, corpo: dict | None = None) -> dict[str, Any]:
        usuario = _normalizar_usuario(await _talvez_await(bindings.resolver_usuario(request)))
        recurso = await _talvez_await(bindings.abrir_conexao(request))
        if recurso is None:
            raise IntegracaoFastAPIIncompleta("Host não forneceu conexão para o Estoque 360.")
        with _conexao_contexto(recurso) as con:
            return executar_rota_estoque360(
                f"/api/estoque/{acao}",
                con=con,
                corpo=corpo or {},
                usuario=usuario,
            )

    # FastAPI reconhece Request pela anotação no momento de add_api_route.
    # O tipo vem explicitamente do runtime host para não adicionar dependência ao motor.
    handler.__annotations__["request"] = bindings.request_type
    handler.__name__ = f"estoque360_{acao.replace('-', '_')}"
    handler.__doc__ = f"Endpoint aditivo Estoque 360: {acao}."
    return handler


def instalar_rotas_estoque360(bindings: FastAPIHostBindings) -> tuple[str, ...]:
    """Registra exatamente sete POSTs, após validar o runtime Python real."""
    _validar_bindings(bindings)
    rotas: list[str] = []
    for acao in sorted(ACOES_API):
        caminho = f"/api/estoque/{acao}"
        bindings.app.add_api_route(
            caminho,
            criar_handler_estoque360(acao, bindings),
            methods=["POST"],
            name=f"estoque360_{acao.replace('-', '_')}",
        )
        rotas.append(caminho)
    return tuple(rotas)


def hook_importacao_estoque360(
    *,
    con: Any,
    tipo: str | None,
    caminho_arquivo: str | Path,
    usuario_login: str | None,
    data_posicao: date | None = None,
) -> tuple[bool, dict[str, Any] | None]:
    """Hook para o /api/admin/importar real; não interfere em tipos legados."""
    if not eh_importacao_estoque360(tipo):
        return False, None
    return True, executar_importacao_estoque360(
        con,
        tipo=str(tipo),
        caminho_arquivo=caminho_arquivo,
        usuario_login=usuario_login,
        data_posicao=data_posicao,
    )


def hook_catalogo_ia_estoque360(catalogo_atual: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    """Soma as sete tools ao catálogo real, preservando as atuais."""
    return adicionar_catalogo_ia_estoque360(catalogo_atual)


def hook_prompt_ia_estoque360(prompt_atual: str | None) -> str:
    """Soma instruções do Estoque 360 ao prompt real, sem substituí-lo."""
    return adicionar_prompt_ia_estoque360(prompt_atual)


def hook_execucao_ia_estoque360(
    nome_ferramenta: str,
    argumentos: dict | None,
    *,
    con: Any,
    usuario: dict[str, Any],
    contexto_tela: dict | None = None,
) -> tuple[bool, dict[str, Any] | None]:
    """Dispatcher aditivo: retorna handled=False para qualquer tool legada."""
    if not str(nome_ferramenta or "").startswith("estoque_"):
        return False, None
    return True, executar_ia_estoque360(
        nome_ferramenta,
        argumentos or {},
        con=con,
        usuario=usuario,
        contexto_tela=contexto_tela or {},
    )