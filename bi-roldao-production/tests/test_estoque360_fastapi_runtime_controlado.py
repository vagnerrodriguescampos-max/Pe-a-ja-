from contextlib import contextmanager
from pathlib import Path
import sys

import duckdb
from fastapi import FastAPI, HTTPException, Request
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.estoque_schema import SCHEMA_ESTOQUE_360
from integration.fastapi_adapter_estoque360 import FastAPIHostBindings, instalar_rotas_estoque360


def _runtime_python(tmp_path: Path) -> Path:
    root = tmp_path / "runtime"
    (root / "backend").mkdir(parents=True)
    (root / "frontend").mkdir()
    (root / "requirements.txt").write_text("fastapi\nuvicorn\n", encoding="utf-8")
    (root / "entrypoint.sh").write_text("#!/bin/sh\n", encoding="utf-8")
    (root / "backend" / "ia.py").write_text("# host ia\n", encoding="utf-8")
    (root / "backend" / "ia_ferramentas.py").write_text("# host tools\n", encoding="utf-8")
    return root


def _db_realista(tmp_path: Path) -> Path:
    db = tmp_path / "runtime.duckdb"
    con = duckdb.connect(str(db))
    con.execute(SCHEMA_ESTOQUE_360)
    con.execute("""
        INSERT INTO estoque_diario (
          data_posicao, loja, sku, descricao, departamento, secao, categoria,
          fornecedor, comprador, curva_abc, top_300, nbo, tabloide, status_item,
          pack, estoque_total_qtd, estoque_disponivel_qtd, estoque_disponivel_valor,
          transito_qtd, pedido_pendente_qtd, pedido_pendente_valor, carteira_qtd,
          carteira_valor, preco_venda, venda_31d_qtd, venda_31d_valor, cmv_31d,
          importacao_id
        ) VALUES
        ('2026-08-31','R018','100','SKU TESTE','SECA SALGADA','ARROZ','ARROZ','FORN','COMP','A',TRUE,FALSE,FALSE,'ATIVO',1,5,5,50,0,0,0,0,0,10,31,310,200,'E1'),
        ('2026-08-31','R019','100','SKU TESTE','SECA SALGADA','ARROZ','ARROZ','FORN','COMP','A',TRUE,FALSE,FALSE,'ATIVO',1,100,100,1000,0,0,0,0,0,10,31,310,200,'E1')
    """)
    con.execute("""
        INSERT INTO ruptura_diaria (
          data_posicao, loja, sku, descricao, subcategoria, secao, fornecedor,
          comprador, regional, item_ativo, ruptura, ruptura_pct, estoque_qtd,
          venda_90d_qtd, venda_media_90d, dde, pedido_aberto_qtd,
          distribuicao_cd_qtd, pedido_total_qtd, ruptura_com_pedido,
          curva_abc, nbo, tabloide, importacao_id
        ) VALUES
        ('2026-08-31','R018','100','SKU TESTE','ARROZ','ARROZ','FORN','COMP','REG1',TRUE,TRUE,100,5,90,1,5,0,0,0,FALSE,'A',FALSE,FALSE,'R1'),
        ('2026-08-31','R019','100','SKU TESTE','ARROZ','ARROZ','FORN','COMP','REG1',TRUE,FALSE,0,100,90,1,100,0,0,0,FALSE,'A',FALSE,FALSE,'R1')
    """)
    con.execute("""
        INSERT INTO estoque_importacoes
        (id,tipo,arquivo_nome,data_posicao,hash_arquivo,status,linhas_lidas,linhas_validas,linhas_rejeitadas,concluido_em,usuario)
        VALUES
        ('E1','ESTOQUE','estoque.xlsb','2026-08-31','h1','SUCESSO',2,2,0,CURRENT_TIMESTAMP,'teste'),
        ('R1','RUPTURA','ruptura.xlsb','2026-08-31','h2','SUCESSO',2,2,0,CURRENT_TIMESTAMP,'teste')
    """)
    con.close()
    return db


def _app_controlado(tmp_path: Path):
    db = _db_realista(tmp_path)
    app = FastAPI()

    async def resolver_usuario(request: Request):
        token = request.headers.get("x-user")
        if token == "loja18":
            return {"login": "loja18", "escopo": {"lojas": [18]}}
        if token == "sem-acesso":
            return {"login": "zero", "escopo": {"lojas": []}}
        raise HTTPException(status_code=401, detail="não autenticado")

    @contextmanager
    def abrir_conexao(_request: Request):
        con = duckdb.connect(str(db))
        try:
            yield con
        finally:
            con.close()

    instalar_rotas_estoque360(FastAPIHostBindings(
        app=app,
        resolver_usuario=resolver_usuario,
        abrir_conexao=abrir_conexao,
        runtime_root=_runtime_python(tmp_path),
        request_type=Request,
    ))
    return app


def test_runtime_controlado_exige_usuario_e_respeita_escopo(tmp_path):
    client = TestClient(_app_controlado(tmp_path))

    assert client.post('/api/estoque/resumo', json={}).status_code == 401

    r = client.post('/api/estoque/resumo', headers={'x-user':'loja18'}, json={})
    assert r.status_code == 200
    body = r.json()
    assert body['sem_acesso'] is False
    assert body['dados']['estoque_valor'] == 50
    assert body['dados']['itens_posicao'] == 1
    assert body['dados']['itens_ruptura'] == 1

    bloqueado = client.post('/api/estoque/resumo', headers={'x-user':'loja18'}, json={'loja':19})
    assert bloqueado.status_code == 200
    assert bloqueado.json()['sem_acesso'] is True

    zero = client.post('/api/estoque/resumo', headers={'x-user':'sem-acesso'}, json={})
    assert zero.status_code == 200
    assert zero.json()['sem_acesso'] is True


def test_as_sete_rotas_respondem_no_runtime_controlado(tmp_path):
    client = TestClient(_app_controlado(tmp_path))
    headers = {'x-user':'loja18'}
    for rota in (
        'resumo','ruptura','cobertura','excesso','abastecimento','transferencias','plano-acao'
    ):
        r = client.post(f'/api/estoque/{rota}', headers=headers, json={})
        assert r.status_code == 200, (rota, r.text)
        assert r.json().get('ok') is True
