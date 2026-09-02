from __future__ import annotations

from datetime import date
from pathlib import Path
import sys

import duckdb
import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.estoque_api import executar_endpoint
from backend.estoque_contratos import TIPO_ESTOQUE, TIPO_RUPTURA, validar_cabecalhos
from backend.estoque_etl import CargaEstoqueInvalida, promover_posicao
from backend.estoque_ia import combinar_argumentos_contexto
from backend.estoque_ia_hook import adicionar_ferramentas_estoque_360

POS = date(2026, 8, 31)

CABECALHO_ESTOQUE_REAL = [
    "Chave", "Loja", "Nome da Loja", "Ref. padrão", "Produto", "Descrição", "Seção",
    "GTIN Principal", "Departamento", "Status", "Fornecedor", "Comprador", "Fabricante",
    "Curva ABC", "Curva Geral", "Curva Loja", "Pack", "Palete", "Estoque Total", "Valor Total",
    "Estoque Disponível - Qtde", "Estoque Disponível - Cx", "Estoque Disponível - Palete",
    "Estoque Disponível - R$", "Qtd em Trânsito", "Reservado", "Pedido Pendente", "Preço de venda",
    "Venda Qtde - 31 DD", "Venda R$ -  31 DD", "Carteira Qtde", "Carteira Valor", "Top 300", "NBO",
    "Venda CMV", "Data Última Entrada", "Dias Última Entrada", "Estoque Negativo", "Sem Venda >30 DD", "Vda Cx",
]

CABECALHO_RUPTURA_REAL = [
    "Chave", "Loja", "Sub-Categoria", "Seção", "Cód Material", "Material", "Fornecedor", "% Ruptura",
    "Itens c/ Ruptura", "Itens Ativos", "Estoque Qtde", "Venda 90 dias", "Vda Média 90", "DDE", "Forma Dist.",
    "Ativos", "Comprador", "Ped. Aberto - DL", "Dist. CD", "Ped. TTL", "Ruptura C/ Pedido", "Curva ABC",
    "NBO", "Tablóide", "Regional", "Inserção Sortimento", "Elegível", "De - Para", "Sortimento - 24.08",
]


def estoque_rows():
    return [
        {
            "loja": "Indaiatuba", "sku": "1001", "descricao": "Produto A", "departamento": "Mercearia",
            "categoria": "Categoria A", "fornecedor": "Fornecedor X", "comprador": "Comprador 1", "curva_abc": "A",
            "top_300": True, "nbo": False, "tabloide": False, "estoque_disponivel_qtd": 0,
            "estoque_disponivel_valor": 0, "transito_qtd": 0, "pedido_pendente_qtd": 0,
            "pedido_pendente_valor": 0, "carteira_qtd": 0, "carteira_valor": 0, "venda_31d_qtd": 310,
            "venda_31d_valor": 3100, "venda_90d_qtd": 900, "cmv_31d": 2000,
        },
        {
            "loja": "Campinas", "sku": "1001", "descricao": "Produto A", "departamento": "Mercearia",
            "categoria": "Categoria A", "fornecedor": "Fornecedor X", "comprador": "Comprador 1", "curva_abc": "A",
            "top_300": True, "estoque_disponivel_qtd": 1000, "estoque_disponivel_valor": 10000,
            "transito_qtd": 0, "pedido_pendente_qtd": 0, "carteira_qtd": 0, "venda_31d_qtd": 310,
            "venda_31d_valor": 3100, "venda_90d_qtd": 900, "cmv_31d": 2000,
        },
        {
            "loja": "Indaiatuba", "sku": "1002", "descricao": "Produto B", "departamento": "Bazar",
            "categoria": "Categoria B", "fornecedor": "Fornecedor Y", "comprador": "Comprador 2", "curva_abc": "B",
            "estoque_disponivel_qtd": 310, "estoque_disponivel_valor": 6200, "transito_qtd": 40,
            "pedido_pendente_qtd": 50, "pedido_pendente_valor": 1000, "carteira_qtd": 50, "carteira_valor": 1000,
            "venda_31d_qtd": 310, "venda_31d_valor": 6200, "venda_90d_qtd": 900, "cmv_31d": 4000,
        },
        {
            "loja": "Indaiatuba", "sku": "1003", "descricao": "Produto sem venda", "departamento": "Bazar",
            "categoria": "Categoria B", "fornecedor": "Fornecedor Y", "comprador": "Comprador 2", "curva_abc": "C",
            "estoque_disponivel_qtd": 50, "estoque_disponivel_valor": 2500, "venda_31d_qtd": 0,
            "venda_31d_valor": 0, "venda_90d_qtd": 0, "cmv_31d": 0,
        },
    ]


def ruptura_rows():
    return [
        {"loja": "Indaiatuba", "sku": "1001", "descricao": "Produto A", "regional": "INTERIOR", "item_ativo": True, "ruptura": True, "estoque_qtd": 0, "pedido_aberto_qtd": 0, "ruptura_com_pedido": False, "curva_abc": "A", "nbo": False, "tabloide": False},
        {"loja": "Campinas", "sku": "1001", "descricao": "Produto A", "regional": "INTERIOR", "item_ativo": True, "ruptura": False, "estoque_qtd": 1000, "pedido_aberto_qtd": 0, "ruptura_com_pedido": False, "curva_abc": "A", "nbo": False, "tabloide": False},
        {"loja": "Indaiatuba", "sku": "1002", "descricao": "Produto B", "regional": "INTERIOR", "item_ativo": True, "ruptura": True, "estoque_qtd": 310, "pedido_aberto_qtd": 50, "ruptura_com_pedido": True, "curva_abc": "B", "nbo": False, "tabloide": False},
        {"loja": "Indaiatuba", "sku": "1003", "descricao": "Produto sem venda", "regional": "INTERIOR", "item_ativo": True, "ruptura": False, "estoque_qtd": 50, "pedido_aberto_qtd": 0, "ruptura_com_pedido": False, "curva_abc": "C", "nbo": False, "tabloide": False},
    ]


@pytest.fixture()
def con():
    c = duckdb.connect(":memory:")
    promover_posicao(c, tipo=TIPO_ESTOQUE, arquivo_nome="Estoque - Venda - 31.08.xlsb", data_posicao=POS, hash_arquivo="hash-e1", linhas=estoque_rows(), usuario="teste")
    promover_posicao(c, tipo=TIPO_RUPTURA, arquivo_nome="31.08 - Ruptura.xlsb", data_posicao=POS, hash_arquivo="hash-r1", linhas=ruptura_rows(), usuario="teste")
    yield c
    c.close()


def admin_irrestrito():
    return {"escopo": {"irrestrito": True}}


def test_cabecalho_real_estoque_e_reconhecido():
    r = validar_cabecalhos(CABECALHO_ESTOQUE_REAL, TIPO_ESTOQUE)
    assert r["valido"] is True, r["faltantes"]
    assert r["mapeamento"]["sku"] == CABECALHO_ESTOQUE_REAL.index("Produto")
    assert r["mapeamento"]["estoque_disponivel_qtd"] == CABECALHO_ESTOQUE_REAL.index("Estoque Disponível - Qtde")
    assert r["mapeamento"]["cmv_31d"] == CABECALHO_ESTOQUE_REAL.index("Venda CMV")


def test_cabecalho_real_ruptura_e_reconhecido():
    r = validar_cabecalhos(CABECALHO_RUPTURA_REAL, TIPO_RUPTURA)
    assert r["valido"] is True, r["faltantes"]
    assert r["mapeamento"]["sku"] == CABECALHO_RUPTURA_REAL.index("Cód Material")
    assert r["mapeamento"]["ruptura"] == CABECALHO_RUPTURA_REAL.index("Itens c/ Ruptura")
    assert r["mapeamento"]["pedido_aberto_qtd"] == CABECALHO_RUPTURA_REAL.index("Ped. Aberto - DL")


def test_idempotencia_ignora_mesmo_hash(con):
    r = promover_posicao(con, tipo=TIPO_ESTOQUE, arquivo_nome="Estoque - Venda - 31.08.xlsb", data_posicao=POS, hash_arquivo="hash-e1", linhas=estoque_rows(), usuario="teste")
    assert r.status == "IGNORADO_DUPLICADO"
    assert con.execute("select count(*) from estoque_diario where data_posicao=?", [POS]).fetchone()[0] == 4


def test_carga_duplicada_na_mesma_planilha_nao_substitui_posicao(con):
    antes = con.execute("select count(*) from estoque_diario where data_posicao=?", [POS]).fetchone()[0]
    linhas = estoque_rows(); linhas.append(dict(linhas[0]))
    with pytest.raises(CargaEstoqueInvalida):
        promover_posicao(con, tipo=TIPO_ESTOQUE, arquivo_nome="corrigido.xlsb", data_posicao=POS, hash_arquivo="hash-e2", linhas=linhas, usuario="teste")
    depois = con.execute("select count(*) from estoque_diario where data_posicao=?", [POS]).fetchone()[0]
    assert depois == antes


def test_streaming_usa_lotes_limitados():
    class ConMonitor:
        def __init__(self, con):
            self.con = con
            self.maior_lote = 0
            self.chamadas = 0
        def execute(self, *args, **kwargs):
            return self.con.execute(*args, **kwargs)
        def executemany(self, sql, valores):
            self.maior_lote = max(self.maior_lote, len(valores))
            self.chamadas += 1
            return self.con.executemany(sql, valores)

    base = duckdb.connect(":memory:")
    monitor = ConMonitor(base)
    linhas = ({"loja": f"L{i % 20:02d}", "sku": f"SKU{i:06d}", "descricao": f"Produto {i}", "estoque_disponivel_qtd": 1, "estoque_disponivel_valor": 10, "venda_31d_qtd": 1, "cmv_31d": 5} for i in range(1250))
    resultado = promover_posicao(monitor, tipo=TIPO_ESTOQUE, arquivo_nome="teste-31.08.xlsx", data_posicao=POS, hash_arquivo="hash-stream", linhas=linhas, tamanho_lote=200)
    assert resultado.status == "SUCESSO"
    assert resultado.linhas_validas == 1250
    assert monitor.maior_lote <= 200
    assert monitor.chamadas == 7
    assert base.execute("select count(*) from estoque_diario").fetchone()[0] == 1250
    base.close()


def test_falha_no_staging_preserva_posicao_e_remove_temporaria(con):
    antes = con.execute("select loja, sku, estoque_disponivel_qtd from estoque_diario where data_posicao=? order by loja,sku", [POS]).fetchall()
    linhas = [dict(estoque_rows()[0]), dict(estoque_rows()[1]), dict(estoque_rows()[0])]
    with pytest.raises(CargaEstoqueInvalida):
        promover_posicao(con, tipo=TIPO_ESTOQUE, arquivo_nome="duplicado-31.08.xlsx", data_posicao=POS, hash_arquivo="hash-staging-falha", linhas=linhas, tamanho_lote=100)
    depois = con.execute("select loja, sku, estoque_disponivel_qtd from estoque_diario where data_posicao=? order by loja,sku", [POS]).fetchall()
    assert depois == antes
    temporarias = con.execute("select table_name from information_schema.tables where table_name like 'tmp_e360_%'").fetchall()
    assert temporarias == []


def test_ddv_atual_e_projetado(con):
    row = con.execute("select ddv_atual_31d, ddv_projetado_31d from vw_estoque_360 where loja='Indaiatuba' and sku='1002'").fetchone()
    assert row[0] == pytest.approx(31.0)
    assert row[1] == pytest.approx(45.0)


def test_resumo_ruptura_e_sem_venda(con):
    resp = executar_endpoint("resumo", con, {}, admin_irrestrito()); d = resp["dados"]
    assert resp["data_posicao"] == POS
    assert d["itens_posicao"] == 4
    assert d["itens_ruptura"] == 2
    assert d["ruptura_sem_pedido"] == 1
    assert d["ruptura_com_pedido"] == 1
    assert d["estoque_sem_venda_valor"] == pytest.approx(2500)


def test_filtro_regional_aplica_na_mesma_query(con):
    resp = executar_endpoint("resumo", con, {"regional": "INTERIOR"}, admin_irrestrito())
    assert resp["dados"]["itens_posicao"] == 4
    vazio = executar_endpoint("resumo", con, {"regional": "REGIONAL INEXISTENTE"}, admin_irrestrito())
    assert (vazio["dados"].get("itens_posicao") or 0) == 0


def test_loja_fora_do_escopo_retorna_sem_acesso(con):
    usuario = {"escopo": {"irrestrito": False, "lojas": ["Indaiatuba"]}}
    resp = executar_endpoint("resumo", con, {"loja": "Campinas"}, usuario)
    assert resp["sem_acesso"] is True
    assert resp["dados"] == {}


def test_transferencia_encontra_origem_e_destino(con):
    resp = executar_endpoint("transferencias", con, {"reserva_origem": 30, "alvo_destino": 30}, admin_irrestrito())
    item = next(x for x in resp["dados"] if x["sku"] == "1001")
    assert item["loja_origem"] == "Campinas"
    assert item["loja_destino"] == "Indaiatuba"
    assert item["sugestao_qtd"] > 0


def test_plano_acao_prioriza_ruptura_sem_pedido(con):
    resp = executar_endpoint("plano-acao", con, {}, admin_irrestrito())
    primeiro = resp["dados"][0]
    assert primeiro["prioridade"] == "P1"
    assert primeiro["sku"] == "1001"
    assert primeiro["acao"] == "ABASTECER_COMPRAR"


def test_contexto_ia_preserva_regional_e_loja():
    args = combinar_argumentos_contexto({}, {"modulo": "ESTOQUE_360", "subaba": "ruptura", "data_posicao": "2026-08-31", "filtros": {"regional": "INTERIOR", "loja": "Indaiatuba", "mes": "2026-08"}})
    assert args["regional"] == "INTERIOR"
    assert args["loja"] == "Indaiatuba"
    assert args["data_posicao"] == "2026-08-31"
    assert "mes" not in args


def test_catalogo_ia_tem_sete_ferramentas_sem_duplicar_e_com_regional():
    tools = adicionar_ferramentas_estoque_360([])
    nomes = [t["function"]["name"] for t in tools]
    assert len(nomes) == 7
    assert len(nomes) == len(set(nomes))
    assert all("regional" in t["function"]["parameters"]["properties"] for t in tools)
    tools2 = adicionar_ferramentas_estoque_360(tools)
    assert len(tools2) == 7
