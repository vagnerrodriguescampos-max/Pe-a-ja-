from __future__ import annotations

from datetime import date
from pathlib import Path
import sys
from time import perf_counter

import duckdb
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.estoque_api import executar_endpoint, filtro_estoque
from backend.estoque_contratos import TIPO_ESTOQUE, TIPO_RUPTURA
from backend.estoque_etl import CargaEstoqueInvalida, promover_posicao
from integration.runtime_guard_estoque360 import RuntimeIncompativel, validar_destino_codigo

POS = date(2026, 8, 31)
ADMIN = {"escopo": {"irrestrito": True}}


def _estoque_rows(qtd: int = 4000):
    for i in range(qtd):
        baixo = i % 2 == 0
        yield {
            "loja": f"R{18 + (i % 20):03d}",
            "sku": f"SKU{i:06d}",
            "descricao": f"Produto {i}",
            "departamento": "MERCEARIA",
            "secao": "SECA",
            "categoria": "TESTE",
            "fornecedor": "FORNECEDOR X",
            "comprador": "COMPRADOR X",
            "curva_abc": "A" if i % 3 == 0 else "B",
            "top_300": i % 10 == 0,
            "nbo": False,
            "tabloide": False,
            "estoque_disponivel_qtd": 0 if baixo else 1000,
            "estoque_disponivel_valor": 0 if baixo else 10000,
            "transito_qtd": 0,
            "pedido_pendente_qtd": 0,
            "pedido_pendente_valor": 0,
            "carteira_qtd": 0,
            "carteira_valor": 0,
            "venda_31d_qtd": 310,
            "venda_31d_valor": 3100,
            "venda_90d_qtd": 900,
            "cmv_31d": 2000,
        }


def _ruptura_rows(qtd: int = 4000):
    for i in range(qtd):
        baixo = i % 2 == 0
        yield {
            "loja": f"R{18 + (i % 20):03d}",
            "sku": f"SKU{i:06d}",
            "descricao": f"Produto {i}",
            "regional": "INTERIOR",
            "item_ativo": True,
            "ruptura": baixo,
            "estoque_qtd": 0 if baixo else 1000,
            "pedido_aberto_qtd": 0,
            "ruptura_com_pedido": False,
            "curva_abc": "A" if i % 3 == 0 else "B",
            "nbo": False,
            "tabloide": False,
        }


@pytest.fixture(scope="module")
def con_grande():
    con = duckdb.connect(":memory:")
    promover_posicao(
        con,
        tipo=TIPO_ESTOQUE,
        arquivo_nome="Estoque - Venda - 31.08.xlsx",
        data_posicao=POS,
        hash_arquivo="segperf-e",
        linhas=_estoque_rows(),
        tamanho_lote=5000,
        usuario="segperf",
    )
    promover_posicao(
        con,
        tipo=TIPO_RUPTURA,
        arquivo_nome="31.08 - Ruptura.xlsx",
        data_posicao=POS,
        hash_arquivo="segperf-r",
        linhas=_ruptura_rows(),
        tamanho_lote=5000,
        usuario="segperf",
    )
    yield con
    con.close()


def test_payload_malformado_nao_quebra_filtro_e_aplica_defaults():
    f, escopo = filtro_estoque(
        {"data_posicao": "nao-e-data", "ddv_alvo": "abc", "loja": "18"},
        ADMIN,
    )
    assert escopo is None
    assert f.data_posicao is None
    assert f.ddv_alvo == 45.0
    assert f.lojas == ("R018",)


def test_numeros_malformados_de_transferencia_usam_defaults(con_grande):
    r = executar_endpoint(
        "transferencias",
        con_grande,
        {"limite": "abc", "reserva_origem": "xyz", "alvo_destino": None},
        ADMIN,
    )
    assert r["politica_transferencia"]["reserva_origem_dias"] == 30.0
    assert r["politica_transferencia"]["alvo_destino_dias"] == 30.0
    assert len(r["dados"]) <= 200


def test_dimensao_injetada_e_rejeitada_sem_afetar_banco(con_grande):
    antes = con_grande.execute("SELECT COUNT(*) FROM estoque_diario").fetchone()[0]
    with pytest.raises(ValueError, match="Dimensão não permitida"):
        executar_endpoint(
            "ruptura",
            con_grande,
            {"dimensao": "loja; DROP TABLE estoque_diario;--"},
            ADMIN,
        )
    depois = con_grande.execute("SELECT COUNT(*) FROM estoque_diario").fetchone()[0]
    assert depois == antes == 4000


def test_limites_http_impedem_respostas_sem_controle(con_grande):
    enorme = 999_999_999
    excesso = executar_endpoint("excesso", con_grande, {"limite": enorme}, ADMIN)
    abastecimento = executar_endpoint("abastecimento", con_grande, {"limite": enorme}, ADMIN)
    transferencias = executar_endpoint("transferencias", con_grande, {"limite": enorme}, ADMIN)
    plano = executar_endpoint("plano-acao", con_grande, {"limite": enorme}, ADMIN)
    ruptura = executar_endpoint("ruptura", con_grande, {"limite": enorme, "dimensao": "loja"}, ADMIN)

    assert len(excesso["dados"]) <= 2000
    assert len(abastecimento["dados"]) <= 2000
    assert len(transferencias["dados"]) <= 2000
    assert len(plano["dados"]) <= 3000
    assert len(ruptura["dados"]) <= 500


def test_sete_endpoints_em_carga_de_4000_skus_ficam_em_teto_conservador(con_grande):
    rotas = [
        "resumo", "ruptura", "cobertura", "excesso",
        "abastecimento", "transferencias", "plano-acao",
    ]
    inicio = perf_counter()
    for rota in rotas:
        corpo = {"limite": 200} if rota not in {"resumo", "cobertura"} else {}
        resposta = executar_endpoint(rota, con_grande, corpo, ADMIN)
        assert resposta["ok"] is True
        assert resposta["data_posicao"] == POS
    duracao = perf_counter() - inicio
    assert duracao < 10.0, f"Sete endpoints demoraram {duracao:.2f}s para 4000 SKUs"


def test_idempotencia_e_rollback_continuam_validos_sob_gate_final():
    con = duckdb.connect(":memory:")
    try:
        primeira = promover_posicao(
            con, tipo=TIPO_ESTOQUE, arquivo_nome="e.xlsx", data_posicao=POS,
            hash_arquivo="gate-hash", linhas=list(_estoque_rows(20)), tamanho_lote=100,
        )
        repetida = promover_posicao(
            con, tipo=TIPO_ESTOQUE, arquivo_nome="e.xlsx", data_posicao=POS,
            hash_arquivo="gate-hash", linhas=list(_estoque_rows(20)), tamanho_lote=100,
        )
        assert primeira.status == "SUCESSO"
        assert repetida.status == "IGNORADO_DUPLICADO"
        antes = con.execute("SELECT COUNT(*) FROM estoque_diario").fetchone()[0]

        duplicadas = list(_estoque_rows(5))
        duplicadas.append(dict(duplicadas[0]))
        with pytest.raises(CargaEstoqueInvalida):
            promover_posicao(
                con, tipo=TIPO_ESTOQUE, arquivo_nome="falha.xlsx", data_posicao=POS,
                hash_arquivo="gate-falha", linhas=duplicadas, tamanho_lote=100,
            )
        depois = con.execute("SELECT COUNT(*) FROM estoque_diario").fetchone()[0]
        assert depois == antes == 20
    finally:
        con.close()


def test_app_data_permanece_destino_proibido():
    for alvo in ("/app/data", "/app/data/estoque360", "/app/data/backend/modulo.py"):
        with pytest.raises(RuntimeIncompativel):
            validar_destino_codigo(Path(alvo))
