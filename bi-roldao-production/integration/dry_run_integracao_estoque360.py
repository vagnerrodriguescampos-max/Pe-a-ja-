"""Plano de integração física do Estoque 360 em modo estritamente dry-run.

Não altera runtime, banco, shell ou /app/data. O objetivo é separar:
1) arquivos aditivos que podem ser copiados para o runtime Python real; e
2) pontos compartilhados do host que exigem leitura literal antes de qualquer patch.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable

from integration.runtime_guard_estoque360 import RuntimeIncompativel, validar_destino_codigo, validar_runtime_python


BACKEND_ADITIVO = (
    "estoque_abastecimento.py",
    "estoque_admin_hook.py",
    "estoque_api.py",
    "estoque_cockpit.py",
    "estoque_contratos.py",
    "estoque_etl.py",
    "estoque_filtros.py",
    "estoque_ia.py",
    "estoque_ia_hook.py",
    "estoque_importacao.py",
    "estoque_integracao.py",
    "estoque_plano_acao.py",
    "estoque_qualidade.py",
    "estoque_queries.py",
    "estoque_schema.py",
    "estoque_transferencias.py",
)

FRONTEND_ADITIVO = (
    "js/estoque360.js",
    "js/estoque360_bootstrap.js",
    "css/estoque360.css",
)

PONTOS_HOST_BLOQUEADOS = (
    {
        "id": "fastapi_app",
        "alvo": "backend/<arquivo que cria FastAPI()>",
        "necessario": "registrar instalar_rotas_estoque360(...) com app, resolver_usuario, abrir_conexao e Request reais",
    },
    {
        "id": "admin_importar",
        "alvo": "rota real /api/admin/importar",
        "necessario": "chamar hook_importacao_estoque360 somente para ESTOQUE/RUPTURA; preservar todos os tipos legados",
    },
    {
        "id": "ia",
        "alvo": "backend/ia.py + backend/ia_ferramentas.py",
        "necessario": "somar catálogo, prompt e dispatcher estoque_*; nunca substituir tools legadas",
    },
    {
        "id": "shell",
        "alvo": "frontend HTML real que contém data-page=\"canais\" e #view",
        "necessario": "carregar /js/estoque360_bootstrap.js; o bootstrap insere Estoque 360 imediatamente após Canais",
    },
)


@dataclass(frozen=True)
class AcaoArquivo:
    origem: str
    destino: str
    existe_origem: bool
    existe_destino: bool
    acao: str


@dataclass(frozen=True)
class PlanoIntegracao:
    status: str
    runtime: str
    fonte: str
    arquivos: tuple[AcaoArquivo, ...]
    pontos_host: tuple[dict, ...]
    bloqueios: tuple[str, ...]
    pode_aplicar_automaticamente: bool

    def como_dict(self) -> dict:
        out = asdict(self)
        out["arquivos"] = [asdict(x) for x in self.arquivos]
        out["pontos_host"] = list(self.pontos_host)
        out["bloqueios"] = list(self.bloqueios)
        return out


def _acoes_arquivos(fonte: Path, runtime: Path) -> Iterable[AcaoArquivo]:
    for nome in BACKEND_ADITIVO:
        src = fonte / "backend" / nome
        dst = runtime / "backend" / nome
        yield AcaoArquivo(
            origem=str(src), destino=str(dst), existe_origem=src.is_file(), existe_destino=dst.exists(),
            acao="ATUALIZAR_ADITIVO" if dst.exists() else "COPIAR_ADITIVO",
        )
    for rel in FRONTEND_ADITIVO:
        src = fonte / "frontend" / rel
        dst = runtime / "frontend" / rel
        yield AcaoArquivo(
            origem=str(src), destino=str(dst), existe_origem=src.is_file(), existe_destino=dst.exists(),
            acao="ATUALIZAR_ADITIVO" if dst.exists() else "COPIAR_ADITIVO",
        )


def gerar_plano_integracao(fonte: str | Path, runtime: str | Path) -> PlanoIntegracao:
    src_root = Path(fonte).expanduser().resolve()
    rt_root = validar_destino_codigo(runtime)
    validar_runtime_python(rt_root)

    if not src_root.is_dir():
        raise RuntimeIncompativel(f"Fonte do Estoque 360 inexistente: {src_root}")

    arquivos = tuple(_acoes_arquivos(src_root, rt_root))
    bloqueios: list[str] = []
    ausentes = [x.origem for x in arquivos if not x.existe_origem]
    if ausentes:
        bloqueios.append("Arquivos aditivos ausentes na fonte: " + ", ".join(ausentes))

    # Os quatro pontos abaixo são deliberadamente bloqueados: o runtime real ainda
    # precisa ser lido literalmente antes de qualquer patch compartilhado.
    bloqueios.extend([
        "FastAPI app real ainda não identificado literalmente.",
        "Implementação real de /api/admin/importar ainda não identificada literalmente.",
        "Pontos de catálogo/dispatcher em ia.py/ia_ferramentas.py ainda não identificados literalmente.",
        "Shell HTML atual de produção ainda não recuperado literalmente.",
    ])

    return PlanoIntegracao(
        status="DRY_RUN_BLOQUEADO" if bloqueios else "DRY_RUN_PRONTO",
        runtime=str(rt_root),
        fonte=str(src_root),
        arquivos=arquivos,
        pontos_host=tuple(PONTOS_HOST_BLOQUEADOS),
        bloqueios=tuple(bloqueios),
        pode_aplicar_automaticamente=False,
    )


def aplicar_plano(*args, **kwargs):
    raise RuntimeIncompativel(
        "Aplicação automática desabilitada. Este módulo é somente dry-run até a leitura literal do runtime Python real."
    )
