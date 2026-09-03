from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


class RuntimeIncompativel(RuntimeError):
    """Impede integração do Estoque 360 em uma árvore que não é o runtime real do BI."""


@dataclass(frozen=True)
class RuntimeEvidence:
    raiz: Path
    backend: Path
    frontend: Path
    requirements: Path
    entrypoint: Path


ARQUIVOS_PYTHON_CENTRAIS = (
    "backend/ia.py",
    "backend/ia_ferramentas.py",
)

MARCADORES_RUNTIME_PYTHON = (
    "requirements.txt",
    "backend",
    "frontend",
    "entrypoint.sh",
)

MARCADORES_ARVORE_NEST = (
    "backend/package.json",
    "backend/nest-cli.json",
    "backend/src/app.module.ts",
)

CAMINHO_DADOS_PROTEGIDO = Path("/app/data")


def _resolvido(path: str | Path) -> Path:
    return Path(path).expanduser().resolve()


def _dentro_de(path: Path, pai: Path) -> bool:
    try:
        path.relative_to(pai)
        return True
    except ValueError:
        return False


def validar_destino_codigo(caminho: str | Path) -> Path:
    """Código nunca pode ser instalado dentro do volume persistente /app/data."""
    destino = _resolvido(caminho)
    protegido = CAMINHO_DADOS_PROTEGIDO.resolve()
    if destino == protegido or _dentro_de(destino, protegido):
        raise RuntimeIncompativel(
            "Destino de código aponta para /app/data. Integração abortada para proteger os dados persistentes."
        )
    return destino


def validar_runtime_python(raiz: str | Path) -> RuntimeEvidence:
    """Valida somente evidências estruturais; não altera arquivo algum."""
    root = _resolvido(raiz)
    validar_destino_codigo(root)

    if not root.exists() or not root.is_dir():
        raise RuntimeIncompativel(f"Runtime inexistente ou inválido: {root}")

    marcadores_nest = [m for m in MARCADORES_ARVORE_NEST if (root / m).exists()]
    if marcadores_nest:
        raise RuntimeIncompativel(
            "Árvore Nest/Node detectada; ela não corresponde ao runtime Python/FastAPI comprovado no Railway. "
            f"Marcadores encontrados: {', '.join(marcadores_nest)}"
        )

    faltantes = [m for m in MARCADORES_RUNTIME_PYTHON if not (root / m).exists()]
    if faltantes:
        raise RuntimeIncompativel(
            "Runtime Python incompleto; integração abortada. "
            f"Marcadores ausentes: {', '.join(faltantes)}"
        )

    faltantes_centrais = [m for m in ARQUIVOS_PYTHON_CENTRAIS if not (root / m).is_file()]
    if faltantes_centrais:
        raise RuntimeIncompativel(
            "Arquivos centrais do backend real ainda não foram recuperados; integração abortada. "
            f"Ausentes: {', '.join(faltantes_centrais)}"
        )

    requirements = root / "requirements.txt"
    entrypoint = root / "entrypoint.sh"
    if not requirements.is_file() or not entrypoint.is_file():
        raise RuntimeIncompativel("requirements.txt ou entrypoint.sh não são arquivos regulares")

    return RuntimeEvidence(
        raiz=root,
        backend=root / "backend",
        frontend=root / "frontend",
        requirements=requirements,
        entrypoint=entrypoint,
    )


def pode_integrar_runtime(raiz: str | Path) -> bool:
    try:
        validar_runtime_python(raiz)
        return True
    except RuntimeIncompativel:
        return False
