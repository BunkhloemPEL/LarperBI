import type {
  DashboardItem,
  DashboardDetail,
  TableItem,
  CardConfig,
  RelationshipItem,
  FilterItem,
  MetricItem,
  TableRowsResponse,
  NotebookData,
  PythonExecuteResponse,
  QueryResult,
} from "../types/larper";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8001";

export async function fetchDashboards(): Promise<DashboardItem[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dashboards`);
  if (!res.ok) throw new Error("Failed to fetch dashboards");
  return res.json();
}

export async function createDashboard(title: string, description?: string): Promise<DashboardItem> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dashboards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: jsonStringify({ title, description }),
  });
  if (!res.ok) throw new Error("Failed to create dashboard");
  return res.json();
}

export async function fetchDashboardDetail(id: string): Promise<DashboardDetail> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dashboards/${id}`);
  if (!res.ok) throw new Error("Failed to fetch dashboard detail");
  return res.json();
}

export async function updateDashboard(id: string, updates: { title?: string; description?: string; status?: string }): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dashboards/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: jsonStringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update dashboard");
}
export async function updateDashboardLayout(
  dashboardId: string,
  layouts: { id: string; x: number; y: number; w: number; h: number }[]
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dashboards/${dashboardId}/layout`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: jsonStringify(layouts),
  });
  if (!res.ok) throw new Error("Failed to update dashboard layout");
}

export async function deleteDashboard(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dashboards/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete dashboard");
}

export async function uploadTable(dashboardId: string, file: File): Promise<TableItem> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE_URL}/api/v1/dashboards/${dashboardId}/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Failed to upload table");
  return res.json();
}

export async function deleteTable(dashboardId: string, tableId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dashboards/${dashboardId}/tables/${tableId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete table");
}

export async function executePythonSandbox(dashboardId: string, code: string): Promise<PythonExecuteResponse> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dashboards/${dashboardId}/sandbox/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: jsonStringify({ code }),
  });
  if (!res.ok) throw new Error("Failed to execute python sandbox");
  return res.json();
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const text = await res.text();
    if (!text) return fallback;
    try {
      const parsed = JSON.parse(text);
      return typeof parsed.detail === "string" ? parsed.detail : text;
    } catch {
      return text;
    }
  } catch {
    return fallback;
  }
}

export async function saveDerivedTable(dashboardId: string, tableName: string, dataframeVar: string, code?: string): Promise<TableItem> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dashboards/${dashboardId}/derived-tables`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: jsonStringify({ table_name: tableName, dataframe_var: dataframeVar, code }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, "Failed to save derived table"));
  return res.json();
}

export async function fetchTableRows(
  dashboardId: string,
  tableId: string,
  params: {
    page?: number;
    pageSize?: number;
    search?: string;
    sortColumn?: string | null;
    sortDir?: "asc" | "desc";
    filters?: { column: string; values: string[] }[];
  } = {}
): Promise<TableRowsResponse> {
  const q = new URLSearchParams();
  q.set("page", String(params.page ?? 1));
  q.set("page_size", String(params.pageSize ?? 50));
  if (params.search) q.set("search", params.search);
  if (params.sortColumn) q.set("sort_column", params.sortColumn);
  if (params.sortDir) q.set("sort_dir", params.sortDir);
  if (params.filters && params.filters.length > 0) {
    q.set("filters", JSON.stringify(params.filters));
  }

  const res = await fetch(
    `${API_BASE_URL}/api/v1/dashboards/${dashboardId}/tables/${tableId}/rows?${q.toString()}`
  );
  if (!res.ok) throw new Error(await errorMessage(res, "Failed to load table rows"));
  return res.json();
}

export async function updateModelLayout(
  dashboardId: string,
  layout: { table_id: string; x: number; y: number; w: number; h: number }[]
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dashboards/${dashboardId}/model-layout`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: jsonStringify(layout),
  });
  if (!res.ok) throw new Error(await errorMessage(res, "Failed to save model layout"));
}

export async function createEmptyTable(
  dashboardId: string,
  payload: {
    display_name: string;
    columns: { name: string; dtype: string }[];
    role: "data" | "helper";
  }
): Promise<TableItem> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dashboards/${dashboardId}/tables/empty`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: jsonStringify(payload),
  });
  if (!res.ok) throw new Error(await errorMessage(res, "Failed to create empty table"));
  return res.json();
}

export async function createPythonTable(
  dashboardId: string,
  payload: {
    display_name: string;
    script: string;
    inputs?: string[];
    role: "data" | "helper";
  }
): Promise<TableItem> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dashboards/${dashboardId}/tables/python`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: jsonStringify(payload),
  });
  if (!res.ok) throw new Error(await errorMessage(res, "Failed to create Python table"));
  return res.json();
}

export async function refreshTable(dashboardId: string, tableId: string): Promise<TableItem> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dashboards/${dashboardId}/tables/${tableId}/refresh`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(await errorMessage(res, "Failed to refresh table"));
  return res.json();
}

export async function updateTableScript(
  dashboardId: string,
  tableId: string,
  payload: { script: string; inputs?: string[]; role?: "data" | "helper" }
): Promise<TableItem> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dashboards/${dashboardId}/tables/${tableId}/script`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: jsonStringify(payload),
  });
  if (!res.ok) throw new Error(await errorMessage(res, "Failed to update table script"));
  return res.json();
}

export async function addCalculatedColumn(
  dashboardId: string,
  tableId: string,
  name: string,
  expression: string
): Promise<TableItem> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dashboards/${dashboardId}/tables/${tableId}/calculated-column`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: jsonStringify({ name, expression }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, "Failed to add calculated column"));
  return res.json();
}

export async function createAggregatedTable(
  dashboardId: string,
  payload: {
    base_table_id: string;
    display_name: string;
    dimensions: string[];
    measures: { column: string; aggregation: string; alias?: string }[];
    filters?: Record<string, unknown>[];
  }
): Promise<TableItem> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dashboards/${dashboardId}/derived-tables/aggregate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: jsonStringify(payload),
  });
  if (!res.ok) throw new Error(await errorMessage(res, "Failed to create aggregated table"));
  return res.json();
}

export async function runQuery(dashboardId: string, tableId: string, vizType: string, config: CardConfig): Promise<QueryResult> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dashboards/${dashboardId}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: jsonStringify({ table_id: tableId, viz_type: vizType, config }),
  });
  if (!res.ok) throw new Error("Failed to execute query");
  return res.json();
}

export async function createCard(dashboardId: string, card: {
  table_id: string;
  viz_type: string;
  title: string;
  config: CardConfig;
  grid_layout?: { x: number; y: number; w: number; h: number };
}): Promise<{ card_id: string }> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dashboards/${dashboardId}/cards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: jsonStringify(card),
  });
  if (!res.ok) throw new Error("Failed to create card");
  return res.json();
}

export async function deleteCard(dashboardId: string, cardId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dashboards/${dashboardId}/cards/${cardId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete card");
}
export async function updateCard(
  dashboardId: string,
  cardId: string,
  updates: {
    title?: string;
    table_id?: string;
    viz_type?: string;
    config?: CardConfig;
    grid_layout?: { x: number; y: number; w: number; h: number };
  }
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dashboards/${dashboardId}/cards/${cardId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: jsonStringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update card");
}

export async function createRelationship(dashboardId: string, rel: {
  from_table_id: string;
  from_column: string;
  to_table_id: string;
  to_column: string;
  cardinality?: string;
}): Promise<RelationshipItem> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dashboards/${dashboardId}/relationships`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: jsonStringify(rel),
  });
  if (!res.ok) throw new Error("Failed to create relationship");
  return res.json();
}

export async function deleteRelationship(dashboardId: string, relId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dashboards/${dashboardId}/relationships/${relId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete relationship");
}
export async function fetchDashboardFilters(dashboardId: string): Promise<FilterItem[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dashboards/${dashboardId}/filters`);
  if (!res.ok) throw new Error("Failed to fetch filters");
  return res.json();
}

export async function createDashboardFilter(dashboardId: string, filter: {
  name: string;
  filter_type: string;
  table_id: string;
  column_name: string;
  default_value?: unknown;
}): Promise<FilterItem> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dashboards/${dashboardId}/filters`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: jsonStringify(filter),
  });
  if (!res.ok) throw new Error("Failed to create filter");
  return res.json();
}

export async function deleteDashboardFilter(dashboardId: string, filterId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dashboards/${dashboardId}/filters/${filterId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete filter");
}

export async function fetchDistinctColumnValues(dashboardId: string, tableId: string, columnName: string): Promise<(string | number | boolean)[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dashboards/${dashboardId}/tables/${tableId}/columns/${columnName}/distinct`);
  if (!res.ok) throw new Error("Failed to fetch distinct values");
  return res.json();
}

export async function fetchNotebook(dashboardId: string): Promise<NotebookData> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dashboards/${dashboardId}/notebook`);
  if (!res.ok) throw new Error("Failed to fetch notebook");
  return res.json();
}

export async function saveNotebookData(dashboardId: string, data: NotebookData): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dashboards/${dashboardId}/notebook`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: jsonStringify(data),
  });
  if (!res.ok) throw new Error("Failed to save notebook");
}

export async function executeNotebookCell(dashboardId: string, cellId: string, code: string): Promise<{
  success: boolean;
  execution_count: number;
  stdout: string;
  error?: string;
  table_preview?: {
    var_name: string;
    columns: string[];
    rows: (string | number | boolean | null)[][];
    row_count: number;
  };
  plot_base64?: string;
  result_text?: string;
  duration_ms?: number;
  detected_dataframes: string[];
}> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dashboards/${dashboardId}/notebook/execute-cell`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: jsonStringify({ cell_id: cellId, code }),
  });
  if (!res.ok) throw new Error("Failed to execute notebook cell");
  return res.json();
}

export async function restartKernel(dashboardId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dashboards/${dashboardId}/notebook/restart`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to restart kernel");
}

export async function fetchDashboardMetrics(dashboardId: string): Promise<MetricItem[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dashboards/${dashboardId}/metrics`);
  if (!res.ok) throw new Error("Failed to fetch metrics");
  return res.json();
}

export async function createDashboardMetric(dashboardId: string, metric: {
  table_id: string;
  name: string;
  description?: string;
  formula_type: string;
  definition: Record<string, unknown>;
  format_type: string;
}): Promise<MetricItem> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dashboards/${dashboardId}/metrics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: jsonStringify(metric),
  });
  if (!res.ok) throw new Error("Failed to create metric");
  return res.json();
}

export async function deleteDashboardMetric(dashboardId: string, metricId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dashboards/${dashboardId}/metrics/${metricId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete metric");
}

function jsonStringify(obj: unknown): string {
  return JSON.stringify(obj);
}
