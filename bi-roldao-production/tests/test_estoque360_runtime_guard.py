from pathlib import Path
import sys

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from integration.runtime_guard_estoque360 import (
    RuntimeIncompativel,
    pode_integrar_runtime,
    validar_destino_codigo,
    validar_runtime_python,
)


def _runtime_python(tmp_path: Path) -> Path:
    root = tmp_path / "runtime"
    (root / "backend").mkdir(parents=True)
    (root / "frontend").mkdir()
    (root / "requirements.txt").write_text("fastapi\nuvicorn\n", encoding="utf-8")
    (root / "entrypoint.sh").write_text("#!/bin/sh\n", encoding="utf-8")
    (root / "backend" / "ia.py").write_text("# host ia\n", encoding="utf-8")
    (root / "backend" / "ia_ferramentas.py").write_text("# host tools\n", encoding="utf-8")
    return root


def test_aceita_runtime_python_com_evidencias_minimas(tmp_path):
    root = _runtime_python(tmp_path)
    evidencia = validar_runtime_python(root)
    assert evidencia.raiz == root.resolve()
    assert evidencia.backend == (root / "backend").resolve()
    assert pode_integrar_runtime(root) is True


def test_rejeita_arvore_nest_mesmo_se_houver_pastas_semelhantes(tmp_path):
    root = _runtime_python(tmp_path)
    (root / "backend" / "src").mkdir()
    (root / "backend" / "package.json").write_text("{}", encoding="utf-8")
    (root / "backend" / "nest-cli.json").write_text("{}", encoding="utf-8")
    (root / "backend" / "src" / "app.module.ts").write_text("export class AppModule {}", encoding="utf-8")

    with pytest.raises(RuntimeIncompativel, match="Nest/Node"):
        validar_runtime_python(root)
    assert pode_integrar_runtime(root) is False


def test_rejeita_runtime_sem_arquivos_centrais_reais(tmp_path):
    root = _runtime_python(tmp_path)
    (root / "backend" / "ia.py").unlink()

    with pytest.raises(RuntimeIncompativel, match="[Aa]rquivos centrais"):
        validar_runtime_python(root)


def test_rejeita_runtime_sem_entrypoint(tmp_path):
    root = _runtime_python(tmp_path)
    (root / "entrypoint.sh").unlink()

    with pytest.raises(RuntimeIncompativel, match="Marcadores ausentes"):
        validar_runtime_python(root)


def test_volume_app_data_e_seus_descendentes_sao_protegidos():
    with pytest.raises(RuntimeIncompativel, match="/app/data"):
        validar_destino_codigo("/app/data")
    with pytest.raises(RuntimeIncompativel, match="/app/data"):
        validar_destino_codigo("/app/data/estoque360")
