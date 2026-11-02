import os
import io
import sys
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
    PythonExecuteResponse,
    ColumnMetadata,
    TableOut,
)
from .storage import list_dashboard_tables, profile_dataframe, get_dashboard_dir

def execute_python_sandbox(dashboard_id: str, code: str) -> PythonExecuteResponse:
    # 1. Load tables for this dashboard
    tables = list_dashboard_tables(dashboard_id)
    exec_scope: Dict[str, Any] = {
        "pl": pl,
    }

    # Pre-inject tables
    primary_df = None
    for tbl in tables:
        try:
            loaded_df = pl.read_parquet(tbl.file_path)
            # Safe variable name
            var_name = "".join(c if c.isalnum() else "_" for c in tbl.display_name).lower()
            if var_name.isidentifier():
                exec_scope[var_name] = loaded_df
            if primary_df is None:
                primary_df = loaded_df
                exec_scope["df"] = loaded_df
        except Exception as e:
            print(f"Error loading table {tbl.display_name}: {e}")

    # Try importing optional common EDA tools
    try:
        import pandas as pd
        exec_scope["pd"] = pd
    except ImportError:
        pass

    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        exec_scope["plt"] = plt
    except ImportError:
        plt = None

    stdout_capture = io.StringIO()
    detected_dfs: List[str] = []
    plot_b64: Optional[str] = None
    table_preview: Optional[Dict[str, Any]] = None

    try:
        with contextlib.redirect_stdout(stdout_capture), contextlib.redirect_stderr(stdout_capture):
            exec(code, exec_scope)

        # Inspect namespace for created DataFrames
        for k, v in exec_scope.items():
            if k.startswith("_") or k in ["pl", "pd", "plt"]:
                continue
            is_polars = isinstance(v, pl.DataFrame)
            is_pandas = False
            try:
                import pandas as pd
                if isinstance(v, pd.DataFrame):
                    is_pandas = True
            except ImportError:
                pass

            if is_polars or is_pandas:
                detected_dfs.append(k)

        # Pick the most recently created or modified DataFrame for preview
        preview_var = None
        for candidate in ["df_summary", "df_result", "result", "df_out", "df_new"]:
            if candidate in detected_dfs:
                preview_var = candidate
                break
        if not preview_var and detected_dfs:
            # Pick first non-'df' dataframe, or 'df'
            preview_var = [d for d in detected_dfs if d != "df"][0] if len(detected_dfs) > 1 else detected_dfs[0]

        if preview_var:
            target = exec_scope[preview_var]
            if not isinstance(target, pl.DataFrame):
                target = pl.from_pandas(target)

            preview_cols = target.columns
            preview_rows = target.head(15).to_dicts()
            # Clean values for JSON serialization
            cleaned_rows = [
                [str(row[col]) if isinstance(row[col], (bytes, complex)) else row[col] for col in preview_cols]
                for row in preview_rows
            ]

            table_preview = {
                "var_name": preview_var,
                "columns": preview_cols,
                "rows": cleaned_rows,
                "row_count": target.shape[0],
            }

        # Check for Matplotlib plots
        if plt and plt.get_fignums():
            buf = io.BytesIO()
            plt.savefig(buf, format="png", bbox_inches="tight", dpi=100)
            buf.seek(0)
            plot_b64 = base64.b64encode(buf.read()).decode("utf-8")
            plt.close("all")

        return PythonExecuteResponse(
            success=True,
            stdout=stdout_capture.getvalue(),
            table_preview=table_preview,
            plot_base64=plot_b64,
            detected_dataframes=detected_dfs,
        )

    except Exception as e:
        err_msg = traceback.format_exc()
        return PythonExecuteResponse(
            success=False,
            stdout=stdout_capture.getvalue(),
            error=err_msg,
            detected_dataframes=[],
        )

def save_derived_table_from_sandbox(
    dashboard_id: str,
    table_name: str,
    dataframe_var: str,
    code: Optional[str] = None
) -> TableOut:
    # Execute code to get target DataFrame
    exec_res = execute_python_sandbox(dashboard_id, code or f"{dataframe_var}")
    if not exec_res.success:
        raise ValueError(f"Failed to execute code: {exec_res.error}")

    # Re-run in clean environment to grab the actual object
    tables = list_dashboard_tables(dashboard_id)
    exec_scope: Dict[str, Any] = {"pl": pl}
    for tbl in tables:
        var_name = "".join(c if c.isalnum() else "_" for c in tbl.display_name).lower()
        if var_name.isidentifier():
            exec_scope[var_name] = pl.read_parquet(tbl.file_path)
    if tables:
        exec_scope["df"] = pl.read_parquet(tables[0].file_path)

    exec(code or f"target = {dataframe_var}", exec_scope)
    target_df = exec_scope.get(dataframe_var)
    if target_df is None:
        target_df = exec_scope.get("target")

    if target_df is None:
        raise ValueError(f"DataFrame variable '{dataframe_var}' not found in execution scope.")

    if not isinstance(target_df, pl.DataFrame):
        target_df = pl.from_pandas(target_df)

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
            id, dashboard_id, display_name, table_type, file_path, row_count, columns_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
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
