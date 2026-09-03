from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.estoque_ia import FERRAMENTAS_ESTOQUE_360, instrucoes_estoque_360
from backend.estoque_ia_hook import adicionar_ferramentas_estoque_360


def _tool(nome: str) -> dict:
    return next(x for x in FERRAMENTAS_ESTOQUE_360 if x["name"] == nome)


def test_ia_mantem_exatamente_sete_tools():
    assert len(FERRAMENTAS_ESTOQUE_360) == 7
    assert {x["name"] for x in FERRAMENTAS_ESTOQUE_360} == {
        "estoque_resumo",
        "estoque_ruptura",
        "estoque_cobertura",
        "estoque_excesso",
        "estoque_abastecimento",
        "estoque_transferencias",
        "estoque_plano_acao",
    }


def test_ruptura_nao_e_compra_automatica_no_contrato_da_tool():
    desc = _tool("estoque_ruptura")["description"].lower()
    assert "não autorização automática para comprar" in desc
    assert "abastecimento ou plano de ação" in desc


def test_abastecimento_declara_sequencia_oficial_e_campos_de_decisao():
    desc = _tool("estoque_abastecimento")["description"]
    for trecho in [
        "trânsito + pedido pendente + carteira",
        "transferência interna",
        "compra residual",
        "acao_recomendada",
        "transferencia_interna_qtd",
        "compra_sugerida_qtd",
    ]:
        assert trecho in desc


def test_plano_acao_declara_campos_quantitativos_oficiais():
    desc = _tool("estoque_plano_acao")["description"]
    assert "transferencia_sugerida_qtd" in desc
    assert "compra_sugerida_qtd" in desc
    assert "não substituir por uma ação genérica" in desc


def test_prompt_obriga_decisao_operacional_antes_de_compra():
    prompt = instrucoes_estoque_360()
    for trecho in [
        "NÃO significam automaticamente comprar",
        "Antes de sugerir compra",
        "estoque_abastecimento ou estoque_plano_acao",
        "AGUARDAR_ABASTECIMENTO",
        "TRANSFERIR_E_COMPRAR",
        "REVISAR_SORTIMENTO",
        "compra_sugerida_qtd",
        "transferencia_sugerida_qtd",
        "nunca aumente, arredonde ou invente quantidades",
    ]:
        assert trecho in prompt


def test_catalogo_aditivo_preserva_legado_e_schema_function():
    legado = [{"name": "kpis", "description": "legado"}]
    catalogo = adicionar_ferramentas_estoque_360(legado)
    assert catalogo[0] == legado[0]
    ferramentas = [
        x["function"]["name"]
        for x in catalogo
        if isinstance(x, dict) and isinstance(x.get("function"), dict)
        and str(x["function"].get("name", "")).startswith("estoque_")
    ]
    assert len(ferramentas) == 7
