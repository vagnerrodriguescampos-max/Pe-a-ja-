from pathlib import Path
import asyncio
import sys

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import integration.fastapi_adapter_estoque360 as adapter
from integration.fastapi_adapter_estoque360 import (
    FastAPIHostBindings,
    IntegracaoFastAPIIncompleta,
    hook_catalogo_ia_estoque360,
    hook_execucao_ia_estoque360,
    hook_importacao_estoque360,
    instalar_rotas_estoque360,
)


class DummyRequest:
    pass


class FakeApp:
    def __init__(self):
        self.rotas = []

    def add_api_route(self, path, endpoint, *, methods, name):
        self.rotas.append({"path": path, "endpoint": endpoint, "methods": tuple(methods), "name": name})


def _runtime_python(tmp_path: Path) -> Path:
    root = tmp_path / "runtime"
    (root / "backend").mkdir(parents=True)
    (root / "frontend").mkdir()
    (root / "requirements.txt").write_text("fastapi\nuvicorn\n", encoding="utf-8")
    (root / "entrypoint.sh").write_text("#!/bin/sh\n", encoding="utf-8")
    (root / "backend" / "ia.py").write_text("# host ia\n", encoding="utf-8")
    (root / "backend" / "ia_ferramentas.py").write_text("# host tools\n", encoding="utf-8")
    return root


def _bindings(tmp_path: Path, app=None):
    return FastAPIHostBindings(
        app=app or FakeApp(),
        resolver_usuario=lambda request: {"login": "teste", "escopo": {"irrestrito": True}},
        abrir_conexao=lambda request: object(),
        runtime_root=_runtime_python(tmp_path),
        request_type=DummyRequest,
    )


def test_registra_exatamente_sete_posts_e_nenhuma_rota_legada(tmp_path):
    b = _bindings(tmp_path)
    rotas = instalar_rotas_estoque360(b)
    assert len(rotas) == 7
    assert set(rotas) == {
        "/api/estoque/resumo",
        "/api/estoque/ruptura",
        "/api/estoque/cobertura",
        "/api/estoque/excesso",
        "/api/estoque/abastecimento",
        "/api/estoque/transferencias",
        "/api/estoque/plano-acao",
    }
    assert all(r["methods"] == ("POST",) for r in b.app.rotas)
    assert all(r["path"].startswith("/api/estoque/") for r in b.app.rotas)
    assert all(r["endpoint"].__annotations__["request"] is DummyRequest for r in b.app.rotas)
    assert "/api/kpis" not in rotas
    assert "/api/admin/importar" not in rotas
    assert "/api/ia/perguntar" not in rotas


def test_handler_usa_usuario_e_conexao_fornecidos_pelo_host(tmp_path, monkeypatch):
    app = FakeApp()
    con = object()
    usuario = {"login": "u", "escopo": {"lojas": [18]}}
    b = FastAPIHostBindings(
        app=app,
        resolver_usuario=lambda request: usuario,
        abrir_conexao=lambda request: con,
        runtime_root=_runtime_python(tmp_path),
        request_type=DummyRequest,
    )
    instalar_rotas_estoque360(b)
    chamada = {}

    def fake_executar(caminho, *, con, corpo, usuario):
        chamada.update(caminho=caminho, con=con, corpo=corpo, usuario=usuario)
        return {"ok": True}

    monkeypatch.setattr(adapter, "executar_rota_estoque360", fake_executar)
    rota = next(r for r in app.rotas if r["path"] == "/api/estoque/resumo")
    resultado = asyncio.run(rota["endpoint"](DummyRequest(), {"lojas": [18]}))
    assert resultado == {"ok": True}
    assert chamada["caminho"] == "/api/estoque/resumo"
    assert chamada["con"] is con
    assert chamada["usuario"] is usuario
    assert chamada["corpo"] == {"lojas": [18]}


def test_fail_closed_sem_app_resolvers_ou_request_real(tmp_path):
    root = _runtime_python(tmp_path)
    with pytest.raises(IntegracaoFastAPIIncompleta, match="app real"):
        instalar_rotas_estoque360(FastAPIHostBindings(None, lambda r: {}, lambda r: object(), root, DummyRequest))
    with pytest.raises(IntegracaoFastAPIIncompleta, match="usuário/escopo"):
        instalar_rotas_estoque360(FastAPIHostBindings(FakeApp(), None, lambda r: object(), root, DummyRequest))
    with pytest.raises(IntegracaoFastAPIIncompleta, match="conexão"):
        instalar_rotas_estoque360(FastAPIHostBindings(FakeApp(), lambda r: {}, None, root, DummyRequest))
    with pytest.raises(IntegracaoFastAPIIncompleta, match="Request real"):
        instalar_rotas_estoque360(FastAPIHostBindings(FakeApp(), lambda r: {}, lambda r: object(), root, None))


def test_importacao_legada_nao_e_interceptada(tmp_path, monkeypatch):
    tratado, resultado = hook_importacao_estoque360(
        con=object(), tipo="VENDA", caminho_arquivo="venda.xlsx", usuario_login="u"
    )
    assert tratado is False
    assert resultado is None

    monkeypatch.setattr(adapter, "executar_importacao_estoque360", lambda *a, **k: {"ok": True})
    tratado, resultado = hook_importacao_estoque360(
        con=object(), tipo="ESTOQUE", caminho_arquivo="estoque.xlsb", usuario_login="u"
    )
    assert tratado is True
    assert resultado == {"ok": True}


def test_ia_e_aditiva_e_nao_intercepta_tool_legada(monkeypatch):
    legado = [{"name": "kpis", "description": "legado"}]
    catalogo = hook_catalogo_ia_estoque360(legado)
    assert any(x.get("name") == "kpis" for x in catalogo)
    nomes_estoque = {
        str((x.get("function") or {}).get("name") or x.get("name") or "")
        for x in catalogo
        if isinstance(x, dict)
    }
    assert len([nome for nome in nomes_estoque if nome.startswith("estoque_")]) == 7

    tratado, resultado = hook_execucao_ia_estoque360(
        "ranking", {}, con=object(), usuario={"escopo": {"irrestrito": True}}
    )
    assert tratado is False
    assert resultado is None

    monkeypatch.setattr(adapter, "executar_ia_estoque360", lambda *a, **k: {"dados": []})
    tratado, resultado = hook_execucao_ia_estoque360(
        "estoque_resumo", {}, con=object(), usuario={"escopo": {"irrestrito": True}}
    )
    assert tratado is True
    assert resultado == {"dados": []}
