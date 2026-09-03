from __future__ import annotations

from datetime import date
from pathlib import Path
import sys

import duckdb

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.estoque_api import executar_endpoint
from backend.estoque_contratos import TIPO_ESTOQUE, TIPO_RUPTURA
from backend.estoque_etl import promover_posicao

POS1 = date(2026, 7, 31)
POS2 = date(2026, 8, 31)


def _estoque(loja, sku, departamento, categoria, fornecedor, comprador, curva, qtd=100, venda=31):
    return {
        "loja": loja,
        "sku": sku,
        "descricao": f"Produto {sku}",
        "departamento": departamento,
        "categoria": categoria,
        "fornecedor": fornecedor,
        "comprador": comprador,
        "curva_abc": curva,
        "top_300": curva == "A",
        "nbo": False,
        "tabloide": sku == "100",
        "estoque_disponivel_qtd": qtd,
        "estoque_disponivel_valor": qtd * 10,
        "venda_31d_qtd": venda,
        "venda_31d_valor": venda * 10,
        "cmv_31d": venda * 6,
    }


def _ruptura(loja, sku, regional, categoria, curva, ruptura=False):
    return {
        "loja": loja,
        "sku": sku,
        "descricao": f"Produto {sku}",
        "regional": regional,
        "subcategoria": categoria,
        "item_ativo": True,
        "ruptura": ruptura,
        "estoque_qtd": 0 if ruptura else 100,
        "pedido_aberto_qtd": 0,
        "curva_abc": curva,
        "nbo": False,
        "tabloide": sku == "100",
    }


def _carregar(con):
    promover_posicao(
        con,
        tipo=TIPO_ESTOQUE,
        arquivo_nome="Estoque-31.07.xlsx",
        data_posicao=POS1,
        hash_arquivo="filt-e-jul",
        linhas=[_estoque("R002", "100", "MERCEARIA", "ALTO GIRO", "FORN A", "COMP 1", "A")],
    )
    promover_posicao(
        con,
        tipo=TIPO_RUPTURA,
        arquivo_nome="Ruptura-31.07.xlsx",
        data_posicao=POS1,
        hash_arquivo="filt-r-jul",
        linhas=[_ruptura("R002", "100", "INTERIOR", "ALTO GIRO", "A")],
    )

    promover_posicao(
        con,
        tipo=TIPO_ESTOQUE,
        arquivo_nome="Estoque-31.08.xlsx",
        data_posicao=POS2,
        hash_arquivo="filt-e-ago",
        linhas=[
            _estoque("R002", "100", "MERCEARIA", "ALTO GIRO", "FORN A", "COMP 1", "A", qtd=0),
            _estoque("R046", "200", "BAZAR", "BAZAR", "FORN B", "COMP 2", "B"),
        ],
    )
    promover_posicao(
        con,
        tipo=TIPO_RUPTURA,
        arquivo_nome="Ruptura-31.08.xlsx",
        data_posicao=POS2,
        hash_arquivo="filt-r-ago",
        linhas=[
            _ruptura("R002", "100", "INTERIOR", "ALTO GIRO", "A", ruptura=True),
            _ruptura("R046", "200", "INTERIOR", "BAZAR", "B"),
        ],
    )


def test_resumo_entrega_posicoes_e_opcoes_sem_oitava_rota():
    con = duckdb.connect(":memory:")
    try:
        _carregar(con)
        resp = executar_endpoint("resumo", con, {}, {"escopo": {"irrestrito": True}})
        op = resp["filtros_disponiveis"]
        assert op["posicoes"] == ["2026-08-31", "2026-07-31"]
        assert op["regionais"] == ["INTERIOR"]
        assert op["departamentos"] == ["BAZAR", "MERCEARIA"]
        assert op["fornecedores"] == ["FORN A", "FORN B"]
        assert op["compradores"] == ["COMP 1", "COMP 2"]
        assert op["curvas_abc"] == ["A", "B"]
        assert "P1_RUPTURA_SEM_PEDIDO" in op["status_estoque"]
    finally:
        con.close()


def test_opcoes_respeitam_escopo_de_loja_do_usuario():
    con = duckdb.connect(":memory:")
    try:
        _carregar(con)
        usuario = {"escopo": {"irrestrito": False, "lojas": ["R002"]}}
        resp = executar_endpoint("resumo", con, {}, usuario)
        op = resp["filtros_disponiveis"]
        assert op["departamentos"] == ["MERCEARIA"]
        assert op["fornecedores"] == ["FORN A"]
        assert op["compradores"] == ["COMP 1"]
        assert op["curvas_abc"] == ["A"]
        assert resp["dados"]["itens_posicao"] == 1
    finally:
        con.close()


def test_data_posicao_filtra_opcoes_na_posicao_escolhida():
    con = duckdb.connect(":memory:")
    try:
        _carregar(con)
        resp = executar_endpoint(
            "resumo",
            con,
            {"data_posicao": "2026-07-31"},
            {"escopo": {"irrestrito": True}},
        )
        op = resp["filtros_disponiveis"]
        assert op["data_posicao"] == "2026-07-31"
        assert op["departamentos"] == ["MERCEARIA"]
        assert op["fornecedores"] == ["FORN A"]
        assert resp["data_posicao"] == POS1
    finally:
        con.close()
