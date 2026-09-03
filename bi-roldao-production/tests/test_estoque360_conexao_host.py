from pathlib import Path
import sys

import duckdb

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from integration.fastapi_adapter_estoque360 import _conexao_contexto


def test_conexao_duckdb_direta_nao_e_fechada_pelo_adapter():
    con = duckdb.connect(":memory:")
    con.execute("CREATE TABLE t(x INTEGER)")
    con.execute("INSERT INTO t VALUES (1)")

    with _conexao_contexto(con) as recebido:
        assert recebido is con
        assert recebido.execute("SELECT SUM(x) FROM t").fetchone()[0] == 1

    # Se o adapter tivesse usado __enter__/__exit__ do próprio DuckDB,
    # a conexão estaria fechada neste ponto.
    assert con.execute("SELECT COUNT(*) FROM t").fetchone()[0] == 1

    with _conexao_contexto(con) as recebido:
        assert recebido.execute("SELECT SUM(x) FROM t").fetchone()[0] == 1

    assert con.execute("SELECT COUNT(*) FROM t").fetchone()[0] == 1
    con.close()


def test_wrapper_context_manager_continua_sendo_encerrado():
    eventos = []
    recurso = object()

    class Wrapper:
        def __enter__(self):
            eventos.append("enter")
            return recurso

        def __exit__(self, exc_type, exc, tb):
            eventos.append("exit")

    with _conexao_contexto(Wrapper()) as recebido:
        assert recebido is recurso
        assert eventos == ["enter"]

    assert eventos == ["enter", "exit"]
