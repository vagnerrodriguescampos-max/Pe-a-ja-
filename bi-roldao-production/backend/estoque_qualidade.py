"""Controle de qualidade e saúde da posição do Estoque 360.

A saúde cruza o histórico de `estoque_importacoes` com as posições realmente
promovidas em `estoque_diario` e `ruptura_diaria`. Nenhuma nova tabela é criada.
"""
from __future__ import annotations

from datetime import date
from typing import Any

TIPOS = ("ESTOQUE", "RUPTURA")


def _row_dict(cur: Any) -> dict[str, Any] | None:
    row = cur.fetchone()
    if not row:
        return None
    nomes = [d[0] for d in cur.description]
    return dict(zip(nomes, row))


def _ultima_importacao(con: Any, tipo: str, *, somente_sucesso: bool) -> dict[str, Any] | None:
    where = "AND status='SUCESSO'" if somente_sucesso else ""
    return _row_dict(con.execute(f"""
        SELECT id, tipo, arquivo_nome, data_posicao, status,
               linhas_lidas, linhas_validas, linhas_rejeitadas,
               criado_em, concluido_em, usuario, mensagem
        FROM estoque_importacoes
        WHERE tipo=? {where}
        ORDER BY COALESCE(concluido_em, criado_em) DESC, criado_em DESC
        LIMIT 1
    """, [tipo]))


def _ultima_posicao_comum(con: Any) -> date | None:
    row = con.execute("""
        SELECT MAX(e.data_posicao)
        FROM estoque_diario e
        WHERE EXISTS (
            SELECT 1 FROM ruptura_diaria r WHERE r.data_posicao=e.data_posicao
        )
    """).fetchone()
    return row[0] if row and row[0] else None


def _serializar_importacao(item: dict[str, Any] | None) -> dict[str, Any] | None:
    if not item:
        return None
    return {
        "id": item.get("id"),
        "tipo": item.get("tipo"),
        "arquivo_nome": item.get("arquivo_nome"),
        "data_posicao": item.get("data_posicao"),
        "status": item.get("status"),
        "linhas_lidas": int(item.get("linhas_lidas") or 0),
        "linhas_validas": int(item.get("linhas_validas") or 0),
        "linhas_rejeitadas": int(item.get("linhas_rejeitadas") or 0),
        "criado_em": item.get("criado_em"),
        "concluido_em": item.get("concluido_em"),
        "usuario": item.get("usuario"),
        "mensagem": item.get("mensagem"),
    }


def qualidade_posicao(con: Any, data_solicitada: date | None = None) -> dict[str, Any]:
    """Retorna semáforo e trilha de auditoria das duas bases canônicas."""
    sucessos = {t: _ultima_importacao(con, t, somente_sucesso=True) for t in TIPOS}
    tentativas = {t: _ultima_importacao(con, t, somente_sucesso=False) for t in TIPOS}

    data_estoque = sucessos["ESTOQUE"].get("data_posicao") if sucessos["ESTOQUE"] else None
    data_ruptura = sucessos["RUPTURA"].get("data_posicao") if sucessos["RUPTURA"] else None
    data_comum = _ultima_posicao_comum(con)
    data_operacional = data_solicitada or data_comum

    linhas_posicao_estoque = 0
    linhas_posicao_ruptura = 0
    if data_operacional:
        linhas_posicao_estoque = int(con.execute(
            "SELECT COUNT(*) FROM estoque_diario WHERE data_posicao=?", [data_operacional]
        ).fetchone()[0] or 0)
        linhas_posicao_ruptura = int(con.execute(
            "SELECT COUNT(*) FROM ruptura_diaria WHERE data_posicao=?", [data_operacional]
        ).fetchone()[0] or 0)

    falhas_duplicidade = int(con.execute("""
        SELECT COUNT(*) FROM estoque_importacoes
        WHERE status='FALHA' AND LOWER(COALESCE(mensagem,'')) LIKE '%chave duplicada%'
    """).fetchone()[0] or 0)

    falha_recente = False
    processando = False
    alertas: list[str] = []
    for tipo in TIPOS:
        ultima = tentativas[tipo]
        sucesso = sucessos[tipo]
        if ultima and ultima.get("status") == "PROCESSANDO":
            processando = True
            alertas.append(f"{tipo.title()} possui carga em processamento.")
        if ultima and ultima.get("status") == "FALHA":
            momento_ultima = ultima.get("concluido_em") or ultima.get("criado_em")
            momento_sucesso = (sucesso or {}).get("concluido_em") or (sucesso or {}).get("criado_em")
            if not momento_sucesso or (momento_ultima and momento_ultima >= momento_sucesso):
                falha_recente = True
                alertas.append(f"A tentativa mais recente de {tipo.title()} falhou.")

    ambas_com_sucesso = bool(data_estoque and data_ruptura)
    datas_alinhadas = bool(ambas_com_sucesso and data_estoque == data_ruptura)
    posicao_completa = bool(data_operacional and linhas_posicao_estoque > 0 and linhas_posicao_ruptura > 0)

    diferenca_dias = None
    if data_estoque and data_ruptura:
        diferenca_dias = abs((data_estoque - data_ruptura).days)

    if not sucessos["ESTOQUE"]:
        alertas.append("Não existe carga de Estoque promovida com sucesso.")
    if not sucessos["RUPTURA"]:
        alertas.append("Não existe carga de Ruptura promovida com sucesso.")
    if ambas_com_sucesso and not datas_alinhadas:
        alertas.append(
            f"Datas desalinhadas: Estoque {data_estoque.isoformat()} x Ruptura {data_ruptura.isoformat()}."
        )
    if data_solicitada and not posicao_completa:
        alertas.append("A posição selecionada não possui as duas bases promovidas.")
    if not data_solicitada and ambas_com_sucesso and not data_comum:
        alertas.append("Não existe nenhuma data com Estoque e Ruptura promovidos em conjunto.")

    sem_posicao_util = bool(
        not ambas_com_sucesso
        or (data_solicitada is not None and not posicao_completa)
        or (data_solicitada is None and data_comum is None)
    )

    if sem_posicao_util:
        nivel = "VERMELHO"
        status = "CRITICO"
        mensagem = "Posição incompleta: Estoque 360 não possui as duas bases válidas em uma mesma data utilizável."
    elif not datas_alinhadas or falha_recente or processando:
        nivel = "AMARELO"
        status = "ATENCAO"
        mensagem = "Há uma posição completa utilizável, mas as cargas mais recentes exigem atenção."
    else:
        nivel = "VERDE"
        status = "SAUDAVEL"
        mensagem = "Estoque e Ruptura estão promovidos com sucesso e alinhados na mesma posição."

    ultima_atualizacao = None
    momentos = [
        x.get("concluido_em") for x in sucessos.values() if x and x.get("concluido_em") is not None
    ]
    if momentos:
        ultima_atualizacao = max(momentos)

    return {
        "nivel": nivel,
        "status": status,
        "mensagem": mensagem,
        "data_operacional": data_operacional,
        "data_comum_mais_recente": data_comum,
        "data_estoque": data_estoque,
        "data_ruptura": data_ruptura,
        "datas_alinhadas": datas_alinhadas,
        "diferenca_dias": diferenca_dias,
        "posicao_completa": posicao_completa,
        "linhas_posicao_estoque": linhas_posicao_estoque,
        "linhas_posicao_ruptura": linhas_posicao_ruptura,
        "ultima_atualizacao": ultima_atualizacao,
        "falha_recente": falha_recente,
        "processando": processando,
        "falhas_duplicidade_historico": falhas_duplicidade,
        "alertas": alertas,
        "ultima_carga_estoque": _serializar_importacao(tentativas["ESTOQUE"]),
        "ultima_carga_ruptura": _serializar_importacao(tentativas["RUPTURA"]),
        "ultimo_sucesso_estoque": _serializar_importacao(sucessos["ESTOQUE"]),
        "ultimo_sucesso_ruptura": _serializar_importacao(sucessos["RUPTURA"]),
    }
