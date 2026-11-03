import os
import uuid
import json
import shutil
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .database import get_connection
from .schemas import (
    DashboardCreate,
    DashboardUpdate,
    DashboardOut,
    TableOut,
    RelationshipCreate,
    RelationshipOut,
    CardCreate,
    CardUpdate,
    CardOut,
    CardLayoutItem,
    FilterCreate,
    FilterOut,
    MetricCreate,
    MetricOut,
    QueryRequest,
    QueryResult,
    PythonExecuteRequest,
    PythonExecuteResponse,
    SaveDerivedTableRequest,
    ExecuteCellRequest,
    NotebookData,
    CalculatedColumnCreate,
    AggregatedTableCreate,
    EmptyTableCreate,
    PythonTableCreate,
    TableScriptUpdate,
    ModelLayoutItem,
    TableRowsResponse,
)
from .storage import (
    ingest_file,
    list_dashboard_tables,
    get_table_by_id,
    get_dashboard_dir,
    add_calculated_column,
    create_aggregated_table,
    create_empty_table,
    create_python_table,
    refresh_python_table,
    update_table_script,
    update_model_layout,
    get_table_rows,
)
from .sandbox import execute_python_sandbox, save_derived_table_from_sandbox
from .notebook_session import (
    get_kernel_session,
    restart_kernel_session,
    load_notebook,
    save_notebook,
    materialize_derived_table_from_session,
    materialize_derived_table_from_code,
)
from .query_engine import execute_card_query

app = FastAPI(
    title="LarperBI Backend Engine",
    description="Miniature Power BI / Metabase analytics engine with Python EDA lab and auto-modeling.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok", "service": "larper-bi-backend"}

# ----------------- Dashboard Endpoints -----------------
@app.get("/api/v1/dashboards", response_model=List[DashboardOut])
def list_dashboards():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT d.id, d.title, d.description, d.status, d.created_at, d.updated_at,
               COUNT(DISTINCT t.id) as table_count,
               COUNT(DISTINCT c.id) as card_count
        FROM dashboards d
        LEFT JOIN dashboard_tables t ON d.id = t.dashboard_id
        LEFT JOIN dashboard_cards c ON d.id = c.dashboard_id
        GROUP BY d.id
        ORDER BY d.created_at DESC
    """)
    rows = cursor.fetchall()
    conn.close()

    return [
        DashboardOut(
            id=r["id"],
            title=r["title"],
            description=r["description"],
            status=r["status"],
            created_at=str(r["created_at"]),
            updated_at=str(r["updated_at"]),
            table_count=r["table_count"],
            card_count=r["card_count"],
        )
        for r in rows
    ]

@app.post("/api/v1/dashboards", response_model=DashboardOut)
def create_dashboard(payload: DashboardCreate):
    dash_id = f"dash_{uuid.uuid4().hex[:8]}"
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO dashboards (id, title, description, status)
        VALUES (?, ?, ?, 'draft')
    """, (dash_id, payload.title, payload.description))
    conn.commit()
    conn.close()

    # Pre-create directory
    get_dashboard_dir(dash_id)

    return DashboardOut(
        id=dash_id,
        title=payload.title,
        description=payload.description,
        status="draft",
        created_at="just now",
        updated_at="just now",
        table_count=0,
        card_count=0,
    )

@app.get("/api/v1/dashboards/{id}")
def get_dashboard_detail(id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM dashboards WHERE id = ?", (id,))
    dash = cursor.fetchone()
    if not dash:
        conn.close()
        raise HTTPException(status_code=404, detail="Dashboard not found")

    # Fetch tables
    tables = list_dashboard_tables(id)

    # Fetch cards
    cursor.execute("SELECT * FROM dashboard_cards WHERE dashboard_id = ? ORDER BY created_at ASC", (id,))
    card_rows = cursor.fetchall()
    cards = []
    for c in card_rows:
        cards.append({
            "id": c["id"],
            "dashboard_id": c["dashboard_id"],
            "table_id": c["table_id"],
            "viz_type": c["viz_type"],
            "title": c["title"],
            "config": json.loads(c["config_json"]),
            "grid_layout": json.loads(c["grid_layout_json"]),
            "created_at": str(c["created_at"]),
        })

    # Fetch relationships
    cursor.execute("SELECT * FROM table_relationships WHERE dashboard_id = ?", (id,))
    rel_rows = cursor.fetchall()
    relationships = [dict(r) for r in rel_rows]

    # Fetch dashboard filters
    cursor.execute("SELECT * FROM dashboard_filters WHERE dashboard_id = ? ORDER BY created_at ASC", (id,))
    filter_rows = cursor.fetchall()
    filters = []
    for f in filter_rows:
        filters.append({
            "id": f["id"],
            "dashboard_id": f["dashboard_id"],
            "name": f["name"],
            "filter_type": f["filter_type"],
            "table_id": f["table_id"],
            "column_name": f["column_name"],
            "default_value": json.loads(f["default_value_json"]) if f["default_value_json"] else None,
        })

    # Fetch dashboard metrics
    cursor.execute("SELECT * FROM dashboard_metrics WHERE dashboard_id = ? ORDER BY created_at ASC", (id,))
    metric_rows = cursor.fetchall()
    metrics = []
    for m in metric_rows:
        metrics.append({
            "id": m["id"],
            "dashboard_id": m["dashboard_id"],
            "table_id": m["table_id"],
            "name": m["name"],
            "description": m["description"],
            "formula_type": m["formula_type"],
            "definition": json.loads(m["definition_json"]),
            "format_type": m["format_type"],
            "created_at": str(m["created_at"]),
        })
    conn.close()

    return {
        "dashboard": dict(dash),
        "tables": tables,
        "cards": cards,
        "relationships": relationships,
        "filters": filters,
        "metrics": metrics,
    }

@app.put("/api/v1/dashboards/{id}")
def update_dashboard(id: str, payload: DashboardUpdate):
    conn = get_connection()
    cursor = conn.cursor()
    updates = []
    vals = []
    if payload.title is not None:
        updates.append("title = ?")
        vals.append(payload.title)
    if payload.description is not None:
        updates.append("description = ?")
        vals.append(payload.description)
    if payload.status is not None:
        updates.append("status = ?")
        vals.append(payload.status)

    if updates:
        vals.append(id)
        cursor.execute(f"UPDATE dashboards SET {', '.join(updates)} WHERE id = ?", tuple(vals))
        conn.commit()
    conn.close()
    return {"status": "ok"}

@app.delete("/api/v1/dashboards/{id}")
def delete_dashboard(id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM dashboards WHERE id = ?", (id,))
    conn.commit()
    conn.close()

    # Clean storage
    dir_path = get_dashboard_dir(id)
    if os.path.exists(dir_path):
        shutil.rmtree(dir_path, ignore_errors=True)

    return {"status": "deleted", "id": id}

# ----------------- Table Ingestion Endpoints -----------------
@app.post("/api/v1/dashboards/{id}/upload", response_model=TableOut)
async def upload_table(id: str, file: UploadFile = File(...)):
    contents = await file.read()
    table = ingest_file(id, file.filename or "data.csv", contents)
    return table

@app.get("/api/v1/dashboards/{id}/tables", response_model=List[TableOut])
def get_tables(id: str):
    return list_dashboard_tables(id)

@app.delete("/api/v1/dashboards/{id}/tables/{table_id}")
def delete_table(id: str, table_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT file_path FROM dashboard_tables WHERE id = ? AND dashboard_id = ?", (table_id, id))
    row = cursor.fetchone()
    if row:
        path = row["file_path"]
        if os.path.exists(path):
            os.remove(path)
        cursor.execute("DELETE FROM dashboard_tables WHERE id = ?", (table_id,))
        cursor.execute("DELETE FROM dashboard_cards WHERE table_id = ?", (table_id,))
        cursor.execute("DELETE FROM table_relationships WHERE from_table_id = ? OR to_table_id = ?", (table_id, table_id))
        conn.commit()
    conn.close()
    return {"status": "deleted", "table_id": table_id}

# ----------------- Relationship Endpoints -----------------
@app.post("/api/v1/dashboards/{id}/relationships", response_model=RelationshipOut)
def create_relationship(id: str, payload: RelationshipCreate):
    from_tbl = get_table_by_id(payload.from_table_id)
    to_tbl = get_table_by_id(payload.to_table_id)
    if not from_tbl or from_tbl.dashboard_id != id:
        raise HTTPException(status_code=400, detail="Source table not found on this dashboard.")
    if not to_tbl or to_tbl.dashboard_id != id:
        raise HTTPException(status_code=400, detail="Target table not found on this dashboard.")
    if payload.from_table_id == payload.to_table_id:
        raise HTTPException(status_code=400, detail="A table cannot be linked to itself.")

    if payload.from_column not in [c.name for c in from_tbl.columns]:
        raise HTTPException(
            status_code=400,
            detail=f"Column '{payload.from_column}' does not exist on '{from_tbl.display_name}'.",
        )
    if payload.to_column not in [c.name for c in to_tbl.columns]:
        raise HTTPException(
            status_code=400,
            detail=f"Column '{payload.to_column}' does not exist on '{to_tbl.display_name}'.",
        )

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT id FROM table_relationships
        WHERE dashboard_id = ?
          AND from_table_id = ? AND from_column = ?
          AND to_table_id = ? AND to_column = ?
        """,
        (
            id,
            payload.from_table_id,
            payload.from_column,
            payload.to_table_id,
            payload.to_column,
        ),
    )
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="This relationship already exists.")

    rel_id = f"rel_{uuid.uuid4().hex[:8]}"
    cursor.execute("""
        INSERT INTO table_relationships (
            id, dashboard_id, from_table_id, from_column, to_table_id, to_column, cardinality
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        rel_id, id, payload.from_table_id, payload.from_column,
        payload.to_table_id, payload.to_column, payload.cardinality
    ))
    conn.commit()
    conn.close()

    return RelationshipOut(
        id=rel_id,
        dashboard_id=id,
        from_table_id=payload.from_table_id,
        from_column=payload.from_column,
        to_table_id=payload.to_table_id,
        to_column=payload.to_column,
        cardinality=payload.cardinality,
        created_at="just now",
    )

@app.delete("/api/v1/dashboards/{id}/relationships/{rel_id}")
def delete_relationship(id: str, rel_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM table_relationships WHERE id = ? AND dashboard_id = ?", (rel_id, id))
    conn.commit()
    conn.close()
    return {"status": "deleted", "rel_id": rel_id}
# ----------------- Dashboard Filter Endpoints -----------------
@app.get("/api/v1/dashboards/{id}/filters", response_model=List[FilterOut])
def list_filters(id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM dashboard_filters WHERE dashboard_id = ? ORDER BY created_at ASC", (id,))
    rows = cursor.fetchall()
    conn.close()
    return [
        FilterOut(
            id=r["id"],
            dashboard_id=r["dashboard_id"],
            name=r["name"],
            filter_type=r["filter_type"],
            table_id=r["table_id"],
            column_name=r["column_name"],
            default_value=json.loads(r["default_value_json"]) if r["default_value_json"] else None,
            created_at=str(r["created_at"]),
        )
        for r in rows
    ]

@app.post("/api/v1/dashboards/{id}/filters", response_model=FilterOut)
def create_filter(id: str, payload: FilterCreate):
    filter_id = f"filt_{uuid.uuid4().hex[:8]}"
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO dashboard_filters (
            id, dashboard_id, name, filter_type, table_id, column_name, default_value_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        filter_id, id, payload.name, payload.filter_type, payload.table_id,
        payload.column_name, json.dumps(payload.default_value) if payload.default_value is not None else None
    ))
    conn.commit()
    conn.close()

    return FilterOut(
        id=filter_id,
        dashboard_id=id,
        name=payload.name,
        filter_type=payload.filter_type,
        table_id=payload.table_id,
        column_name=payload.column_name,
        default_value=payload.default_value,
        created_at="just now",
    )

@app.delete("/api/v1/dashboards/{id}/filters/{filter_id}")
def delete_filter(id: str, filter_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM dashboard_filters WHERE id = ? AND dashboard_id = ?", (filter_id, id))
    conn.commit()
    conn.close()
    return {"status": "deleted", "filter_id": filter_id}

@app.get("/api/v1/dashboards/{id}/tables/{table_id}/columns/{column_name}/distinct")
def get_distinct_column_values(id: str, table_id: str, column_name: str):
    table = get_table_by_id(table_id)
    if not table or not os.path.exists(table.file_path):
        raise HTTPException(status_code=404, detail="Table not found")
    import polars as pl
    df = pl.read_parquet(table.file_path)
    if column_name not in df.columns:
        raise HTTPException(status_code=400, detail=f"Column {column_name} not found in table")
    
    distinct_vals = (
        df.select(pl.col(column_name).drop_nulls().unique())
        .sort(column_name)
        .head(100)
        .to_series()
        .to_list()
    )
    return [str(v) if not isinstance(v, (int, float, str, bool)) else v for v in distinct_vals]
# ----------------- Dashboard Metric / Measure Endpoints -----------------
@app.get("/api/v1/dashboards/{id}/metrics", response_model=List[MetricOut])
def list_metrics(id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM dashboard_metrics WHERE dashboard_id = ? ORDER BY created_at ASC", (id,))
    rows = cursor.fetchall()
    conn.close()
    return [
        MetricOut(
            id=r["id"],
            dashboard_id=r["dashboard_id"],
            table_id=r["table_id"],
            name=r["name"],
            description=r["description"],
            formula_type=r["formula_type"],
            definition=json.loads(r["definition_json"]),
            format_type=r["format_type"],
            created_at=str(r["created_at"]),
        )
        for r in rows
    ]

@app.post("/api/v1/dashboards/{id}/metrics", response_model=MetricOut)
def create_metric(id: str, payload: MetricCreate):
    metric_id = f"metric_{uuid.uuid4().hex[:8]}"
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO dashboard_metrics (
            id, dashboard_id, table_id, name, description, formula_type, definition_json, format_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        metric_id, id, payload.table_id, payload.name, payload.description,
        payload.formula_type, json.dumps(payload.definition), payload.format_type
    ))
    conn.commit()
    conn.close()

    return MetricOut(
        id=metric_id,
        dashboard_id=id,
        table_id=payload.table_id,
        name=payload.name,
        description=payload.description,
        formula_type=payload.formula_type,
        definition=payload.definition,
        format_type=payload.format_type,
        created_at="just now",
    )

@app.delete("/api/v1/dashboards/{id}/metrics/{metric_id}")
def delete_metric(id: str, metric_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM dashboard_metrics WHERE id = ? AND dashboard_id = ?", (metric_id, id))
    conn.commit()
    conn.close()
    return {"status": "deleted", "metric_id": metric_id}


# ----------------- Data Modeling: New Table / New Column -----------------
@app.post("/api/v1/dashboards/{id}/tables/{table_id}/calculated-column", response_model=TableOut)
def create_calculated_column(id: str, table_id: str, payload: CalculatedColumnCreate):
    try:
        return add_calculated_column(id, table_id, payload.name, payload.expression)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/v1/dashboards/{id}/derived-tables/aggregate", response_model=TableOut)
def create_aggregated_derived_table(id: str, payload: AggregatedTableCreate):
    try:
        return create_aggregated_table(
            id,
            payload.base_table_id,
            payload.display_name,
            payload.dimensions,
            [m.model_dump() for m in payload.measures],
            payload.filters,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# ----------------- Data Modeling: Empty / Scripted Tables -----------------
@app.post("/api/v1/dashboards/{id}/tables/empty", response_model=TableOut)
def create_empty_dashboard_table(id: str, payload: EmptyTableCreate):
    try:
        return create_empty_table(
            id,
            payload.display_name,
            [c.model_dump() for c in payload.columns],
            payload.role,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/v1/dashboards/{id}/tables/python", response_model=TableOut)
def create_python_dashboard_table(id: str, payload: PythonTableCreate):
    try:
        return create_python_table(
            id,
            payload.display_name,
            payload.script,
            payload.inputs,
            payload.role,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/v1/dashboards/{id}/tables/{table_id}/refresh", response_model=TableOut)
def refresh_dashboard_table(id: str, table_id: str):
    try:
        return refresh_python_table(id, table_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.put("/api/v1/dashboards/{id}/tables/{table_id}/script", response_model=TableOut)
def set_dashboard_table_script(id: str, table_id: str, payload: TableScriptUpdate):
    try:
        return update_table_script(
            id,
            table_id,
            payload.script,
            payload.inputs,
            payload.role,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.put("/api/v1/dashboards/{id}/model-layout")
def save_model_layout(id: str, payload: List[ModelLayoutItem]):
    updated = update_model_layout(id, [item.model_dump() for item in payload])
    return {"status": "ok", "updated": updated}


@app.get("/api/v1/dashboards/{id}/tables/{table_id}/rows", response_model=TableRowsResponse)
def read_table_rows(
    id: str,
    table_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    search: Optional[str] = Query(None),
    sort_column: Optional[str] = Query(None),
    sort_dir: str = Query("asc"),
    filters: Optional[str] = Query(None, description="JSON array: [{column, values}]"),
):
    column_filters = None
    if filters:
        try:
            column_filters = json.loads(filters)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid filters JSON.")
        if not isinstance(column_filters, list):
            raise HTTPException(status_code=400, detail="Filters must be a JSON array.")
    try:
        return get_table_rows(
            id,
            table_id,
            page=page,
            page_size=page_size,
            search=search,
            sort_column=sort_column,
            sort_dir=sort_dir,
            column_filters=column_filters,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

# ----------------- Card Management Endpoints -----------------
@app.post("/api/v1/dashboards/{id}/cards")
def create_card(id: str, payload: CardCreate):
    card_id = f"card_{uuid.uuid4().hex[:8]}"
    grid = payload.grid_layout or {"x": 0, "y": 0, "w": 6, "h": 4}
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO dashboard_cards (
            id, dashboard_id, table_id, viz_type, title, config_json, grid_layout_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        card_id, id, payload.table_id, payload.viz_type, payload.title,
        json.dumps(payload.config.model_dump()),
        json.dumps(grid if isinstance(grid, dict) else grid.model_dump())
    ))
    conn.commit()
    conn.close()

    return {"status": "created", "card_id": card_id}
@app.put("/api/v1/dashboards/{id}/cards/{card_id}")
def update_card(id: str, card_id: str, payload: CardUpdate):
    conn = get_connection()
    cursor = conn.cursor()
    updates = []
    vals = []
    if payload.title is not None:
        updates.append("title = ?")
        vals.append(payload.title)
    if payload.table_id is not None:
        updates.append("table_id = ?")
        vals.append(payload.table_id)
    if payload.viz_type is not None:
        updates.append("viz_type = ?")
        vals.append(payload.viz_type)
    if payload.config is not None:
        updates.append("config_json = ?")
        vals.append(json.dumps(payload.config.model_dump()))
    if payload.grid_layout is not None:
        updates.append("grid_layout_json = ?")
        vals.append(json.dumps(payload.grid_layout.model_dump()))

    if updates:
        vals.extend([card_id, id])
        cursor.execute(
            f"UPDATE dashboard_cards SET {', '.join(updates)} WHERE id = ? AND dashboard_id = ?",
            tuple(vals)
        )
        conn.commit()
    conn.close()
    return {"status": "updated", "card_id": card_id}
@app.put("/api/v1/dashboards/{id}/layout")
def update_dashboard_layout(id: str, payload: List[CardLayoutItem]):
    conn = get_connection()
    cursor = conn.cursor()
    for item in payload:
        grid_json = json.dumps({"x": item.x, "y": item.y, "w": item.w, "h": item.h})
        cursor.execute(
            "UPDATE dashboard_cards SET grid_layout_json = ? WHERE id = ? AND dashboard_id = ?",
            (grid_json, item.id, id)
        )
    conn.commit()
    conn.close()
    return {"status": "ok", "updated": len(payload)}

@app.delete("/api/v1/dashboards/{id}/cards/{card_id}")
def delete_card(id: str, card_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM dashboard_cards WHERE id = ? AND dashboard_id = ?", (card_id, id))
    conn.commit()
    conn.close()
    return {"status": "deleted", "card_id": card_id}

# ----------------- Query Execution -----------------
@app.post("/api/v1/dashboards/{id}/query", response_model=QueryResult)
def run_query(id: str, payload: QueryRequest):
    return execute_card_query(id, payload.table_id, payload.viz_type, payload.config)

# ----------------- Jupyter Notebook Endpoints -----------------
@app.get("/api/v1/dashboards/{id}/notebook")
def get_dashboard_notebook(id: str):
    return load_notebook(id)

@app.put("/api/v1/dashboards/{id}/notebook")
def update_dashboard_notebook(id: str, payload: NotebookData):
    save_notebook(id, payload.model_dump())
    return {"status": "saved"}

@app.post("/api/v1/dashboards/{id}/notebook/execute-cell")
def execute_notebook_cell(id: str, payload: ExecuteCellRequest):
    session = get_kernel_session(id)
    return session.execute_cell(payload.code)

@app.post("/api/v1/dashboards/{id}/notebook/restart")
def restart_notebook(id: str):
    session = restart_kernel_session(id)
    return {"status": "restarted", "execution_count": session.execution_count}

# ----------------- Python Sandbox & Derived Tables -----------------
@app.post("/api/v1/dashboards/{id}/sandbox/execute", response_model=PythonExecuteResponse)
def execute_sandbox(id: str, payload: PythonExecuteRequest):
    return execute_python_sandbox(id, payload.code)

@app.post("/api/v1/dashboards/{id}/derived-tables", response_model=TableOut)
def save_derived_table(id: str, payload: SaveDerivedTableRequest):
    try:
        return materialize_derived_table_from_session(id, payload.table_name, payload.dataframe_var)
    except Exception as session_err:
        if payload.code:
            try:
                return materialize_derived_table_from_code(
                    id, payload.table_name, payload.dataframe_var, payload.code
                )
            except Exception as code_err:
                raise HTTPException(status_code=400, detail=str(code_err))
        raise HTTPException(
            status_code=400,
            detail=f"{session_err} Re-run the cell that creates this DataFrame, then try saving again.",
        )
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
