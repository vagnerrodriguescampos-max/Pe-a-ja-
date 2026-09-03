"""Contratos de importação do Estoque 360.

Mapeia os campos mínimos esperados nas duas planilhas diárias e fornece regras
para validação estrutural antes de qualquer promoção da carga.
"""

TIPO_ESTOQUE = "ESTOQUE"
TIPO_RUPTURA = "RUPTURA"

CONTRATOS_IMPORTACAO = {
    TIPO_ESTOQUE: {
        "abas_preferenciais": ["Estoque"],
        "chave": ["loja", "sku"],
        "campos_minimos": [
            "loja",
            "sku",
            "descricao",
            "estoque_disponivel_qtd",
            "estoque_disponivel_valor",
            "venda_31d_qtd",
            "cmv_31d",
        ],
        "aliases": {
            # Na base Roldão real, "Produto" é o código numérico do SKU;
            # "Ref. padrão" é uma referência auxiliar (ex. MR000001) e não substitui o SKU.
            "sku": ["produto", "codigo material", "código material", "cod material", "cód material", "código do material", "codigo do material", "codigo produto", "código produto", "codigo do produto", "código do produto", "sku"],
            "descricao": ["descricao", "descrição", "material", "material descricao", "material descrição", "descrição do produto", "descricao do produto"],
            "loja": ["loja", "filial"],
            "departamento": ["departamento", "depto"],
            "secao": ["secao", "seção"],
            "categoria": ["categoria", "subcategoria", "sub-categoria"],
            "fornecedor": ["fornecedor"],
            "fabricante": ["fabricante"],
            "comprador": ["comprador"],
            "curva_abc": ["curva abc", "curva (abc)", "abc"],
            "curva_geral": ["curva geral"],
            "curva_loja": ["curva loja"],
            "top_300": ["top 300", "top300"],
            "nbo": ["nbo"],
            "tabloide": ["tabloide", "tablóide", "jornal"],
            "status_item": ["status item", "status"],
            "pack": ["pack"],
            "palete": ["palete", "pallet"],
            "estoque_total_qtd": ["estoque total", "est total"],
            "estoque_disponivel_qtd": ["estoque disponivel", "estoque disponível", "estoque disponível - qtde", "est livre", "estoque livre"],
            "estoque_disponivel_caixas": ["estoque caixas", "est caixas", "estoque disponível - cx"],
            "estoque_disponivel_paletes": ["estoque paletes", "est paletes", "estoque disponível - palete"],
            "estoque_disponivel_valor": ["estoque r$", "estoque valor", "est r$", "estoque disponível - r$"],
            "estoque_reservado_qtd": ["reservado", "estoque reservado"],
            "transito_qtd": ["transito", "trânsito", "qtd em trânsito", "transferencia", "transferência"],
            "pedido_pendente_qtd": ["pedido pendente", "ped pendente", "pedido aberto"],
            "pedido_pendente_valor": ["pedido pendente r$", "pedido valor"],
            "preco_venda": ["preco venda", "preço venda", "preço de venda"],
            "venda_31d_qtd": ["venda 31d qtd", "venda qtd 31", "venda 31 dias qtd", "venda qtde - 31 dd"],
            "venda_31d_valor": ["venda 31d r$", "venda 31 dias r$", "venda valor 31", "venda r$ - 31 dd"],
            "venda_90d_qtd": ["venda 90d", "venda 90 dias", "venda 90d qtd"],
            "cmv_31d": ["cmv", "cmv 31d", "cmv 31 dias", "venda cmv"],
            "carteira_qtd": ["carteira qtd", "carteira quantidade", "carteira qtde"],
            "carteira_valor": ["carteira r$", "carteira valor"],
        },
    },
    TIPO_RUPTURA: {
        "abas_preferenciais": ["BD"],
        "chave": ["loja", "sku"],
        "campos_minimos": [
            "loja",
            "sku",
            "descricao",
            "item_ativo",
            "ruptura",
            "estoque_qtd",
        ],
        "aliases": {
            "loja": ["loja", "filial"],
            "sku": ["codigo material", "código material", "cod material", "cód material", "código do material", "codigo do material", "codigo produto", "código produto", "codigo do produto", "código do produto", "sku"],
            "descricao": ["material", "descricao", "descrição", "descrição do produto", "descricao do produto"],
            "subcategoria": ["subcategoria", "sub-categoria"],
            "secao": ["secao", "seção"],
            "fornecedor": ["fornecedor"],
            "comprador": ["comprador"],
            "regional": ["regional"],
            "item_ativo": ["item ativo", "ativo", "itens ativos"],
            "ruptura": ["ruptura", "itens ruptura", "itens c/ ruptura", "item ruptura"],
            "ruptura_pct": ["% ruptura", "ruptura %", "percentual ruptura"],
            "estoque_qtd": ["estoque", "estoque qtd", "estoque qtde", "estoque quantidade"],
            "venda_90d_qtd": ["venda 90 dias", "venda 90d", "venda 90 dias qtd"],
            "venda_media_90d": ["venda media 90 dias", "venda média 90 dias", "vda media 90", "vda média 90", "media 90d"],
            "dde": ["dde", "ddv"],
            "pedido_aberto_qtd": ["pedido aberto", "pedido pendente", "ped. aberto - dl", "ped aberto - dl"],
            "distribuicao_cd_qtd": ["distribuicao cd", "distribuição cd", "dist. cd", "dist cd"],
            "pedido_total_qtd": ["pedido total", "ped. ttl", "ped ttl"],
            "ruptura_com_pedido": ["ruptura com pedido", "ruptura c/ pedido", "rup c/ pedido", "rup. ped. pend?"],
            "curva_abc": ["curva abc", "curva (abc)", "abc"],
            "nbo": ["nbo"],
            "tabloide": ["tabloide", "tablóide", "jornal"],
            "forma_distribuicao": ["forma distribuicao", "forma distribuição", "forma dist."],
        },
    },
}


def normalizar_cabecalho(valor: object) -> str:
    """Normaliza cabeçalhos para comparação tolerante a acentos/caixa/espaços."""
    import unicodedata

    texto = "" if valor is None else str(valor)
    texto = unicodedata.normalize("NFKD", texto)
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    return " ".join(texto.strip().lower().split())


def mapear_colunas(cabecalhos: list[object], tipo: str) -> dict[str, int]:
    """Retorna campo canônico -> índice da coluna encontrada."""
    contrato = CONTRATOS_IMPORTACAO[tipo]
    normalizados = [normalizar_cabecalho(c) for c in cabecalhos]
    encontrados: dict[str, int] = {}

    for campo, aliases in contrato["aliases"].items():
        candidatos = {normalizar_cabecalho(campo), *(normalizar_cabecalho(a) for a in aliases)}
        for idx, nome in enumerate(normalizados):
            if nome in candidatos:
                encontrados[campo] = idx
                break
    return encontrados


def validar_cabecalhos(cabecalhos: list[object], tipo: str) -> dict:
    """Valida estrutura mínima antes de permitir a carga."""
    mapeamento = mapear_colunas(cabecalhos, tipo)
    obrigatorios = CONTRATOS_IMPORTACAO[tipo]["campos_minimos"]
    faltantes = [c for c in obrigatorios if c not in mapeamento]
    return {
        "valido": not faltantes,
        "tipo": tipo,
        "mapeamento": mapeamento,
        "faltantes": faltantes,
    }
