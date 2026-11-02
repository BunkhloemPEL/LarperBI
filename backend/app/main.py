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
    QueryRequest,
    QueryResult,
    PythonExecuteRequest,
    PythonExecuteResponse,
    SaveDerivedTableRequest,
)
from .storage import ingest_file, list_dashboard_tables, get_table_by_id, get_dashboard_dir
from .sandbox import execute_python_sandbox, save_derived_table_from_sandbox
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
    conn.close()

    return {
        "dashboard": dict(dash),
        "tables": tables,
        "cards": cards,
        "relationships": relationships,
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
    rel_id = f"rel_{uuid.uuid4().hex[:8]}"
    conn = get_connection()
    cursor = conn.cursor()
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

# ----------------- Python Sandbox & Derived Tables -----------------
@app.post("/api/v1/dashboards/{id}/sandbox/execute", response_model=PythonExecuteResponse)
def execute_sandbox(id: str, payload: PythonExecuteRequest):
    return execute_python_sandbox(id, payload.code)

@app.post("/api/v1/dashboards/{id}/derived-tables", response_model=TableOut)
def save_derived_table(id: str, payload: SaveDerivedTableRequest):
    return save_derived_table_from_sandbox(id, payload.table_name, payload.dataframe_var, payload.code)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
