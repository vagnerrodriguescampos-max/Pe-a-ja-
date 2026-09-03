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
from backend.estoque_qualidade import qualidade_posicao

D30 = date(2026, 8, 30)
D31 = date(2026, 8, 31)


def _estoque(loja="L1", sku="A"):
    return [{
        "loja": loja, "sku": sku, "descricao": "Produto A",
        "estoque_disponivel_qtd": 100, "estoque_disponivel_valor": 1000,
        "venda_31d_qtd": 31, "venda_31d_valor": 310, "cmv_31d": 200,
    }]


def _ruptura(loja="L1", sku="A"):
    return [{
        "loja": loja, "sku": sku, "descricao": "Produto A", "regional": "R1",
        "item_ativo": True, "ruptura": False, "pedido_aberto_qtd": 0,
        "ruptura_com_pedido": False,
    }]


def _carga(con, tipo, data_posicao, hash_arquivo):
    linhas = _estoque() if tipo == TIPO_ESTOQUE else _ruptura()
    return promover_posicao(
        con,
        tipo=tipo,
        arquivo_nome=f"{tipo.lower()}-{data_posicao.isoformat()}.xlsb",
        data_posicao=data_posicao,
        hash_arquivo=hash_arquivo,
        linhas=linhas,
        usuario="teste",
    )


def _admin():
    return {"escopo": {"irrestrito": True}}


def test_verde_quando_estoque_e_ruptura_mesma_data():
    con = duckdb.connect(":memory:")
    try:
        _carga(con, TIPO_ESTOQUE, D31, "e31")
        _carga(con, TIPO_RUPTURA, D31, "r31")
        q = qualidade_posicao(con)
        assert q["nivel"] == "VERDE"
        assert q["status"] == "SAUDAVEL"
        assert q["datas_alinhadas"] is True
        assert q["posicao_completa"] is True
        assert q["data_operacional"] == D31
        assert q["linhas_posicao_estoque"] == 1
        assert q["linhas_posicao_ruptura"] == 1
    finally:
        con.close()


def test_vermelho_quando_uma_base_nao_existe():
    con = duckdb.connect(":memory:")
    try:
        _carga(con, TIPO_ESTOQUE, D31, "e31-only")
        q = qualidade_posicao(con)
        assert q["nivel"] == "VERMELHO"
        assert q["status"] == "CRITICO"
        assert q["data_operacional"] is None
        assert any("Ruptura" in alerta for alerta in q["alertas"])
    finally:
        con.close()


def test_vermelho_quando_datas_diferem_e_nao_existe_posicao_comum():
    con = duckdb.connect(":memory:")
    try:
        _carga(con, TIPO_ESTOQUE, D31, "e31-mismatch")
        _carga(con, TIPO_RUPTURA, D30, "r30-mismatch")
        q = qualidade_posicao(con)
        assert q["nivel"] == "VERMELHO"
        assert q["datas_alinhadas"] is False
        assert q["diferenca_dias"] == 1
        assert q["data_comum_mais_recente"] is None
        assert q["data_operacional"] is None
    finally:
        con.close()


def test_amarelo_quando_ultimas_datas_diferem_mas_existe_posicao_comum():
    con = duckdb.connect(":memory:")
    try:
        _carga(con, TIPO_ESTOQUE, D30, "e30-common")
        _carga(con, TIPO_RUPTURA, D30, "r30-common")
        _carga(con, TIPO_ESTOQUE, D31, "e31-new")
        q = qualidade_posicao(con)
        assert q["nivel"] == "AMARELO"
        assert q["status"] == "ATENCAO"
        assert q["data_estoque"] == D31
        assert q["data_ruptura"] == D30
        assert q["data_operacional"] == D30
        assert q["posicao_completa"] is True
    finally:
        con.close()


def test_amarelo_quando_ha_falha_recente_e_registra_duplicidade():
    con = duckdb.connect(":memory:")
    try:
        _carga(con, TIPO_ESTOQUE, D31, "e31-ok")
        _carga(con, TIPO_RUPTURA, D31, "r31-ok")
        con.execute("""
            INSERT INTO estoque_importacoes
              (id,tipo,arquivo_nome,data_posicao,hash_arquivo,status,linhas_lidas,linhas_validas,
               linhas_rejeitadas,criado_em,concluido_em,usuario,mensagem)
            VALUES
              ('falha-dup','ESTOQUE','estoque-duplicado.xlsb',?,'e-falha','FALHA',10,9,1,
               CURRENT_TIMESTAMP + INTERVAL '1 minute', CURRENT_TIMESTAMP + INTERVAL '1 minute',
               'teste','Chave duplicada na carga: loja=L1, sku=A')
        """, [D31])
        q = qualidade_posicao(con)
        assert q["nivel"] == "AMARELO"
        assert q["falha_recente"] is True
        assert q["falhas_duplicidade_historico"] == 1
        assert q["ultima_carga_estoque"]["status"] == "FALHA"
        assert q["ultima_carga_estoque"]["linhas_rejeitadas"] == 1
    finally:
        con.close()


def test_resumo_expoe_qualidade_para_cockpit_e_ia():
    con = duckdb.connect(":memory:")
    try:
        _carga(con, TIPO_ESTOQUE, D31, "e31-api")
        _carga(con, TIPO_RUPTURA, D31, "r31-api")
        resp = executar_endpoint("resumo", con, {}, _admin())
        assert resp["qualidade_posicao"]["nivel"] == "VERDE"
        assert resp["qualidade_posicao"]["data_estoque"] == D31
        assert resp["qualidade_posicao"]["data_ruptura"] == D31
        assert resp["dados"]["data_posicao"] == D31
    finally:
        con.close()
