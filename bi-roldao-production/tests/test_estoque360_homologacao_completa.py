from __future__ import annotations

from contextlib import contextmanager
from datetime import date
from pathlib import Path
import sys

import duckdb
from fastapi import FastAPI, HTTPException, Request
from fastapi.testclient import TestClient
from openpyxl import Workbook

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.estoque_contratos import TIPO_ESTOQUE, TIPO_RUPTURA
from backend.estoque_importacao import processar_arquivo_estoque_360
from integration.dry_run_integracao_estoque360 import gerar_plano_integracao
from integration.fastapi_adapter_estoque360 import (
    FastAPIHostBindings,
    hook_execucao_ia_estoque360,
    instalar_rotas_estoque360,
)

POS = date(2026, 8, 31)
REF = date(2026, 9, 3)


def _criar_estoque(path: Path) -> None:
    wb = Workbook()
    ws = wb.active
    ws.title = "Estoque"
    ws.append([
        "Loja", "Produto", "Descrição", "Departamento", "Seção", "Fornecedor", "Comprador",
        "Curva ABC", "Pack", "Estoque Disponível - Qtde", "Estoque Disponível - R$",
        "Qtd em Trânsito", "Pedido Pendente", "Carteira Qtde", "Carteira Valor",
        "Venda Qtde - 31 DD", "Venda R$ -  31 DD", "Venda CMV", "Top 300", "NBO",
    ])
    # Destino: ruptura e zero estoque. Necessidade de 450 un. para DDV-alvo 45.
    ws.append(["R018", 1001.0, "Produto A", "MERCEARIA", "ARROZ", "FORN X", "COMP 1", "A", 10,
               0, 0, 0, 0, 0, 0, 310, 3100, 2000, "SIM", "NÃO"])
    # Origem: mesma Regional, 1000 un. e venda de 310/31d; excesso acima de 45 DDV = 550 un.
    ws.append(["R019", 1001.0, "Produto A", "MERCEARIA", "ARROZ", "FORN X", "COMP 1", "A", 10,
               1000, 10000, 0, 0, 0, 0, 310, 3100, 2000, "SIM", "NÃO"])
    # Item que já tem abastecimento previsto suficiente para comprovar AGUARDAR_ABASTECIMENTO.
    ws.append(["R018", 1002.0, "Produto B", "BAZAR", "UTILIDADES", "FORN Y", "COMP 2", "B", 1,
               0, 0, 200, 200, 100, 1000, 310, 6200, 4000, "NÃO", "NÃO"])
    wb.save(path)


def _criar_ruptura(path: Path) -> None:
    wb = Workbook()
    ws = wb.active
    ws.title = "BD"
    ws.append(["Relatório de Ruptura"])
    ws.append([None])
    ws.append([
        "Loja", "Cód Material", "Material", "Sub-Categoria", "Seção", "Fornecedor", "Comprador",
        "Itens Ativos", "Itens c/ Ruptura", "Estoque Qtde", "Ped. Aberto - DL", "Ruptura C/ Pedido",
        "Curva ABC", "NBO", "Tablóide", "Regional",
    ])
    ws.append(["R018 LOJA DESTINO", 1001.0, "Produto A", "ARROZ", "ARROZ", "FORN X", "COMP 1",
               1, 1, 0, 0, 0, "A", "NÃO", "NÃO", "INTERIOR"])
    ws.append(["R019 LOJA ORIGEM", 1001.0, "Produto A", "ARROZ", "ARROZ", "FORN X", "COMP 1",
               1, 0, 1000, 0, 0, "A", "NÃO", "NÃO", "INTERIOR"])
    ws.append(["R018 LOJA DESTINO", 1002.0, "Produto B", "UTILIDADES", "UTILIDADES", "FORN Y", "COMP 2",
               1, 1, 0, 200, 1, "B", "NÃO", "NÃO", "INTERIOR"])
    wb.save(path)


def _runtime_python(tmp_path: Path) -> Path:
    root = tmp_path / "runtime"
    (root / "backend").mkdir(parents=True)
    (root / "frontend").mkdir()
    (root / "requirements.txt").write_text("fastapi\nuvicorn\n", encoding="utf-8")
    (root / "entrypoint.sh").write_text("#!/bin/sh\n", encoding="utf-8")
    (root / "backend" / "ia.py").write_text("# host ia\n", encoding="utf-8")
    (root / "backend" / "ia_ferramentas.py").write_text("# host tools\n", encoding="utf-8")
    return root


def _montar_app(con, runtime: Path):
    app = FastAPI()

    async def resolver_usuario(request: Request):
        perfil = request.headers.get("x-perfil")
        if perfil == "admin":
            return {"login": "admin", "escopo": {"irrestrito": True}}
        if perfil == "loja18":
            return {"login": "loja18", "escopo": {"irrestrito": False, "lojas": ["R018"]}}
        raise HTTPException(status_code=401, detail="não autenticado")

    instalar_rotas_estoque360(FastAPIHostBindings(
        app=app,
        resolver_usuario=resolver_usuario,
        abrir_conexao=lambda request: con,
        runtime_root=runtime,
        request_type=Request,
    ))
    return app


def test_homologacao_fluxo_completo_estoque360(tmp_path: Path):
    estoque = tmp_path / "Estoque - Venda - 31.08.xlsx"
    ruptura = tmp_path / "31.08 - Ruptura.xlsx"
    _criar_estoque(estoque)
    _criar_ruptura(ruptura)

    con = duckdb.connect(":memory:")
    try:
        # 1. Importação real via Calamine + staging + promoção transacional.
        imp_e = processar_arquivo_estoque_360(
            con, caminho=estoque, tipo=TIPO_ESTOQUE, usuario="homolog", referencia_data=REF
        )
        imp_r = processar_arquivo_estoque_360(
            con, caminho=ruptura, tipo=TIPO_RUPTURA, usuario="homolog", referencia_data=REF
        )
        assert imp_e["status"] == "SUCESSO" and imp_e["data_posicao"] == POS.isoformat()
        assert imp_r["status"] == "SUCESSO" and imp_r["data_posicao"] == POS.isoformat()
        assert imp_e["linhas_validas"] == 3
        assert imp_r["linhas_validas"] == 3

        # 2. Runtime FastAPI controlado com autenticação/escopo do host.
        runtime = _runtime_python(tmp_path)
        app = _montar_app(con, runtime)
        client = TestClient(app)
        admin = {"x-perfil": "admin"}
        loja18 = {"x-perfil": "loja18"}

        assert client.post("/api/estoque/resumo", json={}).status_code == 401

        # 3. As sete telas precisam responder e compartilhar a mesma posição.
        rotas = ["resumo", "ruptura", "cobertura", "excesso", "abastecimento", "transferencias", "plano-acao"]
        respostas = {}
        for acao in rotas:
            resp = client.post(f"/api/estoque/{acao}", json={}, headers=admin)
            assert resp.status_code == 200, (acao, resp.text)
            respostas[acao] = resp.json()
            assert str(respostas[acao].get("data_posicao"))[:10] == POS.isoformat()

        # 4. A posição deve estar saudável após as duas cargas do mesmo dia.
        qualidade = respostas["resumo"].get("qualidade_posicao") or respostas["resumo"].get("dados", {}).get("qualidade_posicao")
        assert qualidade is not None
        assert qualidade["nivel"] == "VERDE"

        # 5. Decisão operacional única: antes de comprar, usar abastecimento/transferência.
        abastecimento = respostas["abastecimento"]["dados"]
        item_a = next(x for x in abastecimento if x["loja"] == "R018" and x["sku"] == "1001")
        assert item_a["acao_recomendada"] == "TRANSFERIR"
        assert item_a["transferencia_interna_qtd"] > 0
        assert item_a["compra_sugerida_qtd"] == 0

        item_b = next(x for x in abastecimento if x["loja"] == "R018" and x["sku"] == "1002")
        assert item_b["acao_recomendada"] == "AGUARDAR_ABASTECIMENTO"
        assert item_b["compra_sugerida_qtd"] == 0

        transf = respostas["transferencias"]["dados"]
        mov = next(x for x in transf if x["sku"] == "1001" and x["loja_destino"] == "R018")
        assert mov["loja_origem"] == "R019"
        assert mov["mesma_regional"] is True
        assert mov["sugestao_qtd"] > 0

        plano = respostas["plano-acao"]["dados"]
        pa = next(x for x in plano if x["loja"] == "R018" and x["sku"] == "1001")
        assert pa["acao"] == item_a["acao_recomendada"]
        assert pa["compra_sugerida_qtd"] == item_a["compra_sugerida_qtd"]
        assert pa["transferencia_sugerida_qtd"] == item_a["transferencia_interna_qtd"]

        # 6. Escopo não pode ser ampliado pelo corpo da requisição.
        restrito = client.post(
            "/api/estoque/resumo", json={"loja": "R019"}, headers=loja18
        )
        assert restrito.status_code == 200
        assert restrito.json()["sem_acesso"] is True

        permitido = client.post(
            "/api/estoque/resumo", json={"loja": "R018"}, headers=loja18
        )
        assert permitido.status_code == 200
        assert permitido.json().get("sem_acesso") is not True

        # 7. IA deve reproduzir a mesma decisão/quantidade do backend para o mesmo contexto.
        usuario_admin = {"login": "admin", "escopo": {"irrestrito": True}}
        contexto = {
            "modulo": "ESTOQUE_360",
            "subaba": "abastecimento",
            "data_posicao": POS.isoformat(),
            "filtros": {"loja": "R018"},
        }
        tratado, ia_ab = hook_execucao_ia_estoque360(
            "estoque_abastecimento", {}, con=con, usuario=usuario_admin, contexto_tela=contexto
        )
        assert tratado is True
        ia_item = next(x for x in ia_ab["dados"] if x["sku"] == "1001")
        assert ia_item["acao_recomendada"] == item_a["acao_recomendada"]
        assert ia_item["compra_sugerida_qtd"] == item_a["compra_sugerida_qtd"]
        assert ia_item["transferencia_interna_qtd"] == item_a["transferencia_interna_qtd"]
        assert ia_ab["qualidade_posicao"]["nivel"] == "VERDE"

        # 8. Frontend continua aditivo e abaixo de Canais.
        bootstrap = (ROOT / "frontend" / "js" / "estoque360_bootstrap.js").read_text(encoding="utf-8")
        assert 'data-page="canais"' in bootstrap
        assert "insertAdjacentElement" in bootstrap or "after(" in bootstrap
        assert "#view" in bootstrap or "getElementById('view')" in bootstrap or 'getElementById("view")' in bootstrap

        # 9. Dry-run final continua bloqueando patch compartilhado e aplicação automática.
        plano_integracao = gerar_plano_integracao(ROOT, runtime)
        assert plano_integracao.status == "DRY_RUN_BLOQUEADO"
        assert plano_integracao.pode_aplicar_automaticamente is False
        assert len(plano_integracao.pontos_host) == 4
        assert all(x.existe_origem for x in plano_integracao.arquivos)

    finally:
        con.close()
