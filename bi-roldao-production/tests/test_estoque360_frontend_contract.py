from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BOOT = ROOT / "frontend" / "js" / "estoque360_bootstrap.js"
MODULO = ROOT / "frontend" / "js" / "estoque360.js"


def _texto(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def test_menu_ancora_exatamente_em_canais_e_insere_depois():
    js = _texto(BOOT)
    assert "[data-page=\"canais\"]" in js
    assert 'btn.dataset.page = PAGE_ID' in js
    assert 'canal.insertAdjacentElement("afterend", btn)' in js
    assert "<span>Estoque 360</span>" in js


def test_modulo_renderiza_somente_no_view_existente():
    js = _texto(BOOT)
    assert 'const VIEW_SELECTOR = "#view"' in js
    assert 'document.querySelector(VIEW_SELECTOR)' in js
    assert 'document.body.innerHTML' not in js
    assert 'document.documentElement.innerHTML' not in js


def test_bootstrap_nao_remove_paginas_existentes():
    js = _texto(BOOT)
    # A única remoção permitida é do próprio navEstoque no teardown explícito.
    assert 'querySelectorAll(".nav-item").forEach' not in js
    assert 'navEstoque?.remove()' in js
    assert 'canal.remove()' not in js
    assert 'view.remove()' not in js


def test_filtros_globais_do_bi_sao_reutilizados():
    js = _texto(BOOT)
    assert 'valorSelect("fReg")' in js
    assert 'textoSelect("fLoja")' in js
    assert 'valorSelect("fCat")' in js
    assert 'document.getElementById("filterbar")' in js
    assert 'document.getElementById("btnClear")' in js


def test_modulo_nao_cria_sidebar_ou_header_proprios():
    js = _texto(MODULO)
    proibidos = [
        '<aside class="sidebar"',
        '<header class="header"',
        'class="filterbar"',
        'id="sidebar"',
        'id="filterbar"',
    ]
    for trecho in proibidos:
        assert trecho not in js
