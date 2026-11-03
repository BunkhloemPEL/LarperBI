import sqlite3
import json
from datetime import datetime
from typing import Dict, Any, List, Optional
from .config import DB_PATH

def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS dashboards (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS dashboard_tables (
        id TEXT PRIMARY KEY,
        dashboard_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        table_type TEXT NOT NULL,
        file_path TEXT NOT NULL,
        row_count INTEGER DEFAULT 0,
        columns_json TEXT NOT NULL,
        origin TEXT DEFAULT 'upload',
        role TEXT DEFAULT 'data',
        script TEXT,
        inputs_json TEXT,
        last_refreshed_at TIMESTAMP,
        pos_x INTEGER,
        pos_y INTEGER,
        pos_w INTEGER,
        pos_h INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE
    );
    """)

    # Migration for databases created before table-definition support
    cursor.execute("PRAGMA table_info(dashboard_tables)")
    existing_cols = {row[1] for row in cursor.fetchall()}
    migrations = {
        "origin": "ALTER TABLE dashboard_tables ADD COLUMN origin TEXT DEFAULT 'upload'",
        "role": "ALTER TABLE dashboard_tables ADD COLUMN role TEXT DEFAULT 'data'",
        "script": "ALTER TABLE dashboard_tables ADD COLUMN script TEXT",
        "inputs_json": "ALTER TABLE dashboard_tables ADD COLUMN inputs_json TEXT",
        "last_refreshed_at": "ALTER TABLE dashboard_tables ADD COLUMN last_refreshed_at TIMESTAMP",
        "pos_x": "ALTER TABLE dashboard_tables ADD COLUMN pos_x INTEGER",
        "pos_y": "ALTER TABLE dashboard_tables ADD COLUMN pos_y INTEGER",
        "pos_w": "ALTER TABLE dashboard_tables ADD COLUMN pos_w INTEGER",
        "pos_h": "ALTER TABLE dashboard_tables ADD COLUMN pos_h INTEGER",
    }
    for col, stmt in migrations.items():
        if col not in existing_cols:
            cursor.execute(stmt)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS table_relationships (
        id TEXT PRIMARY KEY,
        dashboard_id TEXT NOT NULL,
        from_table_id TEXT NOT NULL,
        from_column TEXT NOT NULL,
        to_table_id TEXT NOT NULL,
        to_column TEXT NOT NULL,
        cardinality TEXT DEFAULT 'many_to_one',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS dashboard_cards (
        id TEXT PRIMARY KEY,
        dashboard_id TEXT NOT NULL,
        table_id TEXT NOT NULL,
        viz_type TEXT NOT NULL,
        title TEXT NOT NULL,
        config_json TEXT NOT NULL,
        grid_layout_json TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE
    );
    """)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS dashboard_filters (
        id TEXT PRIMARY KEY,
        dashboard_id TEXT NOT NULL,
        name TEXT NOT NULL,
        filter_type TEXT NOT NULL,
        table_id TEXT NOT NULL,
        column_name TEXT NOT NULL,
        default_value_json TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE
    );
    """)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS dashboard_metrics (
        id TEXT PRIMARY KEY,
        dashboard_id TEXT NOT NULL,
        table_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        formula_type TEXT NOT NULL,
        definition_json TEXT NOT NULL,
        format_type TEXT DEFAULT 'number',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE
    );
    """)
    conn.commit()
    conn.close()

# Auto-initialize on import
init_db()
