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


def _admin():
    return {"escopo": {"irrestrito": True}}


def _estoque(loja="R002", sku=110):
    return [{
        "loja": loja,
        "sku": sku,
        "descricao": "Produto teste",
        "estoque_disponivel_qtd": 10,
        "estoque_disponivel_valor": 100,
        "venda_31d_qtd": 31,
        "venda_31d_valor": 310,
        "cmv_31d": 200,
    }]


def _ruptura(loja="R002 ROLDÃO FREGUESIA DO", sku=110.0, ruptura=False):
    return [{
        "loja": loja,
        "sku": sku,
        "descricao": "Produto teste",
        "regional": "SP CAPITAL",
        "item_ativo": True,
        "ruptura": ruptura,
        "estoque_qtd": 0 if ruptura else 10,
        "pedido_aberto_qtd": 0,
        "ruptura_com_pedido": False,
    }]


def test_chave_real_loja_e_sku_casam_entre_estoque_e_ruptura():
    con = duckdb.connect(":memory:")
    try:
        promover_posicao(
            con,
            tipo=TIPO_ESTOQUE,
            arquivo_nome="Estoque - Venda - 31.08.xlsb",
            data_posicao=POS,
            hash_arquivo="real-key-e",
            linhas=_estoque(),
        )
        promover_posicao(
            con,
            tipo=TIPO_RUPTURA,
            arquivo_nome="31.08 - Ruptura.xlsb",
            data_posicao=POS,
            hash_arquivo="real-key-r",
            linhas=_ruptura(),
        )

        assert con.execute("SELECT loja, sku FROM estoque_diario").fetchone() == ("R002", "110")
        assert con.execute("SELECT loja, sku FROM ruptura_diaria").fetchone() == ("R002", "110")

        row = con.execute("""
            SELECT loja, sku, tem_estoque, tem_ruptura
            FROM vw_estoque_360
            WHERE data_posicao=? AND loja='R002' AND sku='110'
        """, [POS]).fetchone()
        assert row == ("R002", "110", True, True)
        assert con.execute("SELECT COUNT(*) FROM vw_estoque_360 WHERE data_posicao=?", [POS]).fetchone()[0] == 1
    finally:
        con.close()


def test_full_outer_join_preserva_ruptura_ativa_sem_linha_de_estoque():
    con = duckdb.connect(":memory:")
    try:
        promover_posicao(
            con,
            tipo=TIPO_ESTOQUE,
            arquivo_nome="Estoque - Venda - 31.08.xlsb",
            data_posicao=POS,
            hash_arquivo="outer-e",
            linhas=_estoque(),
        )
        linhas_r = _ruptura(ruptura=False) + _ruptura(
            loja="R007 ROLDÃO LOJA SEM ESTOQUE",
            sku=999.0,
            ruptura=True,
        )
        promover_posicao(
            con,
            tipo=TIPO_RUPTURA,
            arquivo_nome="31.08 - Ruptura.xlsb",
            data_posicao=POS,
            hash_arquivo="outer-r",
            linhas=linhas_r,
        )

        isolado = con.execute("""
            SELECT loja, sku, tem_estoque, tem_ruptura, item_ativo, ruptura, status_estoque
            FROM vw_estoque_360
            WHERE data_posicao=? AND loja='R007' AND sku='999'
        """, [POS]).fetchone()
        assert isolado == (
            "R007", "999", False, True, True, True, "P1_RUPTURA_SEM_PEDIDO"
        )

        resp = executar_endpoint("resumo", con, {}, _admin())
        dados = resp["dados"]
        assert dados["itens_ativos"] == 2
        assert dados["itens_ruptura"] == 1
        assert dados["ruptura_sem_pedido"] == 1
        assert dados["ruptura_pct"] == pytest.approx(50.0)
    finally:
        con.close()
