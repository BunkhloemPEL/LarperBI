export interface ColumnMetadata {
  name: string;
  data_type: string;
  semantic_type: "measure" | "dimension" | "date";
  sample_values: (string | number | boolean)[];
  unique_count: number;
  null_count: number;
}

export interface TableItem {
  id: string;
  dashboard_id: string;
  display_name: string;
  table_type: "raw_upload" | "derived_python" | "derived_model" | "python_script" | "manual";
  file_path: string;
  row_count: number;
  columns: ColumnMetadata[];
  created_at: string;
  origin?: "upload" | "notebook" | "derived" | "python_script" | "manual";
  role?: "data" | "helper";
  script?: string | null;
  inputs?: string[];
  last_refreshed_at?: string | null;
  pos_x?: number | null;
  pos_y?: number | null;
  pos_w?: number | null;
  pos_h?: number | null;
}

export interface SheetPreview {
  name: string;
  columns: string[];
  preview_rows: (string | number | boolean | null)[][];
  is_empty: boolean;
  error?: string | null;
}

export interface UploadInspection {
  upload_id: string;
  filename: string;
  is_excel: boolean;
  sheets: SheetPreview[];
}

export interface UploadResult {
  tables: TableItem[];
  skipped: string[];
}

export interface DashboardItem {
  id: string;
  title: string;
  description?: string;
  status: string;
  created_at: string;
  updated_at: string;
  table_count: number;
  card_count: number;
}

export interface RelationshipItem {
  id: string;
  dashboard_id: string;
  from_table_id: string;
  from_column: string;
  to_table_id: string;
  to_column: string;
  cardinality: string;
  created_at: string;
}

export interface GridLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MeasureSpec {
  column?: string;
  aggregation?: "sum" | "avg" | "count" | "min" | "max";
  metric_id?: string;
  alias?: string;
}

export interface DimensionSpec {
  column: string;
  date_grain?: "year" | "month" | "day";
  alias?: string;
}

export interface CardConfig {
  dimensions: DimensionSpec[];
  measures: MeasureSpec[];
  filters: Record<string, unknown>[];
  sort_by?: string;
  sort_desc: boolean;
  limit?: number;
}

export interface CardItem {
  id: string;
  dashboard_id: string;
  table_id: string;
  viz_type: string;
  title: string;
  config: CardConfig;
  grid_layout: GridLayout;
  created_at: string;
}

export interface CellOutputItem {
  output_type: "stream" | "execute_result" | "display_data" | "error";
  text?: string;
  table_preview?: {
    var_name: string;
    columns: string[];
    rows: (string | number | boolean | null)[][];
    row_count: number;
  };
  plot_base64?: string;
  error?: string;
  result_text?: string;
}

export interface NotebookCellItem {
  id: string;
  cell_type: "code" | "markdown";
  source: string;
  outputs: CellOutputItem[];
  execution_count?: number | null;
  duration_ms?: number | null;
}

export interface NotebookData {
  cells: NotebookCellItem[];
}

export interface TableRowsResponse {
  table_id: string;
  columns: ColumnMetadata[];
  rows: Record<string, string | number | boolean | null>[];
  total_count: number;
  unfiltered_count: number;
  page: number;
  page_size: number;
  total_pages: number;
  sort_column?: string | null;
  sort_dir: "asc" | "desc";
  search?: string | null;
}

export interface FilterItem {
  id: string;
  dashboard_id: string;
  name: string;
  filter_type: "category" | "date_range" | "text" | "number";
  table_id: string;
  column_name: string;
  default_value?: unknown;
  created_at: string;
}

export interface ActiveFilterState {
  [filter_id: string]: {
    column: string;
    operator: string;
    value: unknown;
  };
}

export interface MetricItem {
  id: string;
  dashboard_id: string;
  table_id: string;
  name: string;
  description?: string;
  formula_type: "simple_agg" | "ratio";
  definition: Record<string, unknown>;
  format_type: "currency" | "percentage" | "number";
  created_at: string;
}

export interface DashboardDetail {
  dashboard: DashboardItem;
  tables: TableItem[];
  cards: CardItem[];
  relationships: RelationshipItem[];
  filters: FilterItem[];
  metrics: MetricItem[];
}

export interface PythonExecuteResponse {
  success: boolean;
  stdout: string;
  error?: string;
  table_preview?: {
    var_name: string;
    columns: string[];
    rows: (string | number | boolean | null)[][];
    row_count: number;
  };
  plot_base64?: string;
  detected_dataframes: string[];
}

export interface QueryResult {
  viz_type: string;
  data: unknown;
  raw_columns: string[];
  raw_rows: (string | number | boolean | null)[][];
}
