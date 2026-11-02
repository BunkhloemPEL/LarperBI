import type {
  DashboardItem,
  DashboardDetail,
  TableItem,
  CardConfig,
  RelationshipItem,
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

export async function saveDerivedTable(dashboardId: string, tableName: string, dataframeVar: string, code?: string): Promise<TableItem> {
  const res = await fetch(`${API_BASE_URL}/api/v1/dashboards/${dashboardId}/derived-tables`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: jsonStringify({ table_name: tableName, dataframe_var: dataframeVar, code }),
  });
  if (!res.ok) throw new Error("Failed to save derived table");
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

function jsonStringify(obj: unknown): string {
  return JSON.stringify(obj);
}
