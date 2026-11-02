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
  table_type: "raw_upload" | "derived_python";
  file_path: string;
  row_count: number;
  columns: ColumnMetadata[];
  created_at: string;
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
  column: string;
  aggregation: "sum" | "avg" | "count" | "min" | "max";
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

export interface DashboardDetail {
  dashboard: DashboardItem;
  tables: TableItem[];
  cards: CardItem[];
  relationships: RelationshipItem[];
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
