from typing import List, Dict, Any, Optional
from pydantic import BaseModel

# ----------------- Dashboard Models -----------------
class DashboardCreate(BaseModel):
    title: str = "Untitled Dashboard"
    description: Optional[str] = None

class DashboardUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None

class DashboardOut(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    status: str
    created_at: str
    updated_at: str
    table_count: int = 0
    card_count: int = 0

# ----------------- Table & Column Models -----------------
class ColumnMetadata(BaseModel):
    name: str
    data_type: str
    semantic_type: str  # "measure" | "dimension" | "date"
    sample_values: List[Any] = []
    unique_count: int = 0
    null_count: int = 0

class TableOut(BaseModel):
    id: str
    dashboard_id: str
    display_name: str
    table_type: str  # "raw_upload" | "derived_python"
    file_path: str
    row_count: int
    columns: List[ColumnMetadata]
    created_at: str

# ----------------- Relationship Models -----------------
class RelationshipCreate(BaseModel):
    from_table_id: str
    from_column: str
    to_table_id: str
    to_column: str
    cardinality: str = "many_to_one"  # "many_to_one" | "one_to_one"

class RelationshipOut(BaseModel):
    id: str
    dashboard_id: str
    from_table_id: str
    from_column: str
    to_table_id: str
    to_column: str
    cardinality: str
    created_at: str

# ----------------- Filter Parameter Models -----------------
class FilterCreate(BaseModel):
    name: str
    filter_type: str  # "category" | "date_range" | "text" | "number"
    table_id: str
    column_name: str
    default_value: Optional[Any] = None

class FilterOut(BaseModel):
    id: str
    dashboard_id: str
    name: str
    filter_type: str
    table_id: str
    column_name: str
    default_value: Optional[Any] = None
    created_at: str
# ----------------- Card Models -----------------
class GridLayout(BaseModel):
    x: int = 0
    y: int = 0
    w: int = 6
    h: int = 4

class CardLayoutItem(BaseModel):
    id: str
    x: int
    y: int
    w: int
    h: int

class MeasureSpec(BaseModel):
    column: str
    aggregation: str = "sum"  # "sum" | "avg" | "count" | "min" | "max"
    alias: Optional[str] = None

class DimensionSpec(BaseModel):
    column: str
    date_grain: Optional[str] = None  # "year" | "month" | "day"
    alias: Optional[str] = None

class CardConfig(BaseModel):
    dimensions: List[DimensionSpec] = []
    measures: List[MeasureSpec] = []
    filters: List[Dict[str, Any]] = []
    sort_by: Optional[str] = None
    sort_desc: bool = True
    limit: Optional[int] = 50

class CardCreate(BaseModel):
    table_id: str
    viz_type: str
    title: str
    config: CardConfig
    grid_layout: Optional[GridLayout] = None

class CardUpdate(BaseModel):
    title: Optional[str] = None
    table_id: Optional[str] = None
    viz_type: Optional[str] = None
    config: Optional[CardConfig] = None
    grid_layout: Optional[GridLayout] = None

class CardOut(BaseModel):
    id: str
    dashboard_id: str
    table_id: str
    viz_type: str
    title: str
    config: CardConfig
    grid_layout: GridLayout
    created_at: str

# ----------------- Query Models -----------------
class QueryRequest(BaseModel):
    table_id: str
    viz_type: str
    config: CardConfig

class QueryResult(BaseModel):
    viz_type: str
    data: Any  # Shaped for the targeted visual component
    raw_columns: List[str] = []
    raw_rows: List[List[Any]] = []

# ----------------- Python Sandbox Models -----------------
class PythonExecuteRequest(BaseModel):
    code: str

class PythonExecuteResponse(BaseModel):
    success: bool
    stdout: str
    error: Optional[str] = None
    table_preview: Optional[Dict[str, Any]] = None
    plot_base64: Optional[str] = None
    detected_dataframes: List[str] = []

class SaveDerivedTableRequest(BaseModel):
    table_name: str
    dataframe_var: str
    code: Optional[str] = None

# ----------------- Jupyter Notebook Models -----------------
class ExecuteCellRequest(BaseModel):
    cell_id: str
    code: str

class NotebookCell(BaseModel):
    id: str
    cell_type: str  # "code" | "markdown"
    source: str
    outputs: List[Dict[str, Any]] = []
    execution_count: Optional[int] = None

class NotebookData(BaseModel):
    cells: List[NotebookCell]
