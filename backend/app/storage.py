import os
import uuid
import json
from typing import List, Dict, Any, Tuple, Optional
import polars as pl
from .config import DASHBOARDS_DATA_DIR
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

def ingest_file(dashboard_id: str, filename: str, content_bytes: bytes) -> TableOut:
    dash_dir = get_dashboard_dir(dashboard_id)
    table_id = f"tbl_{uuid.uuid4().hex[:8]}"
    raw_save_path = os.path.join(dash_dir, f"{table_id}_{filename}")

    # Save raw file
    with open(raw_save_path, "wb") as f:
        f.write(content_bytes)

    # Read with Polars
    ext = os.path.splitext(filename)[1].lower()
    if ext in [".xlsx", ".xls"]:
        df = pl.read_excel(raw_save_path)
    else:
        df = pl.read_csv(raw_save_path, infer_schema_length=10000, ignore_errors=True)

    # Clean currency columns if detected (e.g. "$14.50")
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

    # Save as Parquet
    parquet_path = os.path.join(dash_dir, f"{table_id}.parquet")
    df.write_parquet(parquet_path, compression="zstd")

    # Profile columns
    columns = profile_dataframe(df)
    row_count = df.shape[0]

    # Save metadata to SQLite
    display_name = os.path.splitext(filename)[0]
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
        created_at=str(pl.datetime(2026, 1, 1)), # placeholder or current timestamp
    )

def list_dashboard_tables(dashboard_id: str) -> List[TableOut]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, dashboard_id, display_name, table_type, file_path, row_count, columns_json, created_at
        FROM dashboard_tables
        WHERE dashboard_id = ?
        ORDER BY created_at ASC
    """, (dashboard_id,))
    rows = cursor.fetchall()
    conn.close()

    tables: List[TableOut] = []
    for r in rows:
        cols_data = json.loads(r["columns_json"])
        tables.append(TableOut(
            id=r["id"],
            dashboard_id=r["dashboard_id"],
            display_name=r["display_name"],
            table_type=r["table_type"],
            file_path=r["file_path"],
            row_count=r["row_count"],
            columns=[ColumnMetadata(**c) for c in cols_data],
            created_at=str(r["created_at"]),
        ))
    return tables

def get_table_by_id(table_id: str) -> Optional[TableOut]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, dashboard_id, display_name, table_type, file_path, row_count, columns_json, created_at
        FROM dashboard_tables
        WHERE id = ?
    """, (table_id,))
    r = cursor.fetchone()
    conn.close()
    if not r:
        return None

    cols_data = json.loads(r["columns_json"])
    return TableOut(
        id=r["id"],
        dashboard_id=r["dashboard_id"],
        display_name=r["display_name"],
        table_type=r["table_type"],
        file_path=r["file_path"],
        row_count=r["row_count"],
        columns=[ColumnMetadata(**c) for c in cols_data],
        created_at=str(r["created_at"]),
    )
