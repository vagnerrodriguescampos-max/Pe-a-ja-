from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.estoque_integracao import (
    ACOES_API,
    INTEGRACAO_MINIMA,
    TIPOS_IMPORTACAO,
    acao_da_rota,
    catalogo_ia_estoque360,
    eh_importacao_estoque360,
    eh_rota_estoque360,
)


def test_expoe_exatamente_sete_rotas_novas():
    assert ACOES_API == {
        "resumo",
        "ruptura",
        "cobertura",
        "excesso",
        "abastecimento",
        "transferencias",
        "plano-acao",
    }
    assert len(INTEGRACAO_MINIMA["api"]) == 7


def test_nao_intercepta_rotas_existentes():
    for rota in [
        "/api/kpis",
        "/api/serie",
        "/api/ranking",
        "/api/admin/importar",
        "/api/canal",
        "/api/ia",
    ]:
        assert eh_rota_estoque360(rota) is False
    assert eh_rota_estoque360("/api/estoque/resumo") is True
    assert eh_rota_estoque360("/api/estoque/resumo?loja=1") is True
    assert acao_da_rota("/api/estoque/plano-acao/") == "plano-acao"


def test_importador_so_intercepta_estoque_e_ruptura():
    assert TIPOS_IMPORTACAO == {"ESTOQUE", "RUPTURA"}
    assert eh_importacao_estoque360("estoque") is True
    assert eh_importacao_estoque360("RUPTURA") is True
    for tipo in ["VENDA", "META", "AREA", "CANAL", "PRODUTO", "CALENDARIO", None]:
        assert eh_importacao_estoque360(tipo) is False


def test_catalogo_possui_exatamente_sete_tools_estoque():
    tools = catalogo_ia_estoque360()
    nomes = {x["name"] for x in tools}
    assert len(tools) == 7
    assert nomes == {
        "estoque_resumo",
        "estoque_ruptura",
        "estoque_cobertura",
        "estoque_excesso",
        "estoque_abastecimento",
        "estoque_transferencias",
        "estoque_plano_acao",
    }


def test_contrato_frontend_permanece_abaixo_de_canais():
    front = INTEGRACAO_MINIMA["frontend"]
    assert front["item_menu"] == "Estoque 360"
    assert front["apos"] == "Canais"
    assert front["container_host"] == "#view"
    assert front["data_page"] == "estoque360"
