from __future__ import annotations

from pathlib import Path

SCRIPT_TAG = '<script type="module" src="/js/estoque360_bootstrap.js"></script>'
MARCADORES_OBRIGATORIOS = (
    'data-page="canais"',
    'id="view"',
    'id="fReg"',
    'id="fLoja"',
    'id="fCat"',
    'id="filterbar"',
)


class ShellIncompativel(RuntimeError):
    pass


def validar_shell(html: str) -> None:
    faltantes = [m for m in MARCADORES_OBRIGATORIOS if m not in html]
    if faltantes:
        raise ShellIncompativel(
            "Shell do BI não corresponde ao contrato esperado; nada foi alterado. "
            f"Marcadores ausentes: {', '.join(faltantes)}"
        )
    if '</body>' not in html.lower():
        raise ShellIncompativel("HTML sem fechamento </body>; nada foi alterado.")


def aplicar_patch_texto(html: str) -> str:
    """Acrescenta somente o loader do Estoque 360; não altera menu ou conteúdo legado."""
    validar_shell(html)
    if SCRIPT_TAG in html:
        return html

    pos = html.lower().rfind('</body>')
    if pos < 0:
        raise ShellIncompativel("HTML sem fechamento </body>; nada foi alterado.")
    return html[:pos] + f"\n{SCRIPT_TAG}\n" + html[pos:]


def aplicar_patch_arquivo(caminho: str | Path) -> bool:
    path = Path(caminho)
    original = path.read_text(encoding='utf-8')
    novo = aplicar_patch_texto(original)
    if novo == original:
        return False
    path.write_text(novo, encoding='utf-8')
    return True
