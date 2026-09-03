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


def r(loja, sku, ruptura=False, ativo=True, regional="R1", pedido_aberto=0):
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
        # 1001: aguardar abastecimento
        e("DESTINO", "1001", 0, transito=100, pedido=100, carteira=100),
        e("DOADOR", "1001", 1000),
        # 1002: transferir integralmente
        e("DESTINO", "1002", 0),
        e("DOADOR", "1002", 1000),
        # 1003: transferir 100 e comprar 200
        e("DESTINO", "1003", 0),
        e("DOADOR", "1003", 400),
        # 1004: comprar 300
        e("DESTINO", "1004", 0, pack=12),
        e("DOADOR", "1004", 300),
        # 1005: ruptura com pedido -> P2 e compra residual
        e("DESTINO", "1005", 0),
        e("DOADOR", "1005", 300),
    ]
    ruptura = []
    for row in estoque:
        is_dest = row["loja"] == "DESTINO"
        sku = row["sku"]
        pedido_aberto = 50 if (is_dest and sku == "1005") else 0
        ruptura.append(r(row["loja"], sku, ruptura=is_dest, pedido_aberto=pedido_aberto))

    promover_posicao(c, tipo=TIPO_ESTOQUE, arquivo_nome="estoque.xlsb", data_posicao=POS,
                     hash_arquivo="cockpit-e", linhas=estoque)
    promover_posicao(c, tipo=TIPO_RUPTURA, arquivo_nome="ruptura.xlsb", data_posicao=POS,
                     hash_arquivo="cockpit-r", linhas=ruptura)
    yield c
    c.close()


def test_cockpit_expoe_kpis_executivos_consistentes(con):
    resumo = executar_endpoint("resumo", con, {"loja": "DESTINO", "ddv_alvo": 30}, admin())["dados"]
    abastecimento = executar_endpoint("abastecimento", con, {"loja": "DESTINO", "ddv_alvo": 30, "limite": 2000}, admin())["dados"]

    assert float(resumo["compra_sugerida_qtd"]) == pytest.approx(
        sum(float(x.get("compra_sugerida_qtd") or 0) for x in abastecimento)
    )
    assert float(resumo["transferencia_potencial_qtd"]) == pytest.approx(
        sum(float(x.get("transferencia_interna_qtd") or 0) for x in abastecimento)
    )
    assert float(resumo["compra_valor_estimado"]) == pytest.approx(
        sum(float(x.get("compra_valor_estimado") or 0) for x in abastecimento)
    )
    assert resumo["itens_para_comprar"] == 2
    assert resumo["itens_para_transferir"] == 1
    assert resumo["itens_transferir_e_comprar"] == 1
    assert resumo["itens_aguardar_abastecimento"] == 1
    assert resumo["acoes_p1"] >= 3
    assert resumo["acoes_p2"] >= 1


def test_cockpit_nao_depende_do_limit_da_lista(con):
    resumo = executar_endpoint("resumo", con, {"loja": "DESTINO", "ddv_alvo": 30}, admin())["dados"]
    lista_curta = executar_endpoint("abastecimento", con, {"loja": "DESTINO", "ddv_alvo": 30, "limite": 1}, admin())["dados"]

    assert len(lista_curta) == 1
    # Os totais do cockpit continuam representando todo o universo filtrado.
    assert int(resumo["itens_para_comprar"]) + int(resumo["itens_para_transferir"]) + int(resumo["itens_transferir_e_comprar"]) + int(resumo["itens_aguardar_abastecimento"]) == 5


def test_kpis_executivos_respeitam_escopo_de_lojas(con):
    usuario = {"escopo": {"irrestrito": False, "lojas": ["DESTINO"]}}
    resumo = executar_endpoint("resumo", con, {"loja": "DESTINO", "ddv_alvo": 30}, usuario)["dados"]
    # Sem acesso às lojas doadoras, o cockpit não pode usar excesso delas para reduzir compra.
    assert float(resumo["transferencia_potencial_qtd"]) == pytest.approx(0)
    assert float(resumo["compra_sugerida_qtd"]) > 0
