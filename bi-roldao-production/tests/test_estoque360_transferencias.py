from __future__ import annotations

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


def _e(loja, sku, estoque, venda31=310, transito=0, pedido=0, carteira=0):
    return {
        "loja": loja, "sku": sku, "descricao": f"Produto {sku}",
        "departamento": "MERCEARIA", "categoria": "CAT", "fornecedor": "FORN",
        "comprador": "COMP", "curva_abc": "A", "top_300": True,
        "estoque_disponivel_qtd": estoque, "estoque_disponivel_valor": estoque * 10,
        "transito_qtd": transito, "pedido_pendente_qtd": pedido, "carteira_qtd": carteira,
        "venda_31d_qtd": venda31, "venda_31d_valor": venda31 * 10, "cmv_31d": venda31 * 7,
    }


def _r(loja, sku, regional, ruptura=False, pedido_aberto=0):
    return {
        "loja": loja, "sku": sku, "descricao": f"Produto {sku}", "regional": regional,
        "item_ativo": True, "ruptura": ruptura, "pedido_aberto_qtd": pedido_aberto,
        "ruptura_com_pedido": bool(ruptura and pedido_aberto > 0), "curva_abc": "A",
    }


def _admin():
    return {"escopo": {"irrestrito": True}}


@pytest.fixture()
def con():
    c = duckdb.connect(":memory:")
    estoque = [
        # R1: origem com 100 dias, transferível = 700 un. mantendo 30 dias.
        _e("ORIGEM_R1", "1001", 1000),
        _e("DESTINO_R1_A", "1001", 0),
        _e("DESTINO_R1_B", "1001", 0),
        _e("DESTINO_R1_C", "1001", 0),
        # R2: origem muito maior não deve concorrer com destinos R1 por padrão.
        _e("ORIGEM_R2", "1001", 2000),
        _e("DESTINO_R2", "1001", 0),
        # SKU com abastecimento previsto: target 30 dias=300; 250 já a caminho => só 50 necessários.
        _e("ORIGEM_R1", "2002", 1000),
        _e("DESTINO_R1_A", "2002", 0, transito=100, pedido=100, carteira=50),
    ]
    ruptura = [
        _r("ORIGEM_R1", "1001", "R1"), _r("DESTINO_R1_A", "1001", "R1", True),
        _r("DESTINO_R1_B", "1001", "R1", True), _r("DESTINO_R1_C", "1001", "R1", True),
        _r("ORIGEM_R2", "1001", "R2"), _r("DESTINO_R2", "1001", "R2", True),
        _r("ORIGEM_R1", "2002", "R1"), _r("DESTINO_R1_A", "2002", "R1"),
    ]
    promover_posicao(c, tipo=TIPO_ESTOQUE, arquivo_nome="estoque.xlsb", data_posicao=POS,
                     hash_arquivo="t-e", linhas=estoque)
    promover_posicao(c, tipo=TIPO_RUPTURA, arquivo_nome="ruptura.xlsb", data_posicao=POS,
                     hash_arquivo="t-r", linhas=ruptura)
    yield c
    c.close()


def test_padrao_so_sugere_mesma_regional(con):
    resp = executar_endpoint("transferencias", con, {"reserva_origem": 30, "alvo_destino": 30}, _admin())
    assert resp["politica_transferencia"]["interregional"] is False
    assert resp["dados"]
    assert all(x["mesma_regional"] is True for x in resp["dados"])
    assert all(x["regional_origem"] == x["regional_destino"] for x in resp["dados"])


def test_origem_nunca_doar_acima_do_transferivel(con):
    resp = executar_endpoint("transferencias", con, {"reserva_origem": 30, "alvo_destino": 30}, _admin())
    r1 = [x for x in resp["dados"] if x["sku"] == "1001" and x["loja_origem"] == "ORIGEM_R1"]
    assert r1
    # Venda diária=10, estoque=1000, reserva=30d => máximo doável 700.
    assert sum(float(x["sugestao_qtd"]) for x in r1) <= pytest.approx(700.0)
    assert all(float(x["ddv_origem_pos"]) >= 30 - 1e-6 for x in r1)


def test_abastecimento_previsto_reduz_necessidade_destino(con):
    resp = executar_endpoint("transferencias", con, {"reserva_origem": 30, "alvo_destino": 30}, _admin())
    item = next(x for x in resp["dados"] if x["sku"] == "2002")
    assert float(item["sugestao_qtd"]) == pytest.approx(50.0)
    assert float(item["ddv_destino_projetado"]) == pytest.approx(25.0)
    assert float(item["ddv_destino_pos"]) == pytest.approx(30.0)


def test_interregional_so_quando_explicitamente_liberado(con):
    padrao = executar_endpoint("transferencias", con, {"reserva_origem": 30, "alvo_destino": 30}, _admin())
    assert not any(x["regional_origem"] != x["regional_destino"] for x in padrao["dados"])

    liberado = executar_endpoint("transferencias", con, {
        "reserva_origem": 30, "alvo_destino": 30, "permitir_interregional": True
    }, _admin())
    assert liberado["politica_transferencia"]["interregional"] is True
    # A engine pode continuar preferindo mesma regional; a autorização apenas torna o cruzamento elegível.
    assert liberado["dados"]


def test_filtro_regional_limita_origens_e_destinos(con):
    resp = executar_endpoint("transferencias", con, {
        "regional": "R1", "reserva_origem": 30, "alvo_destino": 30
    }, _admin())
    assert resp["dados"]
    assert all(x["regional_origem"] == "R1" and x["regional_destino"] == "R1" for x in resp["dados"])
