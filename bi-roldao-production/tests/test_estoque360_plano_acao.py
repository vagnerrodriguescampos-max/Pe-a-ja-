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


def _e(loja, sku, estoque, venda31=310, transito=0, pedido=0, carteira=0, pack=1, cmv=2170):
    return {
        "loja": loja, "sku": sku, "descricao": f"Produto {sku}",
        "departamento": "MERCEARIA", "categoria": "CAT", "fornecedor": "FORN",
        "comprador": "COMPRADOR A", "curva_abc": "A", "top_300": True,
        "estoque_disponivel_qtd": estoque, "estoque_disponivel_valor": estoque * 10,
        "transito_qtd": transito, "pedido_pendente_qtd": pedido, "carteira_qtd": carteira,
        "venda_31d_qtd": venda31, "venda_31d_valor": venda31 * 10, "cmv_31d": cmv,
        "pack": pack,
    }


def _r(loja, sku, regional="R1", ruptura=False, pedido_aberto=0, ativo=True):
    return {
        "loja": loja, "sku": sku, "descricao": f"Produto {sku}", "regional": regional,
        "item_ativo": ativo, "ruptura": ruptura, "pedido_aberto_qtd": pedido_aberto,
        "ruptura_com_pedido": bool(ruptura and pedido_aberto > 0), "curva_abc": "A",
    }


def _admin():
    return {"escopo": {"irrestrito": True}}


def _base():
    con = duckdb.connect(":memory:")
    estoque = [
        # 1001: compra total — sem doador e sem abastecimento previsto.
        _e("DESTINO", "1001", 0),
        # 2002: aguardará abastecimento — alvo 300 e 300 chegando.
        _e("DESTINO", "2002", 0, transito=100, pedido=100, carteira=100),
        # 3003: transferir — origem tem excesso suficiente acima do alvo 30 dias.
        _e("DESTINO", "3003", 0),
        _e("ORIGEM", "3003", 1000),
        # 4004: transferência parcial + compra residual.
        _e("DESTINO", "4004", 0),
        _e("ORIGEM", "4004", 350),  # venda=10/dia; acima de 30d só 50 transferíveis
        # 5005: excesso P3.
        _e("DESTINO", "5005", 1000),
        # 6006: sem venda P3.
        _e("DESTINO", "6006", 100, venda31=0, cmv=0),
    ]
    ruptura = [
        _r("DESTINO", "1001", ruptura=True, pedido_aberto=0),
        _r("DESTINO", "2002"),
        _r("DESTINO", "3003", ruptura=True, pedido_aberto=0),
        _r("ORIGEM", "3003"),
        _r("DESTINO", "4004"),
        _r("ORIGEM", "4004"),
        _r("DESTINO", "5005"),
        _r("DESTINO", "6006"),
    ]
    promover_posicao(con, tipo=TIPO_ESTOQUE, arquivo_nome="estoque.xlsb", data_posicao=POS,
                     hash_arquivo="p-e", linhas=estoque)
    promover_posicao(con, tipo=TIPO_RUPTURA, arquivo_nome="ruptura.xlsb", data_posicao=POS,
                     hash_arquivo="p-r", linhas=ruptura)
    return con


def test_plano_herda_mesma_decisao_do_abastecimento():
    con = _base()
    try:
        abastecimento = executar_endpoint("abastecimento", con, {"loja": "DESTINO", "ddv_alvo": 30}, _admin())
        plano = executar_endpoint("plano-acao", con, {"loja": "DESTINO", "ddv_alvo": 30}, _admin())
        mapa_ab = {(x["loja"], x["sku"]): x["acao_recomendada"] for x in abastecimento["dados"]}
        mapa_pl = {(x["loja"], x["sku"]): x["acao"] for x in plano["dados"]}
        for sku in ("1001", "2002", "3003", "4004"):
            assert mapa_pl[("DESTINO", sku)] == mapa_ab[("DESTINO", sku)]
    finally:
        con.close()


def test_plano_detalha_compra_transferencia_e_responsavel():
    con = _base()
    try:
        resp = executar_endpoint("plano-acao", con, {"loja": "DESTINO", "ddv_alvo": 30}, _admin())
        rows = {x["sku"]: x for x in resp["dados"] if x["loja"] == "DESTINO"}

        comprar = rows["1001"]
        assert comprar["acao"] == "COMPRAR"
        assert comprar["prioridade"] == "P1"
        assert comprar["responsavel_area"] == "COMPRAS"
        assert comprar["responsavel_referencia"] == "COMPRADOR A"
        assert float(comprar["compra_sugerida_qtd"]) > 0
        assert float(comprar["transferencia_sugerida_qtd"] or 0) == 0

        aguardar = rows["2002"]
        assert aguardar["acao"] == "AGUARDAR_ABASTECIMENTO"
        assert float(aguardar["compra_sugerida_qtd"] or 0) == 0
        assert float(aguardar["abastecimento_previsto_qtd"]) == 300

        transferir = rows["3003"]
        assert transferir["acao"] == "TRANSFERIR"
        assert transferir["prioridade"] == "P1"
        assert float(transferir["transferencia_sugerida_qtd"]) > 0
        assert float(transferir["compra_sugerida_qtd"] or 0) == 0

        misto = rows["4004"]
        assert misto["acao"] == "TRANSFERIR_E_COMPRAR"
        assert float(misto["transferencia_sugerida_qtd"]) > 0
        assert float(misto["compra_sugerida_qtd"]) > 0
    finally:
        con.close()


def test_plano_inclui_excesso_sem_venda_e_resumo():
    con = _base()
    try:
        resp = executar_endpoint("plano-acao", con, {"loja": "DESTINO", "ddv_alvo": 30}, _admin())
        rows = {x["sku"]: x for x in resp["dados"] if x["loja"] == "DESTINO"}
        assert rows["5005"]["acao"] == "REDUZIR_COMPRA_OU_TRANSFERIR"
        assert rows["5005"]["prioridade"] == "P3"
        assert rows["6006"]["acao"] == "REVISAR_SORTIMENTO"
        assert rows["6006"]["prioridade"] == "P3"

        resumo = resp["resumo_plano"]
        assert resumo["total_acoes"] == len(resp["dados"])
        assert resumo["por_prioridade"]["P1"] >= 2
        assert resumo["por_acao"]["COMPRAR"] >= 1
        assert resumo["por_acao"]["TRANSFERIR"] >= 1
    finally:
        con.close()
