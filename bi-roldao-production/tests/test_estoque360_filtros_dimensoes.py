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

POS = date(2026, 8, 31)
ADMIN = {"escopo": {"irrestrito": True}}


def _carregar(con):
    promover_posicao(
        con,
        tipo=TIPO_ESTOQUE,
        arquivo_nome="Estoque-31.08.xlsx",
        data_posicao=POS,
        hash_arquivo="dim-e",
        linhas=[
            {
                "loja": "R018", "sku": "100", "descricao": "Carne A",
                "departamento": "ACOUGUE", "secao": "BOVINOS",
                "fornecedor": "FORN CARNES", "comprador": "COMP CARNES",
                "curva_abc": "A", "top_300": True, "nbo": False, "tabloide": False,
                "estoque_disponivel_qtd": 10, "estoque_disponivel_valor": 100,
                "venda_31d_qtd": 31, "venda_31d_valor": 310, "cmv_31d": 200,
            },
            {
                "loja": "R018", "sku": "200", "descricao": "Bazar B",
                "departamento": "BAZAR", "secao": "COZINHA",
                "fornecedor": "FORN BAZAR", "comprador": "COMP BAZAR",
                "curva_abc": "B", "top_300": False, "nbo": True, "tabloide": True,
                "estoque_disponivel_qtd": 20, "estoque_disponivel_valor": 200,
                "venda_31d_qtd": 31, "venda_31d_valor": 310, "cmv_31d": 180,
            },
        ],
    )
    promover_posicao(
        con,
        tipo=TIPO_RUPTURA,
        arquivo_nome="Ruptura-31.08.xlsx",
        data_posicao=POS,
        hash_arquivo="dim-r",
        linhas=[
            {
                "loja": "R018", "sku": "100", "descricao": "Carne A",
                "regional": "INTERIOR", "subcategoria": "CARNES BOVINAS",
                "item_ativo": True, "ruptura": False, "estoque_qtd": 10,
                "curva_abc": "A", "nbo": False, "tabloide": False,
            },
            {
                "loja": "R018", "sku": "200", "descricao": "Bazar B",
                "regional": "INTERIOR", "subcategoria": "UTILIDADES DOMESTICAS",
                "item_ativo": True, "ruptura": False, "estoque_qtd": 20,
                "curva_abc": "B", "nbo": True, "tabloide": True,
            },
        ],
    )


def _itens(con, filtros):
    return executar_endpoint("resumo", con, filtros, ADMIN)["dados"]["itens_posicao"]


def test_departamento_secao_e_categoria_sao_dimensoes_independentes():
    con = duckdb.connect(":memory:")
    try:
        _carregar(con)
        assert _itens(con, {"departamento": "ACOUGUE"}) == 1
        assert _itens(con, {"secao": "BOVINOS"}) == 1
        assert _itens(con, {"categoria": "CARNES BOVINAS"}) == 1
        assert _itens(con, {"departamento": "ACOUGUE", "secao": "COZINHA"}) == 0
    finally:
        con.close()


def test_booleanos_top300_nbo_tabloide_aplicam_true_e_false():
    con = duckdb.connect(":memory:")
    try:
        _carregar(con)
        assert _itens(con, {"top_300": "true"}) == 1
        assert _itens(con, {"top_300": "false"}) == 1
        assert _itens(con, {"nbo": "true"}) == 1
        assert _itens(con, {"nbo": "false"}) == 1
        assert _itens(con, {"tabloide": "true"}) == 1
        assert _itens(con, {"tabloide": "false"}) == 1
    finally:
        con.close()


def test_opcoes_do_resumo_expoem_subcategorias_reais():
    con = duckdb.connect(":memory:")
    try:
        _carregar(con)
        op = executar_endpoint("resumo", con, {}, ADMIN)["filtros_disponiveis"]
        assert op["categorias"] == ["CARNES BOVINAS", "UTILIDADES DOMESTICAS"]
        assert op["departamentos"] == ["ACOUGUE", "BAZAR"]
    finally:
        con.close()
