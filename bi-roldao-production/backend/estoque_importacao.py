"""Adaptador de importação das bases diárias do Estoque 360.

Este módulo é o ponto de integração com o endpoint administrativo existente.
Ele não cria uma rota paralela: recebe o arquivo já salvo pelo fluxo atual,
valida estrutura/data/hash e chama o ETL transacional.
"""

from __future__ import annotations

import hashlib
import re
from datetime import date
from pathlib import Path
from typing import Any, Iterator

from .estoque_contratos import (
    CONTRATOS_IMPORTACAO,
    TIPO_ESTOQUE,
    TIPO_RUPTURA,
    normalizar_cabecalho,
    validar_cabecalhos,
)
from .estoque_etl import CargaEstoqueInvalida, promover_posicao

TIPOS_ESTOQUE_360 = {TIPO_ESTOQUE, TIPO_RUPTURA}


class ImportacaoEstoqueErro(CargaEstoqueInvalida):
    """Falha de leitura/contrato antes da promoção transacional."""


def eh_tipo_estoque_360(tipo: str | None) -> bool:
    return bool(tipo and str(tipo).strip().upper() in TIPOS_ESTOQUE_360)


def hash_sha256(caminho: str | Path, bloco: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with open(caminho, "rb") as arquivo:
        while True:
            parte = arquivo.read(bloco)
            if not parte:
                break
            digest.update(parte)
    return digest.hexdigest()


def inferir_data_posicao(nome_arquivo: str, referencia: date | None = None) -> date:
    """Extrai DD.MM[.AAAA] do nome e resolve virada de ano pela data mais próxima."""
    referencia = referencia or date.today()
    encontrados = list(
        re.finditer(
            r"(?<!\d)(\d{1,2})[._-](\d{1,2})(?:[._-](\d{2,4}))?(?!\d)",
            Path(nome_arquivo).stem,
        )
    )
    if not encontrados:
        raise ImportacaoEstoqueErro(
            "Não foi possível identificar a data da posição no nome do arquivo. "
            "Informe a data explicitamente no upload."
        )

    match = encontrados[-1]
    dia, mes = int(match.group(1)), int(match.group(2))
    ano_txt = match.group(3)
    if ano_txt:
        ano = int(ano_txt)
        if ano < 100:
            ano += 2000
        try:
            return date(ano, mes, dia)
        except ValueError as exc:
            raise ImportacaoEstoqueErro("Data inválida no nome do arquivo") from exc

    candidatos: list[date] = []
    for ano in (referencia.year - 1, referencia.year, referencia.year + 1):
        try:
            candidatos.append(date(ano, mes, dia))
        except ValueError:
            continue
    if not candidatos:
        raise ImportacaoEstoqueErro("Data inválida no nome do arquivo")
    return min(candidatos, key=lambda d: abs((d - referencia).days))


def _abrir_workbook(caminho: str | Path) -> Any:
    try:
        from python_calamine import CalamineWorkbook
    except ImportError as exc:
        raise ImportacaoEstoqueErro(
            "Dependência python-calamine indisponível no ambiente."
        ) from exc

    try:
        return CalamineWorkbook.from_path(str(caminho))
    except Exception as exc:
        raise ImportacaoEstoqueErro(
            f"Não foi possível abrir a planilha {Path(caminho).name!r}: {exc}"
        ) from exc


def _nomes_abas(workbook: Any) -> list[str]:
    nomes = getattr(workbook, "sheet_names", [])
    if callable(nomes):
        nomes = nomes()
    return [str(nome) for nome in nomes]


def _selecionar_aba(workbook: Any, tipo: str) -> tuple[str, Any]:
    nomes = _nomes_abas(workbook)
    por_normalizado = {normalizar_cabecalho(nome): nome for nome in nomes}
    for preferida in CONTRATOS_IMPORTACAO[tipo]["abas_preferenciais"]:
        original = por_normalizado.get(normalizar_cabecalho(preferida))
        if original:
            try:
                return original, workbook.get_sheet_by_name(original)
            except Exception as exc:
                raise ImportacaoEstoqueErro(
                    f"A aba {original!r} existe, mas não pôde ser aberta."
                ) from exc

    raise ImportacaoEstoqueErro(
        f"Aba esperada para {tipo} não encontrada. Abas disponíveis: {', '.join(nomes)}"
    )


def _iterar_linhas_aba(aba: Any) -> Iterator[list[Any]]:
    iter_rows = getattr(aba, "iter_rows", None)
    if callable(iter_rows):
        for linha in iter_rows():
            yield list(linha)
        return

    to_python = getattr(aba, "to_python", None)
    if not callable(to_python):
        raise ImportacaoEstoqueErro("Leitor da planilha não expõe linhas utilizáveis.")
    for linha in to_python():
        yield list(linha)


def _localizar_cabecalho(
    linhas: Iterator[list[Any]], tipo: str, limite: int = 60
) -> tuple[dict[str, int], Iterator[list[Any]]]:
    """Procura o cabeçalho sem assumir que ele esteja na primeira linha."""
    for numero, linha in enumerate(linhas, start=1):
        if numero > limite:
            break
        validacao = validar_cabecalhos(linha, tipo)
        if validacao["valido"]:
            return validacao["mapeamento"], linhas

    obrigatorios = ", ".join(CONTRATOS_IMPORTACAO[tipo]["campos_minimos"])
    raise ImportacaoEstoqueErro(
        f"Cabeçalho válido não encontrado nas primeiras {limite} linhas. "
        f"Campos mínimos esperados: {obrigatorios}."
    )


def _linhas_canonicas(
    linhas: Iterator[list[Any]], mapeamento: dict[str, int]
) -> Iterator[dict[str, Any]]:
    for linha in linhas:
        if not linha or not any(valor not in (None, "") for valor in linha):
            continue
        registro: dict[str, Any] = {}
        for campo, indice in mapeamento.items():
            registro[campo] = linha[indice] if indice < len(linha) else None
        yield registro


def processar_arquivo_estoque_360(
    con: Any,
    *,
    caminho: str | Path,
    tipo: str,
    usuario: str | None = None,
    data_posicao: date | None = None,
    referencia_data: date | None = None,
) -> dict[str, Any]:
    """Processa ESTOQUE/RUPTURA e retorna payload pronto para a API administrativa."""
    tipo = str(tipo).strip().upper()
    if tipo not in TIPOS_ESTOQUE_360:
        raise ImportacaoEstoqueErro(f"Tipo não suportado pelo Estoque 360: {tipo!r}")

    caminho = Path(caminho)
    if not caminho.is_file():
        raise ImportacaoEstoqueErro(f"Arquivo não encontrado: {caminho}")
    if caminho.suffix.lower() not in {".xlsb", ".xlsx", ".xlsm"}:
        raise ImportacaoEstoqueErro("Formato não suportado. Use XLSB, XLSX ou XLSM.")

    data_posicao = data_posicao or inferir_data_posicao(
        caminho.name, referencia=referencia_data
    )
    hash_arquivo = hash_sha256(caminho)
    workbook = _abrir_workbook(caminho)
    nome_aba, aba = _selecionar_aba(workbook, tipo)
    linhas = _iterar_linhas_aba(aba)
    mapeamento, linhas_dados = _localizar_cabecalho(linhas, tipo)

    resultado = promover_posicao(
        con,
        tipo=tipo,
        arquivo_nome=caminho.name,
        data_posicao=data_posicao,
        hash_arquivo=hash_arquivo,
        linhas=_linhas_canonicas(linhas_dados, mapeamento),
        usuario=usuario,
    )

    return {
        "ok": resultado.status in {"SUCESSO", "IGNORADO_DUPLICADO"},
        "modulo": "ESTOQUE_360",
        "tipo": resultado.tipo,
        "data_posicao": resultado.data_posicao.isoformat(),
        "aba": nome_aba,
        "status": resultado.status,
        "importacao_id": resultado.importacao_id,
        "linhas_lidas": resultado.linhas_lidas,
        "linhas_validas": resultado.linhas_validas,
        "linhas_rejeitadas": resultado.linhas_rejeitadas,
        "mensagem": resultado.mensagem,
    }
