from datetime import date
from pathlib import Path
import sys

import duckdb
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.estoque_api import executar_endpoint
from backend.estoque_contratos import TIPO_ESTOQUE, TIPO_RUPTURA
from backend.estoque_etl import promover_posicao

POS = date(2026, 8, 31)


def _usuario():
    return {"escopo": {"irrestrito": True}}


def _estoque():
    return [
        {"loja": "Indaiatuba", "sku": "A", "descricao": "Ativo em ruptura", "estoque_disponivel_qtd": 0, "estoque_disponivel_valor": 0, "venda_31d_qtd": 310, "venda_31d_valor": 3100, "cmv_31d": 2000},
        {"loja": "Indaiatuba", "sku": "B", "descricao": "Inativo marcado como ruptura", "estoque_disponivel_qtd": 310, "estoque_disponivel_valor": 3100, "venda_31d_qtd": 310, "venda_31d_valor": 3100, "cmv_31d": 2000},
        {"loja": "Indaiatuba", "sku": "C", "descricao": "Ativo sem ruptura", "estoque_disponivel_qtd": 310, "estoque_disponivel_valor": 3100, "venda_31d_qtd": 310, "venda_31d_valor": 3100, "cmv_31d": 2000},
        {"loja": "Campinas", "sku": "D", "descricao": "Ativo sem ruptura", "estoque_disponivel_qtd": 310, "estoque_disponivel_valor": 3100, "venda_31d_qtd": 310, "venda_31d_valor": 3100, "cmv_31d": 2000},
    ]


def _ruptura():
    return [
        {"loja": "Indaiatuba", "sku": "A", "descricao": "Ativo em ruptura", "regional": "INTERIOR", "item_ativo": True, "ruptura": True, "pedido_aberto_qtd": 0, "ruptura_com_pedido": False},
        {"loja": "Indaiatuba", "sku": "B", "descricao": "Inativo marcado como ruptura", "regional": "INTERIOR", "item_ativo": False, "ruptura": True, "pedido_aberto_qtd": 0, "ruptura_com_pedido": False},
        {"loja": "Indaiatuba", "sku": "C", "descricao": "Ativo sem ruptura", "regional": "INTERIOR", "item_ativo": True, "ruptura": False, "pedido_aberto_qtd": 0, "ruptura_com_pedido": False},
        {"loja": "Campinas", "sku": "D", "descricao": "Ativo sem ruptura", "regional": "INTERIOR", "item_ativo": True, "ruptura": False, "pedido_aberto_qtd": 0, "ruptura_com_pedido": False},
    ]


@pytest.fixture()
def con():
    c = duckdb.connect(":memory:")
    promover_posicao(c, tipo=TIPO_ESTOQUE, arquivo_nome="estoque.xlsb", data_posicao=POS, hash_arquivo="e-ruptura-metrica", linhas=_estoque())
    promover_posicao(c, tipo=TIPO_RUPTURA, arquivo_nome="ruptura.xlsb", data_posicao=POS, hash_arquivo="r-ruptura-metrica", linhas=_ruptura())
    yield c
    c.close()


def test_resumo_usa_itens_ativos_como_denominador(con):
    d = executar_endpoint("resumo", con, {}, _usuario())["dados"]
    assert d["itens_posicao"] == 4
    assert d["itens_ativos"] == 3
    assert d["itens_ruptura"] == 1
    assert d["ruptura_sem_pedido"] == 1
    assert d["ruptura_com_pedido"] == 0
    assert d["ruptura_pct"] == pytest.approx(100 / 3)


def test_ranking_ruptura_usa_mesma_regra_do_cockpit(con):
    rows = executar_endpoint("ruptura", con, {"dimensao": "loja"}, _usuario())["dados"]
    ind = next(r for r in rows if r["dimensao"] == "Indaiatuba")
    camp = next(r for r in rows if r["dimensao"] == "Campinas")
    assert ind["itens"] == 3
    assert ind["itens_ativos"] == 2
    assert ind["ruptura"] == 1
    assert ind["ruptura_pct"] == pytest.approx(50.0)
    assert camp["itens_ativos"] == 1
    assert camp["ruptura_pct"] == pytest.approx(0.0)


def test_item_inativo_nao_vira_prioridade_de_ruptura(con):
    rows = executar_endpoint("plano-acao", con, {}, _usuario())["dados"]
    item_b = next((r for r in rows if r["sku"] == "B"), None)
    # Pode aparecer como revisão de sortimento, mas nunca como P1/P2 por ruptura.
    assert item_b is not None
    assert item_b["prioridade"] == "P3"
    assert item_b["acao"] == "REVISAR_SORTIMENTO"
    assert item_b["motivo"] == "ITEM_INATIVO"


def test_view_expoe_item_ativo_e_status_nao_trata_inativo_como_ruptura(con):
    row = con.execute("SELECT item_ativo, ruptura, status_estoque FROM vw_estoque_360 WHERE loja='Indaiatuba' AND sku='B'").fetchone()
    assert row[0] is False
    assert row[1] is True
    assert row[2] == "OK"
