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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (dashboard_id) REFERENCES dashboards(id) ON DELETE CASCADE
    );
    """)

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

    conn.commit()
    conn.close()

# Auto-initialize on import
init_db()
