"""Schema canônico do Estoque 360.

Este módulo não executa migração automaticamente. Ele apenas centraliza o DDL
que será aplicado de forma controlada no DuckDB após validação em ambiente de teste.
"""

SCHEMA_ESTOQUE_360 = r'''
CREATE TABLE IF NOT EXISTS estoque_importacoes (
    id VARCHAR PRIMARY KEY,
    tipo VARCHAR NOT NULL,
    arquivo_nome VARCHAR NOT NULL,
    data_posicao DATE NOT NULL,
    hash_arquivo VARCHAR NOT NULL,
    status VARCHAR NOT NULL,
    linhas_lidas BIGINT DEFAULT 0,
    linhas_validas BIGINT DEFAULT 0,
    linhas_rejeitadas BIGINT DEFAULT 0,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    concluido_em TIMESTAMP,
    usuario VARCHAR,
    mensagem VARCHAR
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_estoque_importacoes_hash
ON estoque_importacoes(tipo, hash_arquivo);

CREATE TABLE IF NOT EXISTS estoque_diario (
    data_posicao DATE NOT NULL,
    loja VARCHAR NOT NULL,
    sku VARCHAR NOT NULL,
    descricao VARCHAR,
    departamento VARCHAR,
    secao VARCHAR,
    categoria VARCHAR,
    fornecedor VARCHAR,
    fabricante VARCHAR,
    comprador VARCHAR,
    curva_abc VARCHAR,
    curva_geral VARCHAR,
    curva_loja VARCHAR,
    top_300 BOOLEAN,
    nbo BOOLEAN,
    tabloide BOOLEAN,
    status_item VARCHAR,
    pack DOUBLE,
    palete DOUBLE,
    estoque_total_qtd DOUBLE,
    estoque_disponivel_qtd DOUBLE,
    estoque_disponivel_caixas DOUBLE,
    estoque_disponivel_paletes DOUBLE,
    estoque_disponivel_valor DOUBLE,
    estoque_reservado_qtd DOUBLE,
    transito_qtd DOUBLE,
    pedido_pendente_qtd DOUBLE,
    pedido_pendente_valor DOUBLE,
    carteira_qtd DOUBLE,
    carteira_valor DOUBLE,
    preco_venda DOUBLE,
    venda_31d_qtd DOUBLE,
    venda_31d_valor DOUBLE,
    venda_90d_qtd DOUBLE,
    venda_90d_valor DOUBLE,
    cmv_31d DOUBLE,
    importacao_id VARCHAR,
    carregado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (data_posicao, loja, sku)
);

CREATE TABLE IF NOT EXISTS ruptura_diaria (
    data_posicao DATE NOT NULL,
    loja VARCHAR NOT NULL,
    sku VARCHAR NOT NULL,
    descricao VARCHAR,
    subcategoria VARCHAR,
    secao VARCHAR,
    fornecedor VARCHAR,
    comprador VARCHAR,
    regional VARCHAR,
    item_ativo BOOLEAN,
    ruptura BOOLEAN,
    ruptura_pct DOUBLE,
    estoque_qtd DOUBLE,
    venda_90d_qtd DOUBLE,
    venda_media_90d DOUBLE,
    dde DOUBLE,
    pedido_aberto_qtd DOUBLE,
    distribuicao_cd_qtd DOUBLE,
    pedido_total_qtd DOUBLE,
    ruptura_com_pedido BOOLEAN,
    curva_abc VARCHAR,
    nbo BOOLEAN,
    tabloide BOOLEAN,
    forma_distribuicao VARCHAR,
    importacao_id VARCHAR,
    carregado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (data_posicao, loja, sku)
);

CREATE OR REPLACE VIEW vw_estoque_360 AS
SELECT
    e.*,
    r.regional,
    r.item_ativo,
    r.ruptura,
    r.ruptura_pct,
    r.ruptura_com_pedido,
    r.pedido_aberto_qtd,
    r.distribuicao_cd_qtd,
    r.forma_distribuicao,
    CASE WHEN COALESCE(e.venda_31d_qtd, 0) > 0
         THEN e.estoque_disponivel_qtd / (e.venda_31d_qtd / 31.0)
    END AS ddv_atual_31d,
    CASE WHEN COALESCE(e.venda_31d_qtd, 0) > 0
         THEN (
             COALESCE(e.estoque_disponivel_qtd,0) +
             COALESCE(e.transito_qtd,0) +
             COALESCE(e.pedido_pendente_qtd,0) +
             COALESCE(e.carteira_qtd,0)
         ) / (e.venda_31d_qtd / 31.0)
    END AS ddv_projetado_31d,
    CASE
        WHEN COALESCE(r.item_ativo, FALSE) AND COALESCE(r.ruptura, FALSE)
             AND COALESCE(r.pedido_aberto_qtd,0) <= 0 THEN 'P1_RUPTURA_SEM_PEDIDO'
        WHEN COALESCE(r.item_ativo, FALSE) AND COALESCE(r.ruptura, FALSE) THEN 'P2_RUPTURA_COM_PEDIDO'
        WHEN COALESCE(e.venda_31d_qtd,0) > 0 AND e.estoque_disponivel_qtd / (e.venda_31d_qtd/31.0) < 7 THEN 'P2_BAIXA_COBERTURA'
        WHEN COALESCE(e.venda_31d_qtd,0) = 0 AND COALESCE(e.estoque_disponivel_qtd,0) > 0 THEN 'P3_SEM_VENDA'
        WHEN COALESCE(e.venda_31d_qtd,0) > 0 AND e.estoque_disponivel_qtd / (e.venda_31d_qtd/31.0) > 90 THEN 'P3_EXCESSO'
        ELSE 'OK'
    END AS status_estoque
FROM estoque_diario e
LEFT JOIN ruptura_diaria r
  ON r.data_posicao = e.data_posicao
 AND r.loja = e.loja
 AND r.sku = e.sku;
'''