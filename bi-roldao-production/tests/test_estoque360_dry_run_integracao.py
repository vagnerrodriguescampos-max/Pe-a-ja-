from pathlib import Path
import sys

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from integration.dry_run_integracao_estoque360 import (
    BACKEND_ADITIVO,
    FRONTEND_ADITIVO,
    PONTOS_HOST_BLOQUEADOS,
    aplicar_plano,
    gerar_plano_integracao,
)
from integration.runtime_guard_estoque360 import RuntimeIncompativel


def _runtime_python(tmp_path: Path) -> Path:
    root = tmp_path / "runtime"
    (root / "backend").mkdir(parents=True)
    (root / "frontend").mkdir()
    (root / "requirements.txt").write_text("fastapi\nuvicorn\n", encoding="utf-8")
    (root / "entrypoint.sh").write_text("#!/bin/sh\n", encoding="utf-8")
    (root / "backend" / "ia.py").write_text("# host ia\n", encoding="utf-8")
    (root / "backend" / "ia_ferramentas.py").write_text("# host tools\n", encoding="utf-8")
    return root


def _fonte(tmp_path: Path) -> Path:
    root = tmp_path / "fonte"
    (root / "backend").mkdir(parents=True)
    (root / "frontend" / "js").mkdir(parents=True)
    (root / "frontend" / "css").mkdir(parents=True)
    for nome in BACKEND_ADITIVO:
        (root / "backend" / nome).write_text(f"# {nome}\n", encoding="utf-8")
    for rel in FRONTEND_ADITIVO:
        (root / "frontend" / rel).write_text(f"/* {rel} */\n", encoding="utf-8")
    return root


def test_dry_run_lista_todos_arquivos_e_bloqueia_pontos_compartilhados(tmp_path):
    runtime = _runtime_python(tmp_path)
    fonte = _fonte(tmp_path)
    plano = gerar_plano_integracao(fonte, runtime)

    assert plano.status == "DRY_RUN_BLOQUEADO"
    assert plano.pode_aplicar_automaticamente is False
    assert len(plano.arquivos) == len(BACKEND_ADITIVO) + len(FRONTEND_ADITIVO)
    assert all(x.existe_origem for x in plano.arquivos)
    assert all(x.acao == "COPIAR_ADITIVO" for x in plano.arquivos)
    assert {x["id"] for x in plano.pontos_host} == {"fastapi_app", "admin_importar", "ia", "shell"}
    assert len(plano.bloqueios) == 4


def test_dry_run_reconhece_arquivo_aditivo_ja_existente_sem_tocar_nele(tmp_path):
    runtime = _runtime_python(tmp_path)
    fonte = _fonte(tmp_path)
    alvo = runtime / "backend" / BACKEND_ADITIVO[0]
    alvo.write_text("# versão host\n", encoding="utf-8")

    plano = gerar_plano_integracao(fonte, runtime)
    item = next(x for x in plano.arquivos if x.destino == str(alvo))
    assert item.existe_destino is True
    assert item.acao == "ATUALIZAR_ADITIVO"
    assert alvo.read_text(encoding="utf-8") == "# versão host\n"


def test_dry_run_falha_se_fonte_estiver_incompleta(tmp_path):
    runtime = _runtime_python(tmp_path)
    fonte = _fonte(tmp_path)
    (fonte / "backend" / BACKEND_ADITIVO[0]).unlink()

    plano = gerar_plano_integracao(fonte, runtime)
    assert any("Arquivos aditivos ausentes" in b for b in plano.bloqueios)
    assert plano.pode_aplicar_automaticamente is False


def test_rejeita_runtime_nest(tmp_path):
    runtime = _runtime_python(tmp_path)
    fonte = _fonte(tmp_path)
    (runtime / "backend" / "src").mkdir()
    (runtime / "backend" / "package.json").write_text("{}", encoding="utf-8")
    (runtime / "backend" / "nest-cli.json").write_text("{}", encoding="utf-8")
    (runtime / "backend" / "src" / "app.module.ts").write_text("export class AppModule {}", encoding="utf-8")

    with pytest.raises(RuntimeIncompativel, match="Nest/Node"):
        gerar_plano_integracao(fonte, runtime)


def test_aplicacao_automatica_nao_existe():
    with pytest.raises(RuntimeIncompativel, match="somente dry-run"):
        aplicar_plano()


def test_contrato_mantem_quatro_pontos_host_bloqueados():
    assert len(PONTOS_HOST_BLOQUEADOS) == 4
    texto = " ".join(x["necessario"] for x in PONTOS_HOST_BLOQUEADOS)
    assert "resolver_usuario" in texto
    assert "ESTOQUE/RUPTURA" in texto
    assert "catálogo" in texto
    assert "imediatamente após Canais" in texto
