import os
import io
import sys
import ast
import time
import base64
import json
import uuid
import contextlib
import traceback
from typing import Dict, Any, List, Optional
import polars as pl

from .config import DASHBOARDS_DATA_DIR
from .database import get_connection
from .schemas import (
    ColumnMetadata,
    TableOut,
)
from .storage import list_dashboard_tables, profile_dataframe, get_dashboard_dir

class NotebookKernelSession:
    def __init__(self, dashboard_id: str):
        self.dashboard_id = dashboard_id
        self.execution_count = 0
        self.scope: Dict[str, Any] = {}
        self.reset()

    def reset(self):
        self.execution_count = 0
        self.scope = {
            "pl": pl,
        }

        # Pre-inject dashboard tables
        tables = list_dashboard_tables(self.dashboard_id)
        first = True
        for tbl in tables:
            try:
                if os.path.exists(tbl.file_path):
                    loaded_df = pl.read_parquet(tbl.file_path)
                    var_name = "".join(c if c.isalnum() else "_" for c in tbl.display_name).lower()
                    if var_name.isidentifier():
                        self.scope[var_name] = loaded_df
                    if first:
                        self.scope["df"] = loaded_df
                        first = False
            except Exception as e:
                print(f"Error loading table {tbl.display_name}: {e}")

        try:
            import pandas as pd
            self.scope["pd"] = pd
        except ImportError:
            pass

        try:
            import matplotlib
            matplotlib.use("Agg")
            import matplotlib.pyplot as plt
            self.scope["plt"] = plt
        except ImportError:
            pass

    def execute_cell(self, code: str) -> Dict[str, Any]:
        self.execution_count += 1
        t_start = time.time()
        stdout_capture = io.StringIO()
        plt = self.scope.get("plt")

        try:
            tree = ast.parse(code)
        except Exception:
            err_msg = traceback.format_exc()
            return {
                "success": False,
                "execution_count": self.execution_count,
                "stdout": "",
                "error": err_msg,
                "result_text": None,
                "table_preview": None,
                "plot_base64": None,
                "duration_ms": 0,
            }

        eval_result = None
        has_eval_result = False

        try:
            with contextlib.redirect_stdout(stdout_capture), contextlib.redirect_stderr(stdout_capture):
                if not tree.body:
                    pass
                else:
                    last_stmt = tree.body[-1]
                    if isinstance(last_stmt, ast.Expr):
                        # Statements before last expression
                        if len(tree.body) > 1:
                            stmts_code = compile(ast.Module(body=tree.body[:-1], type_ignores=[]), "<cell>", "exec")
                            exec(stmts_code, self.scope)

                        # Evaluate the final expression (exact Jupyter behavior!)
                        expr_code = compile(ast.Expression(body=last_stmt.value), "<cell>", "eval")
                        eval_result = eval(expr_code, self.scope)
                        has_eval_result = eval_result is not None
                    else:
                        all_code = compile(tree, "<cell>", "exec")
                        exec(all_code, self.scope)

            duration_ms = round((time.time() - t_start) * 1000, 1)

            # Check if eval_result is a DataFrame or plain expression output
            table_preview = None
            result_text = None

            if has_eval_result:
                is_polars = isinstance(eval_result, pl.DataFrame)
                is_pandas = False
                try:
                    import pandas as pd
                    if isinstance(eval_result, pd.DataFrame):
                        is_pandas = True
                except ImportError:
                    pass

                if is_polars or is_pandas:
                    target_df = eval_result if is_polars else pl.from_pandas(eval_result)
                    preview_cols = target_df.columns
                    preview_rows = target_df.head(15).to_dicts()
                    cleaned_rows = [
                        [str(row[col]) if isinstance(row[col], (bytes, complex)) else row[col] for col in preview_cols]
                        for row in preview_rows
                    ]

                    # Find variable name in scope if bound
                    var_name = "df_result"
                    for k, v in self.scope.items():
                        if v is eval_result and not k.startswith("_"):
                            var_name = k
                            break

                    table_preview = {
                        "var_name": var_name,
                        "columns": preview_cols,
                        "rows": cleaned_rows,
                        "row_count": target_df.shape[0],
                    }
                else:
                    result_text = repr(eval_result)

            # Check for Matplotlib plots
            plot_b64 = None
            if plt and plt.get_fignums():
                buf = io.BytesIO()
                plt.savefig(buf, format="png", bbox_inches="tight", dpi=100)
                buf.seek(0)
                plot_b64 = base64.b64encode(buf.read()).decode("utf-8")
                plt.close("all")

            return {
                "success": True,
                "execution_count": self.execution_count,
                "stdout": stdout_capture.getvalue(),
                "error": None,
                "result_text": result_text,
                "table_preview": table_preview,
                "plot_base64": plot_b64,
                "duration_ms": duration_ms,
            }

        except Exception:
            err_msg = traceback.format_exc()
            duration_ms = round((time.time() - t_start) * 1000, 1)
            return {
                "success": False,
                "execution_count": self.execution_count,
                "stdout": stdout_capture.getvalue(),
                "error": err_msg,
                "result_text": None,
                "table_preview": None,
                "plot_base64": None,
                "duration_ms": duration_ms,
            }

# Session Registry (keyed by dashboard_id)
_sessions: Dict[str, NotebookKernelSession] = {}

def get_kernel_session(dashboard_id: str) -> NotebookKernelSession:
    if dashboard_id not in _sessions:
        _sessions[dashboard_id] = NotebookKernelSession(dashboard_id)
    return _sessions[dashboard_id]

def restart_kernel_session(dashboard_id: str) -> NotebookKernelSession:
    session = get_kernel_session(dashboard_id)
    session.reset()
    return session

def get_notebook_path(dashboard_id: str) -> str:
    dash_dir = get_dashboard_dir(dashboard_id)
    return os.path.join(dash_dir, "notebook.json")

def load_notebook(dashboard_id: str) -> Dict[str, Any]:
    path = get_notebook_path(dashboard_id)
    if os.path.exists(path):
        try:
            with open(path, "r") as f:
                return json.load(f)
        except Exception:
            pass

    # Default starter notebook with realistic cells
    return {
        "cells": [
            {
                "id": "cell_1",
                "cell_type": "markdown",
                "source": "### Exploratory Data Analysis & Transformation\nExplore raw dashboard tables with **Polars**, inspect distributions, and export curated datasets as **Derived Models**.",
                "outputs": [],
                "execution_count": None,
            },
            {
                "id": "cell_2",
                "cell_type": "code",
                "source": "# Inspect pre-loaded dataset dimensions\nprint(\"Primary DataFrame Shape:\", df.shape)\nprint(\"Columns:\", df.columns)",
                "outputs": [],
                "execution_count": None,
            },
            {
                "id": "cell_3",
                "cell_type": "code",
                "source": "# Example: evaluate an expression to view data\ndf.head(5)",
                "outputs": [],
                "execution_count": None,
            },
        ]
    }

def save_notebook(dashboard_id: str, data: Dict[str, Any]):
    path = get_notebook_path(dashboard_id)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)

def _persist_dataframe(
    dashboard_id: str,
    table_name: str,
    target_df: Any,
    register_in_session: bool = True,
) -> TableOut:
    if target_df is None:
        raise ValueError(f"No DataFrame was produced for table '{table_name}'.")

    if not isinstance(target_df, pl.DataFrame):
        try:
            import pandas as pd
            if isinstance(target_df, pd.DataFrame):
                target_df = pl.from_pandas(target_df)
            else:
                raise ValueError("Result is not a Polars or Pandas DataFrame.")
        except ImportError:
            raise ValueError("Result is not a Polars DataFrame.")

    # Save to Parquet
    dash_dir = get_dashboard_dir(dashboard_id)
    table_id = f"tbl_d_{uuid.uuid4().hex[:8]}"
    parquet_path = os.path.join(dash_dir, f"{table_id}.parquet")
    target_df.write_parquet(parquet_path, compression="zstd")

    # Profile & record in SQLite
    columns = profile_dataframe(target_df)
    row_count = target_df.shape[0]

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO dashboard_tables (
            id, dashboard_id, display_name, table_type, file_path, row_count, columns_json,
            origin, role, last_refreshed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'notebook', 'data', CURRENT_TIMESTAMP)
    """, (
        table_id,
        dashboard_id,
        table_name,
        "derived_python",
        parquet_path,
        row_count,
        json.dumps([c.model_dump() for c in columns])
    ))
    conn.commit()
    conn.close()

    if register_in_session:
        try:
            get_kernel_session(dashboard_id).scope[table_name] = target_df
        except Exception:
            pass

    return TableOut(
        id=table_id,
        dashboard_id=dashboard_id,
        display_name=table_name,
        table_type="derived_python",
        file_path=parquet_path,
        row_count=row_count,
        columns=columns,
        created_at=str(pl.datetime(2026, 1, 1)),
    )

def materialize_derived_table_from_session(
    dashboard_id: str,
    table_name: str,
    dataframe_var: str
) -> TableOut:
    session = get_kernel_session(dashboard_id)
    target_df = session.scope.get(dataframe_var)

    if target_df is None:
        raise ValueError(f"DataFrame variable '{dataframe_var}' not found in active notebook kernel.")

    return _persist_dataframe(dashboard_id, table_name, target_df, register_in_session=True)

def materialize_derived_table_from_code(
    dashboard_id: str,
    table_name: str,
    dataframe_var: str,
    code: str,
) -> TableOut:
    """Re-execute a cell's code in a fresh scope so saving survives a lost kernel session."""
    session = NotebookKernelSession(dashboard_id)
    stdout = io.StringIO()
    try:
        with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stdout):
            tree = ast.parse(code)
            if tree.body and isinstance(tree.body[-1], ast.Expr):
                if len(tree.body) > 1:
                    exec(compile(ast.Module(body=tree.body[:-1], type_ignores=[]), "<cell>", "exec"), session.scope)
                last_value = eval(compile(ast.Expression(body=tree.body[-1].value), "<cell>", "eval"), session.scope)
            else:
                exec(compile(tree, "<cell>", "exec"), session.scope)
                last_value = None
    except Exception as exc:
        raise ValueError(f"Cell code failed: {exc}") from exc
    finally:
        plt = session.scope.get("plt")
        if plt:
            try:
                plt.close("all")
            except Exception:
                pass

    target_df = session.scope.get(dataframe_var)
    if target_df is None and last_value is not None and not isinstance(last_value, (int, float, str, bool)):
        target_df = last_value
    if target_df is None:
        raise ValueError(
            f"Cell code ran, but no variable named '{dataframe_var}' was produced. "
            "Assign the DataFrame to a variable before saving."
        )

    return _persist_dataframe(dashboard_id, table_name, target_df, register_in_session=True)
