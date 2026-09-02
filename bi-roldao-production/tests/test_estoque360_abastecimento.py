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


def e(loja, sku, estoque, venda31=310, transito=0, pedido=0, carteira=0, pack=10, cmv=2170):
    return {
        "loja": loja, "sku": sku, "descricao": f"Produto {sku}",
        "departamento": "MERCEARIA", "categoria": "CAT", "fornecedor": "FORN",
        "comprador": "COMP", "curva_abc": "A", "top_300": True,
        "estoque_disponivel_qtd": estoque, "estoque_disponivel_valor": estoque * 10,
        "transito_qtd": transito, "pedido_pendente_qtd": pedido, "carteira_qtd": carteira,
        "venda_31d_qtd": venda31, "venda_31d_valor": venda31 * 10,
        "cmv_31d": cmv, "pack": pack,
    }


def r(loja, sku, regional="R1", ativo=True, ruptura=False, pedido_aberto=0):
    return {
        "loja": loja, "sku": sku, "descricao": f"Produto {sku}", "regional": regional,
        "item_ativo": ativo, "ruptura": ruptura, "pedido_aberto_qtd": pedido_aberto,
        "ruptura_com_pedido": bool(ruptura and pedido_aberto > 0), "curva_abc": "A",
    }


def admin():
    return {"escopo": {"irrestrito": True}}


@pytest.fixture()
def con():
    c = duckdb.connect(":memory:")
    estoque = [
        # 1001: destino zerado, mas 300 já previstos => aguardar, sem compra.
        e("DESTINO", "1001", 0, transito=100, pedido=100, carteira=100),
        e("DOADOR", "1001", 1000),
        # 1002: destino precisa 300; doador tem 700 acima do alvo => transferir 300, sem compra.
        e("DESTINO", "1002", 0),
        e("DOADOR", "1002", 1000),
        # 1003: destino precisa 300; doador só 100 acima do alvo => transfere 100 e compra 200.
        e("DESTINO", "1003", 0),
        e("DOADOR", "1003", 400),
        # 1004: sem doador útil => compra 300, arredondada pelo pack 12 para 300 exato.
        e("DESTINO", "1004", 0, pack=12),
        e("DOADOR", "1004", 300),
        # 1005: item inativo não deve gerar compra.
        e("DESTINO", "1005", 0),
        e("DOADOR", "1005", 300),
    ]
    ruptura = []
    for row in estoque:
        ativo = not (row["loja"] == "DESTINO" and row["sku"] == "1005")
        ruptura.append(r(row["loja"], row["sku"], ativo=ativo, ruptura=(row["loja"] == "DESTINO")))

    promover_posicao(c, tipo=TIPO_ESTOQUE, arquivo_nome="estoque.xlsb", data_posicao=POS,
                     hash_arquivo="ab-e", linhas=estoque)
    promover_posicao(c, tipo=TIPO_RUPTURA, arquivo_nome="ruptura.xlsb", data_posicao=POS,
                     hash_arquivo="ab-r", linhas=ruptura)
    yield c
    c.close()


def dados_destino(con):
    resp = executar_endpoint("abastecimento", con, {"loja": "DESTINO", "ddv_alvo": 30}, admin())
    assert resp["politica_abastecimento"]["considera_transferencia_interna"] is True
    return {x["sku"]: x for x in resp["dados"]}


def test_abastecimento_previsto_evitar_compra(con):
    d = dados_destino(con)["1001"]
    assert d["acao_recomendada"] == "AGUARDAR_ABASTECIMENTO"
    assert float(d["necessidade_bruta_qtd"]) == pytest.approx(300)
    assert float(d["necessidade_liquida_qtd"]) == pytest.approx(0)
    assert float(d["compra_sugerida_qtd"]) == pytest.approx(0)


def test_excesso_da_rede_evitar_compra(con):
    d = dados_destino(con)["1002"]
    assert d["acao_recomendada"] == "TRANSFERIR"
    assert float(d["transferencia_interna_qtd"]) == pytest.approx(300)
    assert float(d["compra_sugerida_qtd"]) == pytest.approx(0)


def test_transferencia_parcial_deixa_somente_compra_residual(con):
    d = dados_destino(con)["1003"]
    assert d["acao_recomendada"] == "TRANSFERIR_E_COMPRAR"
    assert float(d["transferencia_interna_qtd"]) == pytest.approx(100)
    assert float(d["compra_sugerida_qtd"]) == pytest.approx(200)


def test_sem_excesso_rede_gera_compra_residual(con):
    d = dados_destino(con)["1004"]
    assert d["acao_recomendada"] == "COMPRAR"
    assert float(d["transferencia_interna_qtd"]) == pytest.approx(0)
    assert float(d["compra_sugerida_qtd"]) == pytest.approx(300)
    assert float(d["compra_valor_estimado"]) > 0


def test_item_inativo_nao_gera_compra(con):
    d = dados_destino(con)["1005"]
    assert d["acao_recomendada"] == "REVISAR_SORTIMENTO"
    assert float(d["compra_sugerida_qtd"]) == pytest.approx(0)


def test_filtro_loja_destino_ainda_enxerga_doadores_autorizados(con):
    d = dados_destino(con)["1002"]
    assert float(d["transferivel_rede_qtd"]) >= 300
