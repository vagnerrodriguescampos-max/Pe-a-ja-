"""Queries unificadas do Estoque 360.

Todas as visões usam a mesma data, filtros e escopo. `escopo_lojas=None`
significa acesso irrestrito. Qualquer interseção vazia em escopo restrito
é tratada como zero acesso e nunca como ausência de filtro.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any


@dataclass(frozen=True)
class FiltroEstoque:
    data_posicao: date | None = None
    lojas: tuple[str, ...] = ()
    sem_acesso: bool = False
    regional: str | None = None
    departamento: str | None = None
    secao: str | None = None
    categoria: str | None = None
    fornecedor: str | None = None
    comprador: str | None = None
    curva_abc: str | None = None
    top_300: bool | None = None
    nbo: bool | None = None
    tabloide: bool | None = None
    status_estoque: str | None = None
    ddv_alvo: float = 45.0

    @classmethod
    def de_dict(cls, corpo: dict | None, escopo_lojas: list[str] | None = None) -> "FiltroEstoque":
        corpo = corpo or {}
        solicitadas = corpo.get("lojas") or corpo.get("loja") or []
        if isinstance(solicitadas, str):
            solicitadas = [solicitadas]
        solicitadas = [str(x).strip() for x in solicitadas if str(x).strip()]

        sem_acesso = False
        if escopo_lojas is None:
            lojas = solicitadas
        else:
            permitidas = {str(x).strip() for x in escopo_lojas if str(x).strip()}
            if not permitidas:
                lojas, sem_acesso = [], True
            elif solicitadas:
                lojas = [x for x in solicitadas if x in permitidas]
                sem_acesso = len(lojas) == 0
            else:
                lojas = sorted(permitidas)

        data_val = corpo.get("data_posicao")
        if isinstance(data_val, str) and data_val:
            data_val = date.fromisoformat(data_val[:10])
        elif not isinstance(data_val, date):
            data_val = None

        def b(nome: str) -> bool | None:
            valor = corpo.get(nome)
            if valor is None or valor == "":
                return None
            if isinstance(valor, bool):
                return valor
            return str(valor).strip().lower() in {"1", "true", "sim", "s", "yes"}

        alvo = float(corpo.get("ddv_alvo") or 45)
        return cls(
            data_posicao=data_val,
            lojas=tuple(lojas),
            sem_acesso=sem_acesso,
            regional=corpo.get("regional"),
            departamento=corpo.get("departamento"),
            secao=corpo.get("secao"),
            categoria=corpo.get("categoria"),
            fornecedor=corpo.get("fornecedor"),
            comprador=corpo.get("comprador"),
            curva_abc=corpo.get("curva_abc"),
            top_300=b("top_300"),
            nbo=b("nbo"),
            tabloide=b("tabloide"),
            status_estoque=corpo.get("status_estoque"),
            ddv_alvo=max(1.0, min(alvo, 365.0)),
        )


def _rows(cur: Any) -> list[dict]:
    nomes = [d[0] for d in cur.description]
    return [dict(zip(nomes, row)) for row in cur.fetchall()]


def resolver_data_posicao(con: Any, solicitada: date | None = None) -> date | None:
    """Resolve somente posições completas quando a data não é explicitamente pedida.

    Estoque 360 combina Estoque + Ruptura. Sem uma data comum, retornar uma posição
    somente de Estoque faria indicadores como ruptura parecerem válidos quando não são.
    """
    if solicitada:
        return solicitada
    row = con.execute("""
        SELECT MAX(e.data_posicao)
        FROM estoque_diario e
        WHERE EXISTS (
            SELECT 1 FROM ruptura_diaria r WHERE r.data_posicao = e.data_posicao
        )
    """).fetchone()
    return row[0] if row and row[0] else None


def _where(f: FiltroEstoque, data_posicao: date, alias: str = "v") -> tuple[str, list[Any]]:
    if f.sem_acesso:
        return "1=0", []
    cond = [f"{alias}.data_posicao = ?"]
    params: list[Any] = [data_posicao]
    if f.lojas:
        cond.append(f"{alias}.loja IN ({','.join('?' for _ in f.lojas)})")
        params.extend(f.lojas)
    for campo in ("regional", "departamento", "secao", "categoria", "fornecedor", "comprador", "curva_abc"):
        valor = getattr(f, campo)
        if valor not in (None, ""):
            cond.append(f"{alias}.{campo} = ?")
            params.append(valor)
    for campo in ("top_300", "nbo", "tabloide"):
        valor = getattr(f, campo)
        if valor is not None:
            cond.append(f"COALESCE({alias}.{campo}, FALSE) = ?")
            params.append(valor)
    if f.status_estoque:
        cond.append(f"{alias}.status_estoque = ?")
        params.append(f.status_estoque)
    return " AND ".join(cond), params


def metadados_posicao(con: Any, f: FiltroEstoque) -> dict:
    data = resolver_data_posicao(con, f.data_posicao)
    if not data:
        return {"data_posicao": None, "estoque": False, "ruptura": False}
    e = con.execute("SELECT COUNT(*) FROM estoque_diario WHERE data_posicao=?", [data]).fetchone()[0]
    r = con.execute("SELECT COUNT(*) FROM ruptura_diaria WHERE data_posicao=?", [data]).fetchone()[0]
    return {
        "data_posicao": data,
        "estoque": e > 0,
        "ruptura": r > 0,
        "linhas_estoque": e,
        "linhas_ruptura": r,
    }


def resumo(con: Any, f: FiltroEstoque) -> dict:
    if f.sem_acesso:
        return {"sem_acesso": True}
    data = resolver_data_posicao(con, f.data_posicao)
    if not data:
        return {"data_posicao": None}
    where, p = _where(f, data)
    cur = con.execute(f"""
        SELECT
          SUM(COALESCE(estoque_disponivel_valor,0)) estoque_valor,
          SUM(COALESCE(estoque_disponivel_qtd,0)) estoque_qtd,
          SUM(COALESCE(venda_31d_valor,0)) venda_31d_valor,
          SUM(COALESCE(cmv_31d,0)) cmv_31d,
          SUM(COALESCE(carteira_valor,0)) carteira_valor,
          SUM(COALESCE(pedido_pendente_valor,0)) pedido_pendente_valor,
          CASE WHEN SUM(COALESCE(venda_31d_qtd,0))>0
               THEN SUM(COALESCE(estoque_disponivel_qtd,0))/(SUM(COALESCE(venda_31d_qtd,0))/31.0) END ddv_atual,
          CASE WHEN SUM(COALESCE(venda_31d_qtd,0))>0
               THEN SUM(COALESCE(estoque_disponivel_qtd,0)+COALESCE(transito_qtd,0)+COALESCE(pedido_pendente_qtd,0)+COALESCE(carteira_qtd,0))/(SUM(COALESCE(venda_31d_qtd,0))/31.0) END ddv_projetado,
          COUNT(*) itens_posicao,
          SUM(CASE WHEN COALESCE(item_ativo,FALSE) THEN 1 ELSE 0 END) itens_ativos,
          SUM(CASE WHEN COALESCE(item_ativo,FALSE) AND COALESCE(ruptura,FALSE) THEN 1 ELSE 0 END) itens_ruptura,
          SUM(CASE WHEN COALESCE(item_ativo,FALSE) AND COALESCE(ruptura,FALSE) AND COALESCE(pedido_aberto_qtd,0)<=0 THEN 1 ELSE 0 END) ruptura_sem_pedido,
          SUM(CASE WHEN COALESCE(item_ativo,FALSE) AND COALESCE(ruptura,FALSE) AND COALESCE(pedido_aberto_qtd,0)>0 THEN 1 ELSE 0 END) ruptura_com_pedido,
          SUM(CASE WHEN COALESCE(venda_31d_qtd,0)=0 AND COALESCE(estoque_disponivel_valor,0)>0 THEN estoque_disponivel_valor ELSE 0 END) estoque_sem_venda_valor,
          SUM(CASE WHEN COALESCE(ddv_atual_31d,0)>? AND COALESCE(estoque_disponivel_valor,0)>0
                   THEN estoque_disponivel_valor*(1-?/ddv_atual_31d) ELSE 0 END) capital_excedente_estimado
        FROM vw_estoque_360 v WHERE {where}
    """, [f.ddv_alvo, f.ddv_alvo, *p])
    row = cur.fetchone()
    nomes = [d[0] for d in cur.description]
    out = dict(zip(nomes, row)) if row else {}
    ativos = out.get("itens_ativos") or 0
    out["ruptura_pct"] = ((out.get("itens_ruptura") or 0) / ativos * 100) if ativos else 0
    out["data_posicao"] = data
    out["ddv_alvo"] = f.ddv_alvo
    return out


def ranking_ruptura(con: Any, f: FiltroEstoque, dimensao: str = "loja", limite: int = 50) -> list[dict]:
    permitidas = {"regional", "loja", "departamento", "secao", "categoria", "fornecedor", "comprador", "curva_abc"}
    if dimensao not in permitidas:
        raise ValueError("Dimensão não permitida")
    data = resolver_data_posicao(con, f.data_posicao)
    if not data or f.sem_acesso:
        return []
    where, p = _where(f, data)
    return _rows(con.execute(f"""
        SELECT {dimensao} dimensao,
          COUNT(*) itens,
          SUM(CASE WHEN COALESCE(item_ativo,FALSE) THEN 1 ELSE 0 END) itens_ativos,
          SUM(CASE WHEN COALESCE(item_ativo,FALSE) AND COALESCE(ruptura,FALSE) THEN 1 ELSE 0 END) ruptura,
          SUM(CASE WHEN COALESCE(item_ativo,FALSE) AND COALESCE(ruptura,FALSE) AND COALESCE(pedido_aberto_qtd,0)<=0 THEN 1 ELSE 0 END) sem_pedido,
          SUM(CASE WHEN COALESCE(item_ativo,FALSE) AND COALESCE(ruptura,FALSE) AND COALESCE(pedido_aberto_qtd,0)>0 THEN 1 ELSE 0 END) com_pedido,
          100.0*SUM(CASE WHEN COALESCE(item_ativo,FALSE) AND COALESCE(ruptura,FALSE) THEN 1 ELSE 0 END)
            /NULLIF(SUM(CASE WHEN COALESCE(item_ativo,FALSE) THEN 1 ELSE 0 END),0) ruptura_pct
        FROM vw_estoque_360 v WHERE {where}
        GROUP BY {dimensao} ORDER BY ruptura_pct DESC NULLS LAST LIMIT ?
    """, [*p, max(1, min(int(limite), 500))]))


def faixas_cobertura(con: Any, f: FiltroEstoque) -> list[dict]:
    data = resolver_data_posicao(con, f.data_posicao)
    if not data or f.sem_acesso:
        return []
    where, p = _where(f, data)
    return _rows(con.execute(f"""
      SELECT CASE
        WHEN COALESCE(venda_31d_qtd,0)=0 AND COALESCE(estoque_disponivel_qtd,0)>0 THEN 'SEM_VENDA'
        WHEN COALESCE(ddv_atual_31d,0)<=0 THEN '0'
        WHEN ddv_atual_31d<=7 THEN '01_07'
        WHEN ddv_atual_31d<=15 THEN '08_15'
        WHEN ddv_atual_31d<=30 THEN '16_30'
        WHEN ddv_atual_31d<=45 THEN '31_45'
        WHEN ddv_atual_31d<=60 THEN '46_60'
        WHEN ddv_atual_31d<=90 THEN '61_90'
        ELSE 'MAIS_90' END faixa,
        COUNT(*) itens, SUM(COALESCE(estoque_disponivel_valor,0)) estoque_valor
      FROM vw_estoque_360 v WHERE {where} GROUP BY 1 ORDER BY 1
    """, p))


def excesso(con: Any, f: FiltroEstoque, limite: int = 200) -> list[dict]:
    data = resolver_data_posicao(con, f.data_posicao)
    if not data or f.sem_acesso:
        return []
    where, p = _where(f, data)
    return _rows(con.execute(f"""
      SELECT loja, sku, descricao, departamento, categoria, fornecedor, comprador, curva_abc,
        estoque_disponivel_qtd, estoque_disponivel_valor, venda_31d_qtd, ddv_atual_31d,
        GREATEST(estoque_disponivel_qtd-(venda_31d_qtd/31.0)*?,0) excesso_qtd,
        CASE WHEN estoque_disponivel_valor>0 THEN estoque_disponivel_valor*(1-?/ddv_atual_31d) ELSE 0 END excesso_valor
      FROM vw_estoque_360 v
      WHERE {where} AND COALESCE(ddv_atual_31d,0)>?
      ORDER BY excesso_valor DESC NULLS LAST LIMIT ?
    """, [f.ddv_alvo, f.ddv_alvo, *p, f.ddv_alvo, max(1, min(int(limite), 2000))]))


def abastecimento(con: Any, f: FiltroEstoque, limite: int = 200) -> list[dict]:
    data = resolver_data_posicao(con, f.data_posicao)
    if not data or f.sem_acesso:
        return []
    where, p = _where(f, data)
    return _rows(con.execute(f"""
      WITH x AS (
        SELECT loja, sku, descricao, categoria, fornecedor, comprador, curva_abc, top_300, nbo, tabloide,
          estoque_disponivel_qtd, venda_31d_qtd, ddv_atual_31d, transito_qtd, pedido_pendente_qtd,
          carteira_qtd, ddv_projetado_31d, pack,
          GREATEST((venda_31d_qtd/31.0)*? - COALESCE(estoque_disponivel_qtd,0)
            - COALESCE(transito_qtd,0)-COALESCE(pedido_pendente_qtd,0)-COALESCE(carteira_qtd,0),0) necessidade_qtd
        FROM vw_estoque_360 v WHERE {where} AND COALESCE(venda_31d_qtd,0)>0
      )
      SELECT * FROM x WHERE necessidade_qtd>0
      ORDER BY (CASE WHEN top_300 THEN 0 WHEN curva_abc='A' THEN 1 ELSE 2 END), necessidade_qtd DESC
      LIMIT ?
    """, [f.ddv_alvo, *p, max(1, min(int(limite), 2000))]))


def transferencias(con: Any, f: FiltroEstoque, limite: int = 200, reserva_origem: float = 30.0, alvo_destino: float = 30.0) -> list[dict]:
    data = resolver_data_posicao(con, f.data_posicao)
    if not data or f.sem_acesso or len(f.lojas) == 1:
        return []
    where, p = _where(f, data, "v")
    return _rows(con.execute(f"""
      WITH b AS (SELECT * FROM vw_estoque_360 v WHERE {where}),
      origem AS (
        SELECT *, GREATEST(estoque_disponivel_qtd-(venda_31d_qtd/31.0)*?,0) transferivel
        FROM b WHERE COALESCE(venda_31d_qtd,0)>0 AND ddv_atual_31d>?
      ), destino AS (
        SELECT *, GREATEST((venda_31d_qtd/31.0)*?-estoque_disponivel_qtd,0) necessidade
        FROM b WHERE COALESCE(venda_31d_qtd,0)>0 AND COALESCE(ddv_atual_31d,0)<7
      )
      SELECT d.sku, d.descricao, o.loja loja_origem, d.loja loja_destino,
        o.ddv_atual_31d ddv_origem, d.ddv_atual_31d ddv_destino,
        LEAST(o.transferivel,d.necessidade) sugestao_qtd
      FROM origem o JOIN destino d ON d.sku=o.sku AND d.loja<>o.loja
      WHERE LEAST(o.transferivel,d.necessidade)>0
      ORDER BY sugestao_qtd DESC LIMIT ?
    """, [*p, reserva_origem, reserva_origem, alvo_destino, max(1, min(int(limite), 2000))]))


def plano_acao(con: Any, f: FiltroEstoque, limite: int = 300) -> list[dict]:
    data = resolver_data_posicao(con, f.data_posicao)
    if not data or f.sem_acesso:
        return []
    where, p = _where(f, data)
    return _rows(con.execute(f"""
      WITH x AS (
        SELECT loja, sku, descricao, categoria, fornecedor, comprador, curva_abc, top_300, nbo, tabloide,
          estoque_disponivel_qtd, estoque_disponivel_valor, venda_31d_qtd, ddv_atual_31d, ddv_projetado_31d,
          pedido_aberto_qtd, pedido_pendente_qtd, carteira_qtd, item_ativo, ruptura,
          CASE
            WHEN COALESCE(item_ativo,FALSE) AND COALESCE(ruptura,FALSE) AND COALESCE(pedido_aberto_qtd,0)<=0 THEN 'P1'
            WHEN COALESCE(item_ativo,FALSE) AND COALESCE(ruptura,FALSE) THEN 'P2'
            WHEN COALESCE(ddv_atual_31d,999)<7 THEN 'P2'
            WHEN COALESCE(ddv_atual_31d,0)>90 THEN 'P3'
            WHEN COALESCE(venda_31d_qtd,0)=0 AND COALESCE(estoque_disponivel_qtd,0)>0 THEN 'P3'
            ELSE 'OK' END prioridade,
          CASE
            WHEN COALESCE(item_ativo,FALSE) AND COALESCE(ruptura,FALSE) AND COALESCE(pedido_aberto_qtd,0)<=0 THEN 'ABASTECER_COMPRAR'
            WHEN COALESCE(item_ativo,FALSE) AND COALESCE(ruptura,FALSE) THEN 'ACOMPANHAR_PEDIDO'
            WHEN COALESCE(ddv_atual_31d,999)<7 THEN 'PROGRAMAR_ABASTECIMENTO'
            WHEN COALESCE(ddv_atual_31d,0)>90 THEN 'REDUZIR_COMPRA_OU_TRANSFERIR'
            WHEN COALESCE(venda_31d_qtd,0)=0 AND COALESCE(estoque_disponivel_qtd,0)>0 THEN 'REVISAR_SORTIMENTO'
            ELSE 'OK' END acao
        FROM vw_estoque_360 v WHERE {where}
      )
      SELECT * FROM x WHERE prioridade<>'OK'
      ORDER BY prioridade,
        (CASE WHEN top_300 THEN 0 WHEN curva_abc='A' THEN 1 ELSE 2 END),
        estoque_disponivel_valor DESC NULLS LAST
      LIMIT ?
    """, [*p, max(1, min(int(limite), 3000))]))
