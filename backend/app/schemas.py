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
    table_type: str  # "raw_upload" | "derived_python" | "derived_model" | "python_script" | "manual"
    file_path: str
    row_count: int
    columns: List[ColumnMetadata]
    created_at: str
    origin: str = "upload"  # "upload" | "notebook" | "derived" | "python_script" | "manual"
    role: str = "data"  # "data" | "helper"
    script: Optional[str] = None
    inputs: List[str] = []
    last_refreshed_at: Optional[str] = None
    pos_x: Optional[int] = None
    pos_y: Optional[int] = None
    pos_w: Optional[int] = None
    pos_h: Optional[int] = None

# ----------------- Data Modeling: New Table / New Column -----------------
class TableColumnCreate(BaseModel):
    name: str
    dtype: str  # "string" | "integer" | "float" | "boolean" | "date" | "datetime"

class EmptyTableCreate(BaseModel):
    display_name: str
    columns: List[TableColumnCreate]
    role: str = "data"

class PythonTableCreate(BaseModel):
    display_name: str
    script: str
    inputs: List[str] = []
    role: str = "data"

class TableScriptUpdate(BaseModel):
    script: str
    inputs: List[str] = []
    role: Optional[str] = None

class ModelLayoutItem(BaseModel):
    table_id: str
    x: int
    y: int
    w: int
    h: int

class TableRowsResponse(BaseModel):
    table_id: str
    columns: List[ColumnMetadata]
    rows: List[Dict[str, Any]]
    total_count: int
    unfiltered_count: int
    page: int
    page_size: int
    total_pages: int
    sort_column: Optional[str] = None
    sort_dir: str = "asc"
    search: Optional[str] = None

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
# ----------------- Metric / Measure Models -----------------
class MetricCreate(BaseModel):
    table_id: str
    name: str
    description: Optional[str] = None
    formula_type: str = "simple_agg"  # "simple_agg" | "ratio"
    definition: Dict[str, Any]
    format_type: str = "number"  # "currency" | "percentage" | "number"

class MetricOut(BaseModel):
    id: str
    dashboard_id: str
    table_id: str
    name: str
    description: Optional[str] = None
    formula_type: str
    definition: Dict[str, Any]
    format_type: str
    created_at: str

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
    column: Optional[str] = None
    aggregation: Optional[str] = "sum"
    metric_id: Optional[str] = None
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

# ----------------- Data Modeling (New Table / New Column) -----------------
class CalculatedColumnCreate(BaseModel):
    name: str
    expression: str

class AggregatedTableCreate(BaseModel):
    base_table_id: str
    display_name: str
    dimensions: List[str] = []
    measures: List[MeasureSpec] = []
    filters: List[Dict[str, Any]] = []
