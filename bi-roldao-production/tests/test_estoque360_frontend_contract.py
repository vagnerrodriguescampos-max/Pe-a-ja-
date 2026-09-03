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
    assert 'querySelectorAll(".nav-item").forEach' not in js
    assert 'navEstoque?.remove()' in js
    assert 'canal.remove()' not in js
    assert 'view.remove()' not in js


def test_filtros_globais_do_bi_sao_reutilizados_e_loja_vira_codigo_roldao():
    js = _texto(BOOT)
    assert 'valorSelect("fReg")' in js
    assert 'codigoLojaSelect()' in js
    assert 'valorSelect("fCat")' in js
    assert 'valorSelect("fMes")' in js
    assert 'document.getElementById("filterbar")' in js
    assert 'document.getElementById("btnClear")' in js
    assert 'padStart(3, "0")' in js
    assert 'return `R${n.padStart(3, "0")}`' in js


def test_filtros_exclusivos_so_sao_montados_no_estoque_e_removidos_ao_sair():
    js = _texto(BOOT)
    for filtro in (
        "e360DataPosicao",
        "e360Departamento",
        "e360Fornecedor",
        "e360Comprador",
        "e360CurvaABC",
        "e360Top300",
        "e360NBO",
        "e360Tabloide",
        "e360Status",
    ):
        assert filtro in js
    assert "montarFiltrosExtras();" in js
    assert "removerFiltrosExtras();" in js
    assert 'document.querySelectorAll(`[${EXTRA_ATTR}]`).forEach(el => el.remove())' in js


def test_mes_existente_controla_ultima_posicao_disponivel_do_estoque():
    js = _texto(BOOT)
    assert "aplicarMesNaPosicao" in js
    assert 'o.value.startsWith(`${mes}-`)' in js
    assert 'event?.target?.id === "fMes"' in js


def test_opcoes_dos_filtros_vem_do_resumo_sem_criar_nova_rota():
    js = _texto(BOOT)
    assert 'String(url).endsWith("/api/estoque/resumo")' in js
    assert "filtros_disponiveis" in js
    assert "/api/estoque/filtros" not in js


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


def test_cockpit_exibe_saude_e_auditoria_da_carga():
    js = _texto(MODULO)
    assert "qualidade_posicao" in js
    assert '"Saúde da posição"' in js
    assert 'card("Qualidade da carga"' in js
    assert 'card("Situação da posição"' in js
    assert "linhas_posicao_estoque" in js
    assert "linhas_posicao_ruptura" in js
    assert "falhas_duplicidade_historico" in js
    assert 'q.nivel === "VERDE"' in js
    assert 'q.nivel === "AMARELO"' in js
