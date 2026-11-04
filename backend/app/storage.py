import os
import re
import time
import uuid
import json
from dataclasses import dataclass
from typing import List, Dict, Any, Tuple, Optional
import polars as pl
from .config import DASHBOARDS_DATA_DIR, UPLOADS_DIR
from .database import get_connection
from .schemas import ColumnMetadata, TableOut

def get_dashboard_dir(dashboard_id: str) -> str:
    path = os.path.join(DASHBOARDS_DATA_DIR, dashboard_id)
    os.makedirs(path, exist_ok=True)
    return path

def profile_dataframe(df: pl.DataFrame) -> List[ColumnMetadata]:
    columns: List[ColumnMetadata] = []

    for col in df.columns:
        dtype = df[col].dtype
        dtype_str = str(dtype)

        # Detect semantic type
        if dtype.is_numeric():
            sem_type = "measure"
        elif dtype.is_temporal():
            sem_type = "date"
        elif dtype == pl.Boolean:
            sem_type = "dimension"
        else:
            # Check if strings are date-formatted
            sample_non_null = df[col].drop_nulls().head(10).to_list()
            is_date = False
            if sample_non_null and len(str(sample_non_null[0])) >= 8:
                try:
                    df.select(pl.col(col).str.to_date(strict=False))
                    is_date = True
                except Exception:
                    is_date = False
            sem_type = "date" if is_date else "dimension"

        # Unique & null counts
        null_cnt = df[col].null_count()
        n_unique = df[col].n_unique()

        # Samples
        samples = df[col].drop_nulls().head(5).to_list()
        # Convert non-serializable objects to string
        clean_samples = [str(s) if not isinstance(s, (int, float, str, bool)) else s for s in samples]

        columns.append(ColumnMetadata(
            name=col,
            data_type=dtype_str,
            semantic_type=sem_type,
            sample_values=clean_samples,
            unique_count=n_unique,
            null_count=null_cnt,
        ))

    return columns

@dataclass
class IngestResult:
    tables: List[TableOut]
    skipped: List[str]


EXCEL_EXTENSIONS = {".xlsx", ".xls", ".xlsb", ".ods"}
TEXT_EXTENSIONS = {".csv", ".tsv", ".txt"}
PREVIEW_ROW_LIMIT = 15
UPLOAD_TTL_SECONDS = 30 * 60


def _clean_currency_columns(df: pl.DataFrame) -> pl.DataFrame:
    for col in df.columns:
        if df[col].dtype == pl.String:
            sample = df[col].drop_nulls().head(5).to_list()
            if sample and all(isinstance(x, str) and (x.startswith("$") or (x.startswith("-$"))) for x in sample):
                try:
                    df = df.with_columns(
                        pl.col(col).str.replace_all(r"[\$,]", "").cast(pl.Float64, strict=False)
                    )
                except Exception:
                    pass
    return df


def _persist_table(dashboard_id: str, dash_dir: str, display_name: str, df: pl.DataFrame) -> TableOut:
    table_id = f"tbl_{uuid.uuid4().hex[:8]}"
    df = _clean_currency_columns(df)

    parquet_path = os.path.join(dash_dir, f"{table_id}.parquet")
    df.write_parquet(parquet_path, compression="zstd")

    columns = profile_dataframe(df)
    row_count = df.shape[0]

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO dashboard_tables (
            id, dashboard_id, display_name, table_type, file_path, row_count, columns_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        table_id,
        dashboard_id,
        display_name,
        "raw_upload",
        parquet_path,
        row_count,
        json.dumps([c.model_dump() for c in columns])
    ))
    conn.commit()
    conn.close()

    return TableOut(
        id=table_id,
        dashboard_id=dashboard_id,
        display_name=display_name,
        table_type="raw_upload",
        file_path=parquet_path,
        row_count=row_count,
        columns=columns,
        created_at=str(pl.datetime(2026, 1, 1)),
    )


def _sanitize_filename(filename: str) -> str:
    return os.path.basename(filename).strip() or "data.csv"


def _json_cell(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def _preview_frame(df: pl.DataFrame) -> Dict[str, Any]:
    return {
        "columns": [str(col) for col in df.columns],
        "preview_rows": [
            [_json_cell(value) for value in row]
            for row in df.head(PREVIEW_ROW_LIMIT).rows()
        ],
        "is_empty": df.width == 0 or df.height == 0,
    }


def _excel_sheet_names(path: str, filename: str) -> List[str]:
    try:
        import fastexcel
    except ModuleNotFoundError as exc:
        raise ValueError(
            "Excel ingestion requires the optional 'fastexcel' package. "
            "Install backend dependencies with: pip install -r requirements.txt"
        ) from exc
    try:
        sheet_names = list(fastexcel.read_excel(path).sheet_names)
    except Exception as exc:
        raise ValueError(
            f"Could not parse '{filename}'. The file may be corrupt or use an "
            f"unsupported encoding. Details: {exc}"
        ) from exc
    if not sheet_names:
        raise ValueError(f"'{filename}' does not contain any worksheets.")
    return sheet_names


def _preview_excel(path: str, filename: str) -> List[Dict[str, Any]]:
    sheets: List[Dict[str, Any]] = []
    for name in _excel_sheet_names(path, filename):
        entry: Dict[str, Any] = {
            "name": name,
            "columns": [],
            "preview_rows": [],
            "is_empty": True,
            "error": None,
        }
        try:
            df = pl.read_excel(
                path,
                sheet_name=name,
                read_options={"n_rows": PREVIEW_ROW_LIMIT},
            )
            entry.update(_preview_frame(df))
        except Exception as exc:
            entry["error"] = str(exc)
        sheets.append(entry)
    return sheets


def _preview_text(path: str) -> List[Dict[str, Any]]:
    df = pl.read_csv(
        path,
        n_rows=PREVIEW_ROW_LIMIT,
        infer_schema_length=1000,
        ignore_errors=True,
    )
    if df.width == 0:
        raise ValueError("No columns were found in the uploaded file.")
    preview = _preview_frame(df)
    return [{"name": "CSV", **preview, "error": None}]


def _upload_meta_path(upload_id: str) -> str:
    return os.path.join(UPLOADS_DIR, f"{upload_id}.json")


def _cleanup_expired_uploads() -> None:
    now = time.time()
    try:
        entries = os.listdir(UPLOADS_DIR)
    except OSError:
        return
    for entry in entries:
        if not entry.endswith(".json"):
            continue
        meta_path = os.path.join(UPLOADS_DIR, entry)
        try:
            with open(meta_path, "r", encoding="utf-8") as fh:
                meta = json.load(fh)
        except Exception:
            continue
        if now - float(meta.get("created_at", 0)) <= UPLOAD_TTL_SECONDS:
            continue
        for candidate in (meta.get("path"), meta_path):
            if candidate and os.path.exists(candidate):
                try:
                    os.remove(candidate)
                except OSError:
                    pass


def _load_pending_upload(dashboard_id: str, upload_id: str) -> Dict[str, Any]:
    if not re.fullmatch(r"upl_[0-9a-f]{16,64}", upload_id or ""):
        raise ValueError("Invalid upload session id.")
    meta_path = _upload_meta_path(upload_id)
    if not os.path.exists(meta_path):
        raise ValueError("Upload session not found or expired. Please choose the file again.")
    try:
        with open(meta_path, "r", encoding="utf-8") as fh:
            meta = json.load(fh)
    except Exception as exc:
        raise ValueError("Upload session is unreadable. Please choose the file again.") from exc
    if meta.get("dashboard_id") != dashboard_id:
        raise ValueError("Upload session does not belong to this dashboard.")
    if time.time() - float(meta.get("created_at", 0)) > UPLOAD_TTL_SECONDS:
        _discard_pending_upload(meta)
        raise ValueError("Upload session expired. Please choose the file again.")
    if not os.path.exists(meta.get("path", "")):
        raise ValueError("Uploaded file is no longer available. Please choose it again.")
    return meta


def _discard_pending_upload(meta: Dict[str, Any]) -> None:
    for candidate in (meta.get("path"), _upload_meta_path(meta.get("upload_id", ""))):
        if candidate and os.path.exists(candidate):
            try:
                os.remove(candidate)
            except OSError:
                pass


def cancel_upload(dashboard_id: str, upload_id: str) -> None:
    meta = _load_pending_upload(dashboard_id, upload_id)
    _discard_pending_upload(meta)


def inspect_upload(dashboard_id: str, filename: str, content_bytes: bytes) -> Dict[str, Any]:
    _cleanup_expired_uploads()
    if not content_bytes:
        raise ValueError("The uploaded file is empty.")

    safe_filename = _sanitize_filename(filename)
    ext = os.path.splitext(safe_filename)[1].lower()
    if ext not in EXCEL_EXTENSIONS | TEXT_EXTENSIONS:
        raise ValueError(
            f"Unsupported file type '{ext or safe_filename}'. "
            "Upload a CSV, XLSX, XLS, XLSB, or ODS file."
        )

    upload_id = f"upl_{uuid.uuid4().hex}"
    upload_path = os.path.join(UPLOADS_DIR, f"{upload_id}_{safe_filename}")
    with open(upload_path, "wb") as f:
        f.write(content_bytes)

    try:
        if ext in EXCEL_EXTENSIONS:
            sheets = _preview_excel(upload_path, safe_filename)
        else:
            try:
                sheets = _preview_text(upload_path)
            except Exception as exc:
                raise ValueError(
                    f"Could not parse '{safe_filename}'. The file may be corrupt or "
                    f"use an unsupported encoding. Details: {exc}"
                ) from exc

        meta = {
            "upload_id": upload_id,
            "dashboard_id": dashboard_id,
            "filename": safe_filename,
            "path": upload_path,
            "created_at": time.time(),
        }
        with open(_upload_meta_path(upload_id), "w", encoding="utf-8") as fh:
            json.dump(meta, fh)
        return {
            "upload_id": upload_id,
            "filename": safe_filename,
            "is_excel": ext in EXCEL_EXTENSIONS,
            "sheets": sheets,
        }
    except Exception:
        if os.path.exists(upload_path):
            os.remove(upload_path)
        raise


def commit_upload(dashboard_id: str, upload_id: str, selected_sheets: List[str]) -> IngestResult:
    meta = _load_pending_upload(dashboard_id, upload_id)
    path = meta["path"]
    safe_filename = meta["filename"]
    stem = os.path.splitext(safe_filename)[0]
    ext = os.path.splitext(safe_filename)[1].lower()

    dash_dir = get_dashboard_dir(dashboard_id)
    persisted: List[TableOut] = []
    skipped: List[str] = []

    try:
        if ext in EXCEL_EXTENSIONS:
            all_names = _excel_sheet_names(path, safe_filename)
            if not selected_sheets:
                raise ValueError("Select at least one sheet to import.")
            selected = selected_sheets
            unknown = [name for name in selected if name not in all_names]
            if unknown:
                raise ValueError(
                    "Unknown sheet(s): " + ", ".join(f"'{name}'" for name in unknown)
                )

            frames: List[Tuple[str, pl.DataFrame]] = []
            for name in [name for name in all_names if name in selected]:
                try:
                    sheet_df = pl.read_excel(path, sheet_name=name)
                except Exception as exc:
                    skipped.append(f"Sheet '{name}' was skipped: {exc}")
                    continue
                if sheet_df.width == 0 or sheet_df.height == 0:
                    skipped.append(f"Sheet '{name}' was skipped: no data rows.")
                    continue
                frames.append((name, sheet_df))

            if not frames:
                raise ValueError(
                    "None of the selected sheets contain data. " + " ".join(skipped)
                )

            multi_sheet = len(all_names) > 1
            for name, sheet_df in frames:
                display_name = f"{stem} — {name}" if multi_sheet else stem
                persisted.append(
                    _persist_table(dashboard_id, dash_dir, display_name, sheet_df)
                )

        elif ext in TEXT_EXTENSIONS:
            df = pl.read_csv(path, infer_schema_length=10000, ignore_errors=True)
            if df.width == 0:
                raise ValueError("No columns were found in the uploaded file.")
            if df.height == 0:
                raise ValueError("The uploaded file has no data rows.")
            persisted.append(_persist_table(dashboard_id, dash_dir, stem, df))

        else:
            raise ValueError(
                f"Unsupported file type '{ext or safe_filename}'. "
                "Upload a CSV, XLSX, XLS, XLSB, or ODS file."
            )
    except Exception as exc:
        if isinstance(exc, ValueError):
            raise
        raise ValueError(
            f"Could not import '{safe_filename}'. Details: {exc}"
        ) from exc

    _discard_pending_upload(meta)
    return IngestResult(tables=persisted, skipped=skipped)


def _table_out_from_row(r: Any, cols_data: List[Dict[str, Any]]) -> TableOut:
    keys = set(r.keys())
    inputs: List[str] = []
    if "inputs_json" in keys and r["inputs_json"]:
        try:
            inputs = json.loads(r["inputs_json"])
        except Exception:
            inputs = []
    return TableOut(
        id=r["id"],
        dashboard_id=r["dashboard_id"],
        display_name=r["display_name"],
        table_type=r["table_type"],
        file_path=r["file_path"],
        row_count=r["row_count"],
        columns=[ColumnMetadata(**c) for c in cols_data],
        created_at=str(r["created_at"]),
        origin=(r["origin"] if "origin" in keys and r["origin"] else "upload"),
        role=(r["role"] if "role" in keys and r["role"] else "data"),
        script=(r["script"] if "script" in keys else None),
        inputs=inputs,
        last_refreshed_at=(str(r["last_refreshed_at"]) if "last_refreshed_at" in keys and r["last_refreshed_at"] else None),
        pos_x=(r["pos_x"] if "pos_x" in keys else None),
        pos_y=(r["pos_y"] if "pos_y" in keys else None),
        pos_w=(r["pos_w"] if "pos_w" in keys else None),
        pos_h=(r["pos_h"] if "pos_h" in keys else None),
    )

def list_dashboard_tables(dashboard_id: str) -> List[TableOut]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, dashboard_id, display_name, table_type, file_path, row_count, columns_json,
               origin, role, script, inputs_json, last_refreshed_at,
               pos_x, pos_y, pos_w, pos_h, created_at
        FROM dashboard_tables
        WHERE dashboard_id = ?
        ORDER BY created_at ASC
    """, (dashboard_id,))
    rows = cursor.fetchall()
    conn.close()

    tables: List[TableOut] = []
    for r in rows:
        cols_data = json.loads(r["columns_json"])
        tables.append(_table_out_from_row(r, cols_data))
    return tables

def get_table_by_id(table_id: str) -> Optional[TableOut]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, dashboard_id, display_name, table_type, file_path, row_count, columns_json,
               origin, role, script, inputs_json, last_refreshed_at,
               pos_x, pos_y, pos_w, pos_h, created_at
        FROM dashboard_tables
        WHERE id = ?
    """, (table_id,))
    r = cursor.fetchone()
    conn.close()
    if not r:
        return None

    cols_data = json.loads(r["columns_json"])
    return _table_out_from_row(r, cols_data)

# ----------------- Calculated Columns (Row-Level Expressions) -----------------
def _expr_from_ast(node: Any, columns: List[str]) -> pl.Expr:
    import ast

    if isinstance(node, ast.Expression):
        return _expr_from_ast(node.body, columns)

    if isinstance(node, ast.BinOp):
        left = _expr_from_ast(node.left, columns)
        right = _expr_from_ast(node.right, columns)
        if isinstance(node.op, ast.Add):
            return left + right
        if isinstance(node.op, ast.Sub):
            return left - right
        if isinstance(node.op, ast.Mult):
            return left * right
        if isinstance(node.op, ast.Div):
            return left / right
        if isinstance(node.op, ast.Mod):
            return left % right
        if isinstance(node.op, ast.Pow):
            return left.pow(right)
        raise ValueError("Unsupported operator. Use + - * / % **")

    if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.USub, ast.UAdd)):
        operand = _expr_from_ast(node.operand, columns)
        return -operand if isinstance(node.op, ast.USub) else operand

    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return pl.lit(node.value)

    if isinstance(node, ast.Name):
        if node.id not in columns:
            raise ValueError(f"Unknown column '{node.id}'. Available: {', '.join(columns)}")
        return pl.col(node.id)

    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
        fname = node.func.id
        if fname == "abs" and len(node.args) == 1:
            return _expr_from_ast(node.args[0], columns).abs()
        if fname == "round" and len(node.args) in (1, 2):
            base = _expr_from_ast(node.args[0], columns)
            decimals = 0
            if len(node.args) == 2:
                if not isinstance(node.args[1], ast.Constant) or not isinstance(node.args[1].value, int):
                    raise ValueError("round(x, n) requires an integer literal for n")
                decimals = node.args[1].value
            return base.round(decimals)
        raise ValueError("Unsupported function. Use abs(x) or round(x, n).")

    raise ValueError(
        "Unsupported expression. Use numbers, column names, parentheses, + - * / % **, abs(x), or round(x, n)."
    )

def add_calculated_column(
    dashboard_id: str,
    table_id: str,
    name: str,
    expression: str,
) -> TableOut:
    import ast

    table = get_table_by_id(table_id)
    if not table or table.dashboard_id != dashboard_id:
        raise ValueError("Table not found on this dashboard.")
    if not os.path.exists(table.file_path):
        raise ValueError("Table data file is missing.")

    column_name = name.strip()
    if not column_name.isidentifier():
        raise ValueError("Column name must be a valid identifier (letters, digits, underscore; cannot start with a digit).")

    df = pl.read_parquet(table.file_path)
    if column_name in df.columns:
        raise ValueError(f"Column '{column_name}' already exists on this table.")
    if not expression.strip():
        raise ValueError("Expression cannot be empty.")

    try:
        parsed = ast.parse(expression, mode="eval")
    except SyntaxError as exc:
        raise ValueError(f"Invalid expression syntax: {exc.msg}")

    expr = _expr_from_ast(parsed, df.columns)
    new_df = df.with_columns(expr.alias(column_name))

    # Persist in place (Parquet is our own storage format)
    new_df.write_parquet(table.file_path, compression="zstd")

    columns = profile_dataframe(new_df)
    row_count = new_df.shape[0]

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE dashboard_tables SET columns_json = ?, row_count = ? WHERE id = ? AND dashboard_id = ?",
        (json.dumps([c.model_dump() for c in columns]), row_count, table_id, dashboard_id),
    )
    conn.commit()
    conn.close()

    return TableOut(
        id=table.id,
        dashboard_id=dashboard_id,
        display_name=table.display_name,
        table_type=table.table_type,
        file_path=table.file_path,
        row_count=row_count,
        columns=columns,
        created_at=table.created_at,
    )

# ----------------- Aggregated Derived Tables (New Table from UI) -----------------
def _apply_filters(df: pl.DataFrame, filters: List[Dict[str, Any]]) -> pl.DataFrame:
    for f in filters or []:
        col = f.get("column")
        op = f.get("operator", "eq")
        val = f.get("value")
        if col not in df.columns or val is None or val == "":
            continue
        if op == "eq":
            df = df.filter(pl.col(col) == val)
        elif op == "in" and isinstance(val, list) and val:
            df = df.filter(pl.col(col).is_in(val))
        elif op in ("date_range", "between"):
            if isinstance(val, dict):
                start, end = val.get("start"), val.get("end")
                if start:
                    df = df.filter(pl.col(col).cast(pl.String) >= str(start))
                if end:
                    df = df.filter(pl.col(col).cast(pl.String) <= str(end))
            elif isinstance(val, (list, tuple)) and len(val) == 2:
                df = df.filter(
                    (pl.col(col).cast(pl.String) >= str(val[0]))
                    & (pl.col(col).cast(pl.String) <= str(val[1]))
                )
        elif op == "gt":
            df = df.filter(pl.col(col) > val)
        elif op == "gte":
            df = df.filter(pl.col(col) >= val)
        elif op == "lt":
            df = df.filter(pl.col(col) < val)
        elif op == "lte":
            df = df.filter(pl.col(col) <= val)
        elif op == "contains":
            df = df.filter(pl.col(col).cast(pl.String).str.to_lowercase().str.contains(str(val).lower()))
    return df

def create_aggregated_table(
    dashboard_id: str,
    base_table_id: str,
    display_name: str,
    dimensions: List[str],
    measures: List[Dict[str, Any]],
    filters: Optional[List[Dict[str, Any]]] = None,
) -> TableOut:
    base = get_table_by_id(base_table_id)
    if not base or base.dashboard_id != dashboard_id:
        raise ValueError("Base table not found on this dashboard.")
    if not os.path.exists(base.file_path):
        raise ValueError("Base table data file is missing.")
    if not display_name.strip():
        raise ValueError("Table name cannot be empty.")
    if not dimensions and not measures:
        raise ValueError("Choose at least one group-by dimension or one measure.")

    df = pl.read_parquet(base.file_path)
    df = _apply_filters(df, filters or [])

    group_cols = [d for d in dimensions if d in df.columns]
    agg_exprs: List[pl.Expr] = []
    aliases: List[str] = []

    for m in measures or []:
        col = m.get("column")
        agg = str(m.get("aggregation", "sum")).lower()
        if col not in df.columns:
            raise ValueError(f"Measure column '{col}' not found.")
        alias = m.get("alias") or f"{agg}_{col}"
        aliases.append(alias)
        if agg == "sum":
            agg_exprs.append(pl.col(col).sum().fill_null(0).alias(alias))
        elif agg == "avg":
            agg_exprs.append(pl.col(col).mean().fill_null(0).alias(alias))
        elif agg == "count":
            agg_exprs.append(pl.col(col).count().alias(alias))
        elif agg == "count_distinct":
            agg_exprs.append(pl.col(col).n_unique().alias(alias))
        elif agg == "min":
            agg_exprs.append(pl.col(col).min().alias(alias))
        elif agg == "max":
            agg_exprs.append(pl.col(col).max().alias(alias))
        else:
            raise ValueError(f"Unsupported aggregation '{agg}'.")

    if group_cols:
        if not agg_exprs:
            agg_exprs = [pl.len().alias("row_count")]
            aliases = ["row_count"]
        out_df = df.group_by(group_cols).agg(agg_exprs)
        if aliases:
            out_df = out_df.sort(aliases[0], descending=True)
    else:
        out_df = df.select(agg_exprs)

    dash_dir = get_dashboard_dir(dashboard_id)
    table_id = f"tbl_d_{uuid.uuid4().hex[:8]}"
    parquet_path = os.path.join(dash_dir, f"{table_id}.parquet")
    out_df.write_parquet(parquet_path, compression="zstd")

    columns = profile_dataframe(out_df)
    row_count = out_df.shape[0]

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO dashboard_tables (
            id, dashboard_id, display_name, table_type, file_path, row_count, columns_json,
            origin, role, last_refreshed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'derived', 'data', CURRENT_TIMESTAMP)
        """,
        (
            table_id,
            dashboard_id,
            display_name.strip(),
            "derived_model",
            parquet_path,
            row_count,
            json.dumps([c.model_dump() for c in columns]),
        ),
    )
    conn.commit()
    conn.close()

    return TableOut(
        id=table_id,
        dashboard_id=dashboard_id,
        display_name=display_name.strip(),
        table_type="derived_model",
        file_path=parquet_path,
        row_count=row_count,
        columns=columns,
        created_at=str(pl.datetime(2026, 1, 1)),
    )

# ----------------- Scripted & Empty Table Definitions -----------------
_TABLE_DTYPES = {
    "string": pl.Utf8,
    "integer": pl.Int64,
    "float": pl.Float64,
    "boolean": pl.Boolean,
    "date": pl.Date,
    "datetime": pl.Datetime,
}

def _validate_role(role: str) -> str:
    value = (role or "data").strip().lower()
    if value not in ("data", "helper"):
        raise ValueError("Role must be 'data' or 'helper'.")
    return value

def _sanitize_var_name(name: str) -> str:
    return "".join(c if c.isalnum() else "_" for c in name).lower()

def _build_script_scope(dashboard_id: str, exclude_table_id: Optional[str] = None) -> Dict[str, Any]:
    scope: Dict[str, Any] = {"pl": pl}
    try:
        import pandas as pd
        scope["pd"] = pd
    except ImportError:
        pass
    try:
        import numpy as np
        scope["np"] = np
    except ImportError:
        pass
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        scope["plt"] = plt
    except ImportError:
        pass

    first = True
    for table in list_dashboard_tables(dashboard_id):
        if exclude_table_id and table.id == exclude_table_id:
            continue
        if not os.path.exists(table.file_path):
            continue
        try:
            df = pl.read_parquet(table.file_path)
        except Exception as exc:
            raise ValueError(f"Could not read input table '{table.display_name}': {exc}")
        var_name = _sanitize_var_name(table.display_name)
        if var_name.isidentifier():
            scope[var_name] = df
        if first:
            scope["df"] = df
            first = False
    return scope

def _execute_table_script(dashboard_id: str, script: str, exclude_table_id: Optional[str] = None) -> pl.DataFrame:
    import ast
    import contextlib
    import io

    if not script or not script.strip():
        raise ValueError("Script cannot be empty.")

    scope = _build_script_scope(dashboard_id, exclude_table_id=exclude_table_id)
    stdout = io.StringIO()
    last_value: Any = None

    try:
        tree = ast.parse(script)
        with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stdout):
            if tree.body and isinstance(tree.body[-1], ast.Expr):
                if len(tree.body) > 1:
                    exec(compile(ast.Module(body=tree.body[:-1], type_ignores=[]), "<table>", "exec"), scope)
                last_value = eval(compile(ast.Expression(body=tree.body[-1].value), "<table>", "eval"), scope)
            else:
                exec(compile(tree, "<table>", "exec"), scope)
    except Exception as exc:
        raise ValueError(f"Script failed: {type(exc).__name__}: {exc}")
    finally:
        plt = scope.get("plt")
        if plt:
            try:
                plt.close("all")
            except Exception:
                pass

    result = scope.get("result", None)
    if result is None:
        result = last_value

    if result is None:
        raise ValueError(
            "Script produced no DataFrame. Assign your DataFrame to a variable named `result`, "
            "or end the script with a DataFrame expression."
        )

    if not isinstance(result, pl.DataFrame):
        try:
            import pandas as pd
            if isinstance(result, pd.DataFrame):
                result = pl.from_pandas(result)
            else:
                raise ValueError(
                    "Script result must be a Polars or pandas DataFrame "
                    "(numpy arrays need an explicit DataFrame wrapper)."
                )
        except ImportError:
            raise ValueError("Script result must be a Polars DataFrame.")

    return result

def _atomic_write_parquet(df: pl.DataFrame, path: str) -> None:
    tmp_path = f"{path}.tmp"
    df.write_parquet(tmp_path, compression="zstd")
    os.replace(tmp_path, path)

def _insert_defined_table(
    dashboard_id: str,
    display_name: str,
    table_type: str,
    origin: str,
    df: pl.DataFrame,
    role: str,
    script: Optional[str],
    inputs: Optional[List[str]],
) -> TableOut:
    dash_dir = get_dashboard_dir(dashboard_id)
    table_id = f"tbl_{uuid.uuid4().hex[:8]}"
    parquet_path = os.path.join(dash_dir, f"{table_id}.parquet")
    df.write_parquet(parquet_path, compression="zstd")

    columns = profile_dataframe(df)
    row_count = df.shape[0]

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO dashboard_tables (
            id, dashboard_id, display_name, table_type, file_path, row_count, columns_json,
            origin, role, script, inputs_json, last_refreshed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        """,
        (
            table_id,
            dashboard_id,
            display_name.strip(),
            table_type,
            parquet_path,
            row_count,
            json.dumps([c.model_dump() for c in columns]),
            origin,
            role,
            script,
            json.dumps(inputs or []),
        ),
    )
    conn.commit()
    conn.close()

    return TableOut(
        id=table_id,
        dashboard_id=dashboard_id,
        display_name=display_name.strip(),
        table_type=table_type,
        file_path=parquet_path,
        row_count=row_count,
        columns=columns,
        created_at=str(pl.datetime(2026, 1, 1)),
        origin=origin,
        role=role,
        script=script,
        inputs=inputs or [],
        last_refreshed_at="just now",
    )

def create_empty_table(
    dashboard_id: str,
    display_name: str,
    columns: List[Dict[str, str]],
    role: str = "data",
) -> TableOut:
    role = _validate_role(role)
    if not display_name or not display_name.strip():
        raise ValueError("Table name cannot be empty.")
    if not columns:
        raise ValueError("Provide at least one column definition.")

    schema: Dict[str, Any] = {}
    for col in columns:
        name = (col.get("name") or "").strip()
        dtype = (col.get("dtype") or "").strip().lower()
        if not name.isidentifier():
            raise ValueError(f"Invalid column name '{name}'. Use letters, digits, and underscores.")
        if name in schema:
            raise ValueError(f"Duplicate column '{name}'.")
        if dtype not in _TABLE_DTYPES:
            raise ValueError(f"Unsupported column type '{dtype}'.")
        schema[name] = _TABLE_DTYPES[dtype]

    df = pl.DataFrame(schema=schema)
    return _insert_defined_table(
        dashboard_id,
        display_name,
        table_type="manual",
        origin="manual",
        df=df,
        role=role,
        script=None,
        inputs=[],
    )

def create_python_table(
    dashboard_id: str,
    display_name: str,
    script: str,
    inputs: Optional[List[str]] = None,
    role: str = "data",
) -> TableOut:
    role = _validate_role(role)
    if not display_name or not display_name.strip():
        raise ValueError("Table name cannot be empty.")

    df = _execute_table_script(dashboard_id, script)
    return _insert_defined_table(
        dashboard_id,
        display_name,
        table_type="python_script",
        origin="python_script",
        df=df,
        role=role,
        script=script,
        inputs=inputs or [],
    )

def _update_table_definition(
    dashboard_id: str,
    table_id: str,
    df: pl.DataFrame,
    role: str,
    script: Optional[str],
    inputs: Optional[List[str]],
) -> TableOut:
    table = get_table_by_id(table_id)
    if not table or table.dashboard_id != dashboard_id:
        raise ValueError("Table not found on this dashboard.")

    _atomic_write_parquet(df, table.file_path)
    columns = profile_dataframe(df)
    row_count = df.shape[0]
    table_type = "python_script" if script else table.table_type
    origin = "python_script" if script else table.origin

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        UPDATE dashboard_tables
        SET row_count = ?, columns_json = ?, role = ?, script = ?, inputs_json = ?,
            table_type = ?, origin = ?, last_refreshed_at = CURRENT_TIMESTAMP
        WHERE id = ? AND dashboard_id = ?
        """,
        (
            row_count,
            json.dumps([c.model_dump() for c in columns]),
            role,
            script,
            json.dumps(inputs or []),
            table_type,
            origin,
            table_id,
            dashboard_id,
        ),
    )
    conn.commit()
    conn.close()

    return TableOut(
        id=table.id,
        dashboard_id=dashboard_id,
        display_name=table.display_name,
        table_type=table_type,
        file_path=table.file_path,
        row_count=row_count,
        columns=columns,
        created_at=table.created_at,
        origin=origin,
        role=role,
        script=script,
        inputs=inputs or [],
        last_refreshed_at="just now",
    )

def refresh_python_table(dashboard_id: str, table_id: str) -> TableOut:
    table = get_table_by_id(table_id)
    if not table or table.dashboard_id != dashboard_id:
        raise ValueError("Table not found on this dashboard.")
    if not table.script:
        raise ValueError("This table has no script. Add a script first, then refresh.")

    df = _execute_table_script(dashboard_id, table.script)
    return _update_table_definition(
        dashboard_id,
        table_id,
        df,
        role=table.role or "data",
        script=table.script,
        inputs=table.inputs,
    )

def update_table_script(
    dashboard_id: str,
    table_id: str,
    script: str,
    inputs: Optional[List[str]] = None,
    role: Optional[str] = None,
) -> TableOut:
    table = get_table_by_id(table_id)
    if not table or table.dashboard_id != dashboard_id:
        raise ValueError("Table not found on this dashboard.")

    next_role = _validate_role(role) if role else (table.role or "data")
    df = _execute_table_script(dashboard_id, script)
    return _update_table_definition(
        dashboard_id,
        table_id,
        df,
        role=next_role,
        script=script,
        inputs=inputs if inputs is not None else table.inputs,
    )


# ----------------- Model Canvas Layout -----------------
def update_model_layout(dashboard_id: str, items: List[Dict[str, int]]) -> int:
    conn = get_connection()
    cursor = conn.cursor()
    updated = 0
    for item in items:
        cursor.execute(
            """
            UPDATE dashboard_tables
            SET pos_x = ?, pos_y = ?, pos_w = ?, pos_h = ?
            WHERE id = ? AND dashboard_id = ?
            """,
            (
                int(item["x"]),
                int(item["y"]),
                int(item["w"]),
                int(item["h"]),
                item["table_id"],
                dashboard_id,
            ),
        )
        updated += cursor.rowcount
    conn.commit()
    conn.close()
    return updated

# ----------------- Row Browser (Data View) -----------------
def _json_safe_value(value: Any) -> Any:
    import datetime
    import math

    if value is None:
        return None
    if isinstance(value, (datetime.datetime, datetime.date, datetime.time)):
        return value.isoformat()
    if isinstance(value, (bytes, bytearray)):
        return value.decode("utf-8", errors="replace")
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None
        return value
    if isinstance(value, (list, tuple, dict)):
        return str(value)
    return value

def get_table_rows(
    dashboard_id: str,
    table_id: str,
    page: int = 1,
    page_size: int = 50,
    search: Optional[str] = None,
    sort_column: Optional[str] = None,
    sort_dir: str = "asc",
    column_filters: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    table = get_table_by_id(table_id)
    if not table or table.dashboard_id != dashboard_id:
        raise ValueError("Table not found on this dashboard.")
    if not os.path.exists(table.file_path):
        raise ValueError("Table data file is missing.")

    page = max(1, int(page))
    page_size = max(1, min(int(page_size), 500))
    direction = "desc" if str(sort_dir).lower() == "desc" else "asc"

    lf = pl.scan_parquet(table.file_path)
    columns = lf.collect_schema().names()

    if sort_column and sort_column not in columns:
        raise ValueError(f"Sort column '{sort_column}' does not exist on this table.")

    unfiltered_count = int(lf.select(pl.len()).collect().item())

    for column_filter in column_filters or []:
        filter_col = (column_filter or {}).get("column")
        filter_values = (column_filter or {}).get("values") or []
        if not filter_col:
            raise ValueError("Each column filter requires a 'column'.")
        if filter_col not in columns:
            raise ValueError(f"Filter column '{filter_col}' does not exist on this table.")
        if not isinstance(filter_values, list):
            raise ValueError(f"Filter values for '{filter_col}' must be a list.")
        if len(filter_values) == 0:
            continue
        lf = lf.filter(
            pl.col(filter_col).cast(pl.String).is_in([str(v) for v in filter_values])
        )

    search = (search or "").strip()
    if search:
        needle = search.lower()
        condition = None
        for col in columns:
            expr = (
                pl.col(col)
                .cast(pl.String)
                .str.to_lowercase()
                .str.contains(needle, literal=True)
                .fill_null(False)
            )
            condition = expr if condition is None else (condition | expr)
        lf = lf.filter(condition)

    has_filters = bool(search) or bool(column_filters)
    filtered_count = int(lf.select(pl.len()).collect().item()) if has_filters else unfiltered_count

    if sort_column:
        lf = lf.sort(sort_column, descending=(direction == "desc"), nulls_last=True)

    offset = (page - 1) * page_size
    rows_df = lf.slice(offset, page_size).collect()
    rows = [
        {key: _json_safe_value(val) for key, val in record.items()}
        for record in rows_df.to_dicts()
    ]

    total_pages = max(1, (filtered_count + page_size - 1) // page_size)

    return {
        "table_id": table.id,
        "columns": table.columns,
        "rows": rows,
        "total_count": filtered_count,
        "unfiltered_count": unfiltered_count,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "sort_column": sort_column,
        "sort_dir": direction,
        "search": search or None,
    }
