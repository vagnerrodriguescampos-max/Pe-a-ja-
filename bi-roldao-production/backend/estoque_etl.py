"""ETL transacional e idempotente do Estoque 360.

Recebe linhas já convertidas para o contrato canônico e promove uma posição diária
somente depois de validar chaves e consistência mínima. A promoção substitui apenas
a partição do mesmo tipo/data e ocorre dentro de transação, preservando a posição
anterior em caso de falha.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any, Iterable
from uuid import uuid4

from .estoque_contratos import TIPO_ESTOQUE, TIPO_RUPTURA
from .estoque_schema import SCHEMA_ESTOQUE_360


class CargaEstoqueInvalida(ValueError):
    """Erro de qualidade que impede a promoção de uma posição."""


@dataclass(frozen=True)
class ResultadoImportacao:
    importacao_id: str
    tipo: str
    data_posicao: date
    status: str
    linhas_lidas: int
    linhas_validas: int
    linhas_rejeitadas: int
    mensagem: str = ""


CAMPOS_ESTOQUE = [
    "data_posicao", "loja", "sku", "descricao", "departamento", "secao",
    "categoria", "fornecedor", "fabricante", "comprador", "curva_abc",
    "curva_geral", "curva_loja", "top_300", "nbo", "tabloide", "status_item",
    "pack", "palete", "estoque_total_qtd", "estoque_disponivel_qtd",
    "estoque_disponivel_caixas", "estoque_disponivel_paletes",
    "estoque_disponivel_valor", "estoque_reservado_qtd", "transito_qtd",
    "pedido_pendente_qtd", "pedido_pendente_valor", "carteira_qtd",
    "carteira_valor", "preco_venda", "venda_31d_qtd", "venda_31d_valor",
    "venda_90d_qtd", "venda_90d_valor", "cmv_31d", "importacao_id",
]

CAMPOS_RUPTURA = [
    "data_posicao", "loja", "sku", "descricao", "subcategoria", "secao",
    "fornecedor", "comprador", "regional", "item_ativo", "ruptura",
    "ruptura_pct", "estoque_qtd", "venda_90d_qtd", "venda_media_90d", "dde",
    "pedido_aberto_qtd", "distribuicao_cd_qtd", "pedido_total_qtd",
    "ruptura_com_pedido", "curva_abc", "nbo", "tabloide",
    "forma_distribuicao", "importacao_id",
]

CAMPOS_BOOLEANOS = {
    "top_300", "nbo", "tabloide", "item_ativo", "ruptura", "ruptura_com_pedido"
}

CAMPOS_NUMERICOS = {
    "pack", "palete", "estoque_total_qtd", "estoque_disponivel_qtd",
    "estoque_disponivel_caixas", "estoque_disponivel_paletes",
    "estoque_disponivel_valor", "estoque_reservado_qtd", "transito_qtd",
    "pedido_pendente_qtd", "pedido_pendente_valor", "carteira_qtd",
    "carteira_valor", "preco_venda", "venda_31d_qtd", "venda_31d_valor",
    "venda_90d_qtd", "venda_90d_valor", "cmv_31d", "ruptura_pct",
    "estoque_qtd", "venda_media_90d", "dde", "pedido_aberto_qtd",
    "distribuicao_cd_qtd", "pedido_total_qtd",
}


def garantir_schema(con: Any) -> None:
    """Aplica apenas DDL idempotente do módulo."""
    con.execute(SCHEMA_ESTOQUE_360)


def _texto(valor: Any) -> str | None:
    if valor is None:
        return None
    texto = str(valor).strip()
    return texto or None


def _numero(valor: Any) -> float | None:
    if valor is None or valor == "":
        return None
    if isinstance(valor, (int, float)):
        return float(valor)
    texto = str(valor).strip().replace("R$", "").replace(" ", "")
    if not texto:
        return None
    # Aceita decimal brasileiro e formato internacional.
    if "," in texto and "." in texto:
        if texto.rfind(",") > texto.rfind("."):
            texto = texto.replace(".", "").replace(",", ".")
        else:
            texto = texto.replace(",", "")
    elif "," in texto:
        texto = texto.replace(".", "").replace(",", ".")
    try:
        return float(texto)
    except ValueError as exc:
        raise CargaEstoqueInvalida(f"Valor numérico inválido: {valor!r}") from exc


def _booleano(valor: Any) -> bool | None:
    if valor is None or valor == "":
        return None
    if isinstance(valor, bool):
        return valor
    if isinstance(valor, (int, float)):
        return bool(valor)
    texto = str(valor).strip().lower()
    verdadeiros = {"1", "sim", "s", "true", "verdadeiro", "x", "ativo", "ruptura"}
    falsos = {"0", "nao", "não", "n", "false", "falso", "inativo"}
    if texto in verdadeiros:
        return True
    if texto in falsos:
        return False
    return None


def _normalizar_linha(linha: dict[str, Any], tipo: str, data_posicao: date, importacao_id: str) -> dict[str, Any]:
    campos = CAMPOS_ESTOQUE if tipo == TIPO_ESTOQUE else CAMPOS_RUPTURA
    saida: dict[str, Any] = {}
    for campo in campos:
        if campo == "data_posicao":
            saida[campo] = data_posicao
        elif campo == "importacao_id":
            saida[campo] = importacao_id
        elif campo in CAMPOS_BOOLEANOS:
            saida[campo] = _booleano(linha.get(campo))
        elif campo in CAMPOS_NUMERICOS:
            saida[campo] = _numero(linha.get(campo))
        else:
            saida[campo] = _texto(linha.get(campo))

    saida["loja"] = _texto(linha.get("loja"))
    saida["sku"] = _texto(linha.get("sku"))
    if not saida["loja"] or not saida["sku"]:
        raise CargaEstoqueInvalida("Linha sem chave obrigatória loja + sku")
    return saida


def _preparar_linhas(
    linhas: Iterable[dict[str, Any]],
    tipo: str,
    data_posicao: date,
    importacao_id: str,
) -> tuple[list[dict[str, Any]], int]:
    preparadas: list[dict[str, Any]] = []
    chaves: set[tuple[str, str]] = set()
    lidas = 0

    for linha in linhas:
        lidas += 1
        if not linha or not any(v not in (None, "") for v in linha.values()):
            continue
        normalizada = _normalizar_linha(linha, tipo, data_posicao, importacao_id)
        chave = (normalizada["loja"], normalizada["sku"])
        if chave in chaves:
            raise CargaEstoqueInvalida(
                f"Chave duplicada na carga: loja={chave[0]!r}, sku={chave[1]!r}"
            )
        chaves.add(chave)
        preparadas.append(normalizada)

    if not preparadas:
        raise CargaEstoqueInvalida("A carga não contém linhas válidas")
    return preparadas, lidas


def _buscar_importacao_por_hash(con: Any, tipo: str, hash_arquivo: str) -> tuple | None:
    return con.execute(
        "SELECT id, status, data_posicao, linhas_lidas, linhas_validas, linhas_rejeitadas "
        "FROM estoque_importacoes WHERE tipo = ? AND hash_arquivo = ? LIMIT 1",
        [tipo, hash_arquivo],
    ).fetchone()


def _registrar_inicio(
    con: Any,
    importacao_id: str,
    tipo: str,
    arquivo_nome: str,
    data_posicao: date,
    hash_arquivo: str,
    usuario: str | None,
) -> None:
    existente = _buscar_importacao_por_hash(con, tipo, hash_arquivo)
    if existente:
        con.execute(
            "UPDATE estoque_importacoes SET status='PROCESSANDO', data_posicao=?, arquivo_nome=?, "
            "usuario=?, mensagem=NULL, concluido_em=NULL WHERE id=?",
            [data_posicao, arquivo_nome, usuario, existente[0]],
        )
        return
    con.execute(
        "INSERT INTO estoque_importacoes "
        "(id,tipo,arquivo_nome,data_posicao,hash_arquivo,status,usuario) "
        "VALUES (?,?,?,?,?,'PROCESSANDO',?)",
        [importacao_id, tipo, arquivo_nome, data_posicao, hash_arquivo, usuario],
    )


def _finalizar_auditoria(
    con: Any,
    importacao_id: str,
    status: str,
    lidas: int,
    validas: int,
    rejeitadas: int,
    mensagem: str,
) -> None:
    con.execute(
        "UPDATE estoque_importacoes SET status=?, linhas_lidas=?, linhas_validas=?, "
        "linhas_rejeitadas=?, mensagem=?, concluido_em=CURRENT_TIMESTAMP WHERE id=?",
        [status, lidas, validas, rejeitadas, mensagem, importacao_id],
    )


def promover_posicao(
    con: Any,
    *,
    tipo: str,
    arquivo_nome: str,
    data_posicao: date,
    hash_arquivo: str,
    linhas: Iterable[dict[str, Any]],
    usuario: str | None = None,
) -> ResultadoImportacao:
    """Promove uma posição diária com idempotência e rollback integral.

    Mesmo arquivo (mesmo hash + tipo) já concluído é ignorado. Um arquivo corrigido,
    com hash diferente e mesma data, substitui somente a partição daquele tipo/data.
    """
    if tipo not in {TIPO_ESTOQUE, TIPO_RUPTURA}:
        raise CargaEstoqueInvalida(f"Tipo de carga não suportado: {tipo}")
    if not hash_arquivo:
        raise CargaEstoqueInvalida("hash_arquivo é obrigatório")

    garantir_schema(con)
    anterior = _buscar_importacao_por_hash(con, tipo, hash_arquivo)
    if anterior and anterior[1] == "SUCESSO":
        return ResultadoImportacao(
            importacao_id=anterior[0],
            tipo=tipo,
            data_posicao=anterior[2],
            status="IGNORADO_DUPLICADO",
            linhas_lidas=int(anterior[3] or 0),
            linhas_validas=int(anterior[4] or 0),
            linhas_rejeitadas=int(anterior[5] or 0),
            mensagem="Arquivo já importado anteriormente com sucesso.",
        )

    importacao_id = anterior[0] if anterior else str(uuid4())
    _registrar_inicio(
        con, importacao_id, tipo, arquivo_nome, data_posicao, hash_arquivo, usuario
    )

    lidas = validas = rejeitadas = 0
    try:
        preparadas, lidas = _preparar_linhas(linhas, tipo, data_posicao, importacao_id)
        validas = len(preparadas)

        tabela = "estoque_diario" if tipo == TIPO_ESTOQUE else "ruptura_diaria"
        campos = CAMPOS_ESTOQUE if tipo == TIPO_ESTOQUE else CAMPOS_RUPTURA
        placeholders = ",".join("?" for _ in campos)
        insert_sql = f"INSERT INTO {tabela} ({','.join(campos)}) VALUES ({placeholders})"
        valores = [[linha.get(campo) for campo in campos] for linha in preparadas]

        con.execute("BEGIN TRANSACTION")
        con.execute(f"DELETE FROM {tabela} WHERE data_posicao = ?", [data_posicao])
        con.executemany(insert_sql, valores)
        con.execute("COMMIT")

        _finalizar_auditoria(
            con, importacao_id, "SUCESSO", lidas, validas, rejeitadas,
            f"Posição {data_posicao.isoformat()} promovida com sucesso.",
        )
        return ResultadoImportacao(
            importacao_id=importacao_id,
            tipo=tipo,
            data_posicao=data_posicao,
            status="SUCESSO",
            linhas_lidas=lidas,
            linhas_validas=validas,
            linhas_rejeitadas=rejeitadas,
            mensagem="Carga promovida com sucesso.",
        )
    except Exception as exc:
        try:
            con.execute("ROLLBACK")
        except Exception:
            pass
        rejeitadas = max(lidas - validas, 0)
        _finalizar_auditoria(
            con, importacao_id, "FALHA", lidas, validas, rejeitadas, str(exc)
        )
        raise
