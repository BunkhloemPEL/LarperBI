import React, { useState, useEffect } from "react";
import ReactGridLayout, { WidthProvider, type Layout } from "react-grid-layout";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { vscodeLight } from "@uiw/codemirror-theme-vscode";
import {
  Database,
  Link2,
  Trash2,
  Plus,
  ArrowRight,
  Hash,
  Calendar,
  Type,
  Star,
  X,
  Calculator,
  Table2,
  Code2,
  RefreshCw,
  AlertCircle,
  Key,
} from "lucide-react";
import {
  createRelationship,
  deleteRelationship,
  createDashboardMetric,
  deleteDashboardMetric,
  addCalculatedColumn,
  createAggregatedTable,
  createEmptyTable,
  createPythonTable,
  refreshTable,
  updateTableScript,
  updateModelLayout,
} from "../../services/api";
import type { TableItem, RelationshipItem, MetricItem } from "../../types/larper";

export interface ModelViewProps {
  dashboardId: string;
  tables: TableItem[];
  relationships: RelationshipItem[];
  metrics: MetricItem[];
  onRefresh: () => void;
}

const AGGREGATIONS = [
  { id: "sum", label: "Sum" },
  { id: "avg", label: "Average" },
  { id: "count", label: "Count" },
  { id: "count_distinct", label: "Count Distinct" },
  { id: "min", label: "Min" },
  { id: "max", label: "Max" },
];

const ModelAutoWidthGrid = WidthProvider(ReactGridLayout);

const ORIGIN_LABELS: Record<string, string> = {
  upload: "Raw Upload",
  notebook: "Notebook Model",
  derived: "Derived Model",
  python_script: "Python Table",
  manual: "Manual Table",
};

const COLUMN_DTYPES = ["string", "integer", "float", "boolean", "date", "datetime"];

const STARTER_SCRIPT = `# Dashboard tables are pre-loaded as Polars DataFrames.
# "df" is the first table; every table is also available by its name.
# Assign your output to "result" (Polars or pandas DataFrame).

import polars as pl

result = pl.DataFrame({
    "label": ["A", "B", "C"],
    "value": [10, 20, 30],
})

# Example using existing dashboard data instead:
# result = df.head(10)
`;

const RATIO_AGGS = [
  { id: "sum", label: "Sum of Column" },
  { id: "count", label: "Count of Rows" },
];

const FORMAT_TYPES = [
  { id: "number", label: "Number (1,234)" },
  { id: "currency", label: "Currency ($1,234.00)" },
  { id: "percentage", label: "Percentage (12.34%)" },
];

function describeMetric(metric: MetricItem): string {
  const d = metric.definition || {};
  if (metric.formula_type === "ratio") {
    const numCol = String(d.numerator_column ?? "?");
    const numAgg = String(d.numerator_agg ?? "sum");
    const denomCol = String(d.denominator_column ?? "?");
    const denomAgg = String(d.denominator_agg ?? "count");
    const mult = d.multiplier !== undefined ? Number(d.multiplier) : 100;
    const num = numAgg === "count" ? `count(${numCol})` : `sum(${numCol})`;
    const denom = denomAgg === "count" ? "count()" : `sum(${denomCol})`;
    return `${num} / ${denom} × ${mult}`;
  }
  const col = String(d.column ?? "?");
  const agg = String(d.aggregation ?? "sum");
  return agg === "count_distinct" ? `count_distinct(${col})` : `${agg}(${col})`;
}

export const ModelView: React.FC<ModelViewProps> = ({
  dashboardId,
  tables,
  relationships,
  metrics,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<"tables" | "metrics">("tables");

  // Relationship builder state
  const [fromTable, setFromTable] = useState<string>(tables[0]?.id || "");
  const [fromCol, setFromCol] = useState<string>("");
  const [toTable, setToTable] = useState<string>(tables[1]?.id || "");
  const [toCol, setToCol] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Metric builder state
  const [showMetricModal, setShowMetricModal] = useState<boolean>(false);
  const [metricName, setMetricName] = useState<string>("");
  const [metricDesc, setMetricDesc] = useState<string>("");
  const [metricTableId, setMetricTableId] = useState<string>(tables[0]?.id || "");
  const [formulaType, setFormulaType] = useState<"simple_agg" | "ratio">("simple_agg");
  const [metricColumn, setMetricColumn] = useState<string>("");
  const [metricAgg, setMetricAgg] = useState<string>("sum");
  const [numColumn, setNumColumn] = useState<string>("");
  const [numAgg, setNumAgg] = useState<string>("sum");
  const [denomColumn, setDenomColumn] = useState<string>("");
  const [denomAgg, setDenomAgg] = useState<string>("count");
  const [multiplier, setMultiplier] = useState<number>(100);
  const [formatType, setFormatType] = useState<"number" | "currency" | "percentage">("number");
  const [isSavingMetric, setIsSavingMetric] = useState<boolean>(false);

  // Data modeling state (New Table / New Column)
  const [showTableModal, setShowTableModal] = useState<boolean>(false);
  const [newTableName, setNewTableName] = useState<string>("");
  const [baseTableId, setBaseTableId] = useState<string>(tables[0]?.id || "");
  const [groupByCol, setGroupByCol] = useState<string>("");
  const [measureCol, setMeasureCol] = useState<string>("");
  const [measureAgg, setMeasureAgg] = useState<string>("sum");
  const [showColumnModal, setShowColumnModal] = useState<boolean>(false);
  const [columnTableId, setColumnTableId] = useState<string>("");
  const [columnName, setColumnName] = useState<string>("");
  const [columnExpr, setColumnExpr] = useState<string>("");
  const [isSavingModel, setIsSavingModel] = useState<boolean>(false);

  // Empty (manual) table state
  const [showEmptyModal, setShowEmptyModal] = useState<boolean>(false);
  const [emptyName, setEmptyName] = useState<string>("");
  const [emptyRole, setEmptyRole] = useState<"data" | "helper">("helper");
  const [emptyColumns, setEmptyColumns] = useState<{ name: string; dtype: string }[]>([
    { name: "", dtype: "string" },
  ]);

  // Python table / script editor state
  const [showScriptModal, setShowScriptModal] = useState<boolean>(false);
  const [scriptTableId, setScriptTableId] = useState<string | null>(null);
  const [scriptName, setScriptName] = useState<string>("");
  const [scriptText, setScriptText] = useState<string>(STARTER_SCRIPT);
  const [scriptRole, setScriptRole] = useState<"data" | "helper">("data");
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [isRunningScript, setIsRunningScript] = useState<boolean>(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [modelLayout, setModelLayout] = useState<Layout[]>([]);
  const [dragKey, setDragKey] = useState<{ tableId: string; column: string } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ tableId: string; column: string } | null>(null);
  const [linkOrigin, setLinkOrigin] = useState<{ x: number; y: number } | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [isLinking, setIsLinking] = useState<boolean>(false);

  useEffect(() => {
    setModelLayout(
      tables.map((t, idx) => ({
        i: t.id,
        x: typeof t.pos_x === "number" ? t.pos_x : (idx * 6) % 18,
        y: typeof t.pos_y === "number" ? t.pos_y : Math.floor(idx / 3) * 9,
        w: typeof t.pos_w === "number" ? t.pos_w : 6,
        h: typeof t.pos_h === "number" ? t.pos_h : 9,
        minW: 4,
        minH: 6,
      }))
    );
  }, [tables]);

  const persistModelLayout = (layout: Layout[]) => {
    updateModelLayout(
      dashboardId,
      layout.map((l) => ({ table_id: l.i, x: l.x, y: l.y, w: l.w, h: l.h }))
    ).catch(() => {});
  };

  const keyColumns = new Set<string>();
  relationships.forEach((rel) => {
    keyColumns.add(`${rel.from_table_id}.${rel.from_column}`);
    keyColumns.add(`${rel.to_table_id}.${rel.to_column}`);
  });

  const handleDropKey = async (targetTable: TableItem, targetColumn: string) => {
    const source = dragKey;
    setDragKey(null);
    setDropTarget(null);
    if (!source || source.tableId === targetTable.id) return;

    setIsLinking(true);
    try {
      await createRelationship(dashboardId, {
        from_table_id: source.tableId,
        from_column: source.column,
        to_table_id: targetTable.id,
        to_column: targetColumn,
      });
      onRefresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLinking(false);
    }
  };

  useEffect(() => {
    if (!dragKey) return;

    const resolveCell = (clientX: number, clientY: number) => {
      const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
      const cell = el?.closest("[data-table-id][data-column]") as HTMLElement | null;
      if (!cell) return null;
      const tableId = cell.getAttribute("data-table-id");
      const column = cell.getAttribute("data-column");
      if (!tableId || !column || tableId === dragKey.tableId) return null;
      return { tableId, column };
    };

    const onMove = (e: MouseEvent) => {
      setPointer({ x: e.clientX, y: e.clientY });
      const cell = resolveCell(e.clientX, e.clientY);
      setDropTarget(cell);
    };

    const onUp = (e: MouseEvent) => {
      const cell = resolveCell(e.clientX, e.clientY);
      if (cell) {
        const table = tables.find((t) => t.id === cell.tableId);
        if (table) {
          void handleDropKey(table, cell.column);
          return;
        }
      }
      setDragKey(null);
      setDropTarget(null);
      setLinkOrigin(null);
      setPointer(null);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [dragKey, tables]);

  const fromTblObj = tables.find((t) => t.id === fromTable);
  const toTblObj = tables.find((t) => t.id === toTable);
  const metricTableObj = tables.find((t) => t.id === metricTableId) || tables[0];

  const handleCreateRel = async () => {
    if (!fromTable || !fromCol || !toTable || !toCol) return;
    if (fromTable === toTable) {
      alert("Cannot link a table to itself.");
      return;
    }
    setIsSubmitting(true);
    try {
      await createRelationship(dashboardId, {
        from_table_id: fromTable,
        from_column: fromCol,
        to_table_id: toTable,
        to_column: toCol,
      });
      onRefresh();
    } catch (err: unknown) {
      alert(`Failed to create relationship: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRel = async (relId: string) => {
    if (!confirm("Remove this relationship?")) return;
    try {
      await deleteRelationship(dashboardId, relId);
      onRefresh();
    } catch (err: unknown) {
      alert(`Failed to delete relationship: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleOpenMetricModal = () => {
    const firstTable = tables[0];
    setMetricName("");
    setMetricDesc("");
    setMetricTableId(firstTable?.id || "");
    setFormulaType("simple_agg");
    setMetricColumn(firstTable?.columns.find((c) => c.semantic_type === "measure")?.name || firstTable?.columns[0]?.name || "");
    setMetricAgg("sum");
    setNumColumn(firstTable?.columns[0]?.name || "");
    setNumAgg("sum");
    setDenomColumn("");
    setDenomAgg("count");
    setMultiplier(100);
    setFormatType("number");
    setShowMetricModal(true);
  };

  const handleSaveMetric = async () => {
    if (!metricName.trim() || !metricTableId) return;
    if (formulaType === "simple_agg" && !metricColumn) return;
    if (formulaType === "ratio" && !numColumn) return;

    setIsSavingMetric(true);
    try {
      const definition =
        formulaType === "simple_agg"
          ? { column: metricColumn, aggregation: metricAgg }
          : {
              numerator_column: numColumn,
              numerator_agg: numAgg,
              denominator_column: denomColumn || numColumn,
              denominator_agg: denomAgg,
              multiplier,
            };

      await createDashboardMetric(dashboardId, {
        table_id: metricTableId,
        name: metricName.trim(),
        description: metricDesc.trim() || undefined,
        formula_type: formulaType,
        definition,
        format_type: formatType,
      });
      setShowMetricModal(false);
      onRefresh();
    } catch (err: unknown) {
      alert(`Failed to create metric: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSavingMetric(false);
    }
  };

  const handleDeleteMetric = async (metricId: string) => {
    if (!confirm("Delete this saved metric?")) return;
    try {
      await deleteDashboardMetric(dashboardId, metricId);
      onRefresh();
    } catch (err: unknown) {
      alert(`Failed to delete metric: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const openNewTableModal = () => {
    const t = tables.find((x) => x.role !== "helper") || tables[0];
    setNewTableName("");
    setBaseTableId(t?.id || "");
    setGroupByCol(t?.columns.find((c) => c.semantic_type !== "measure")?.name || "");
    setMeasureCol(t?.columns.find((c) => c.semantic_type === "measure")?.name || "");
    setMeasureAgg("sum");
    setShowTableModal(true);
  };

  const handleCreateModelTable = async () => {
    if (!baseTableId || !newTableName.trim()) return;
    setIsSavingModel(true);
    try {
      await createAggregatedTable(dashboardId, {
        base_table_id: baseTableId,
        display_name: newTableName.trim(),
        dimensions: groupByCol ? [groupByCol] : [],
        measures: measureCol ? [{ column: measureCol, aggregation: measureAgg, alias: `${measureAgg}_${measureCol}` }] : [],
        filters: [],
      });
      setShowTableModal(false);
      onRefresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSavingModel(false);
    }
  };

  const openColumnModal = (table: TableItem) => {
    setColumnTableId(table.id);
    setColumnName("");
    setColumnExpr("");
    setShowColumnModal(true);
  };

  const handleAddColumn = async () => {
    if (!columnTableId || !columnName.trim() || !columnExpr.trim()) return;
    setIsSavingModel(true);
    try {
      await addCalculatedColumn(dashboardId, columnTableId, columnName.trim(), columnExpr.trim());
      setShowColumnModal(false);
      onRefresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSavingModel(false);
    }
  };

  const openEmptyModal = () => {
    setEmptyName("");
    setEmptyRole("helper");
    setEmptyColumns([{ name: "", dtype: "string" }]);
    setShowEmptyModal(true);
  };

  const handleCreateEmpty = async () => {
    const cols = emptyColumns
      .map((c) => ({ name: c.name.trim(), dtype: c.dtype }))
      .filter((c) => c.name);
    if (!emptyName.trim() || cols.length === 0) return;
    setIsSavingModel(true);
    try {
      await createEmptyTable(dashboardId, {
        display_name: emptyName.trim(),
        columns: cols,
        role: emptyRole,
      });
      setShowEmptyModal(false);
      onRefresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSavingModel(false);
    }
  };

  const openNewPythonModal = () => {
    setScriptTableId(null);
    setScriptName("");
    setScriptText(STARTER_SCRIPT);
    setScriptRole("data");
    setScriptError(null);
    setShowScriptModal(true);
  };

  const openScriptEditor = (table: TableItem) => {
    setScriptTableId(table.id);
    setScriptName(table.display_name);
    setScriptText(table.script || STARTER_SCRIPT);
    setScriptRole((table.role as "data" | "helper") || "data");
    setScriptError(null);
    setShowScriptModal(true);
  };

  const handleSaveScript = async () => {
    if (!scriptText.trim()) return;
    if (!scriptTableId && !scriptName.trim()) return;
    setIsRunningScript(true);
    setScriptError(null);
    try {
      if (scriptTableId) {
        await updateTableScript(dashboardId, scriptTableId, {
          script: scriptText,
          role: scriptRole,
          inputs: [],
        });
      } else {
        await createPythonTable(dashboardId, {
          display_name: scriptName.trim(),
          script: scriptText,
          role: scriptRole,
          inputs: [],
        });
      }
      setShowScriptModal(false);
      onRefresh();
    } catch (err: unknown) {
      setScriptError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunningScript(false);
    }
  };

  const handleRefreshTable = async (table: TableItem) => {
    setRefreshingId(table.id);
    try {
      await refreshTable(dashboardId, table.id);
      onRefresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setRefreshingId(null);
    }
  };

  const renderColumnOptions = (table: TableItem | undefined, measureOnly: boolean) => {
    if (!table) return null;
    const cols = measureOnly
      ? table.columns.filter((c) => c.semantic_type === "measure")
      : table.columns;
    const list = cols.length > 0 ? cols : table.columns;
    return list.map((c) => (
      <option key={c.name} value={c.name}>
        {c.name} ({c.data_type})
      </option>
    ));
  };

  const formatBadge: Record<string, { label: string; color: string; bg: string }> = {
    currency: { label: "Currency", color: "#0f766e", bg: "rgba(13, 148, 136, 0.12)" },
    percentage: { label: "Percent", color: "#b45309", bg: "rgba(217, 119, 6, 0.12)" },
    number: { label: "Number", color: "#1d4ed8", bg: "rgba(37, 99, 235, 0.12)" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", paddingBottom: "3rem" }}>
      {/* Sub-tab Switcher */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.375rem",
          backgroundColor: "#ffffff",
          border: "1px solid var(--mb-color-border-card)",
          borderRadius: "var(--mb-radius-card)",
          padding: "0.375rem",
          boxShadow: "var(--mb-shadow-card)",
          width: "100%",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("tables")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            padding: "0.4375rem 0.875rem",
            borderRadius: "6px",
            border: "none",
            fontSize: "0.8125rem",
            fontWeight: 600,
            cursor: "pointer",
            backgroundColor: activeTab === "tables" ? "var(--mb-color-brand)" : "transparent",
            color: activeTab === "tables" ? "#ffffff" : "var(--mb-color-text-secondary)",
            transition: "all 0.15s ease",
          }}
        >
          <Table2 size={14} />
          Tables & Relationships ({tables.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("metrics")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            padding: "0.4375rem 0.875rem",
            borderRadius: "6px",
            border: "none",
            fontSize: "0.8125rem",
            fontWeight: 600,
            cursor: "pointer",
            backgroundColor: activeTab === "metrics" ? "var(--mb-color-brand)" : "transparent",
            color: activeTab === "metrics" ? "#ffffff" : "var(--mb-color-text-secondary)",
            transition: "all 0.15s ease",
          }}
        >
          <Star size={14} />
          Saved Metrics / Measures ({metrics.length})
        </button>

        {activeTab === "tables" && (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <button
              type="button"
              onClick={openEmptyModal}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.375rem",
                padding: "0.4375rem 0.75rem",
                borderRadius: "6px",
                border: "1px solid var(--mb-color-border-card)",
                backgroundColor: "#ffffff",
                color: "var(--mb-color-text-secondary)",
                fontSize: "0.8125rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Plus size={14} />
              New Empty Table
            </button>
            <button
              type="button"
              onClick={openNewPythonModal}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.375rem",
                padding: "0.4375rem 0.75rem",
                borderRadius: "6px",
                border: "1px solid var(--mb-color-border-card)",
                backgroundColor: "#ffffff",
                color: "var(--mb-color-text-secondary)",
                fontSize: "0.8125rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Code2 size={14} />
              New Python Table
            </button>
            <button
              type="button"
              onClick={openNewTableModal}
              disabled={tables.length === 0}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.375rem",
                padding: "0.4375rem 0.875rem",
                borderRadius: "6px",
                border: "1px solid var(--mb-color-border-card)",
                backgroundColor: "#ffffff",
                color: "var(--mb-color-brand)",
                fontSize: "0.8125rem",
                fontWeight: 600,
                cursor: tables.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              <Plus size={14} />
              New Derived Table
            </button>
          </div>
        )}
      </div>

      {/* ================= TABLES & RELATIONSHIPS ================= */}
      {activeTab === "tables" && (
        <>
          {/* Top Relationship Builder Card */}
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "var(--mb-radius-card)",
              border: "1px solid var(--mb-color-border-card)",
              padding: "1.25rem 1.5rem",
              boxShadow: "var(--mb-shadow-card)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <Link2 size={18} color="var(--mb-color-brand)" />
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--mb-color-text-primary)" }}>
                Data Model Relationships (Star Schema)
              </h3>
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--mb-color-text-muted)", marginBottom: "1rem" }}>
              Define foreign key connections between tables. Visual cards will automatically join across linked tables.
            </p>

            {tables.length >= 2 ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  backgroundColor: "var(--mb-color-bg-page)",
                  padding: "0.875rem 1rem",
                  borderRadius: "6px",
                  border: "1px solid #e2e8f0",
                  flexWrap: "wrap",
                }}
              >
                {/* From Table & Col */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                  <select
                    value={fromTable}
                    onChange={(e) => {
                      setFromTable(e.target.value);
                      setFromCol("");
                    }}
                    style={{ padding: "0.375rem 0.625rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8125rem", fontWeight: 600 }}
                  >
                    {tables.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.display_name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={fromCol}
                    onChange={(e) => setFromCol(e.target.value)}
                    style={{ padding: "0.375rem 0.625rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8125rem" }}
                  >
                    <option value="">-- Select Key Column --</option>
                    {fromTblObj?.columns.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <ArrowRight size={16} color="#94a3b8" />

                {/* To Table & Col */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                  <select
                    value={toTable}
                    onChange={(e) => {
                      setToTable(e.target.value);
                      setToCol("");
                    }}
                    style={{ padding: "0.375rem 0.625rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8125rem", fontWeight: 600 }}
                  >
                    {tables.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.display_name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={toCol}
                    onChange={(e) => setToCol(e.target.value)}
                    style={{ padding: "0.375rem 0.625rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8125rem" }}
                  >
                    <option value="">-- Select Key Column --</option>
                    {toTblObj?.columns.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleCreateRel}
                  disabled={isSubmitting || !fromCol || !toCol || fromTable === toTable}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    padding: "0.4rem 0.875rem",
                    borderRadius: "var(--mb-radius-btn)",
                    border: "none",
                    backgroundColor: "var(--mb-color-brand)",
                    color: "#ffffff",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Plus size={14} />
                  Link Tables
                </button>
              </div>
            ) : (
              <div style={{ fontSize: "0.8125rem", color: "#94a3b8" }}>
                Upload or derive at least 2 tables to define relationships.
              </div>
            )}

            {/* Existing Relationships List */}
            {relationships.length > 0 && (
              <div style={{ marginTop: "1rem" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                  Active Relationships ({relationships.length}):
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.5rem" }}>
                  {relationships.map((rel) => {
                    const fTbl = tables.find((t) => t.id === rel.from_table_id)?.display_name || rel.from_table_id;
                    const tTbl = tables.find((t) => t.id === rel.to_table_id)?.display_name || rel.to_table_id;
                    return (
                      <div
                        key={rel.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          backgroundColor: "#f1f5f9",
                          padding: "0.375rem 0.75rem",
                          borderRadius: "6px",
                          border: "1px solid #e2e8f0",
                          fontSize: "0.75rem",
                          fontWeight: 500,
                        }}
                      >
                        <span>
                          <strong>{fTbl}.{rel.from_column}</strong> ➔ <strong>{tTbl}.{rel.to_column}</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteRel(rel.id)}
                          title="Remove Link"
                          style={{ background: "transparent", border: "none", cursor: "pointer", color: "#dc2626" }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Tables Schema Cards Grid */}
          <div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "1rem", marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--mb-color-text-primary)" }}>
                Tables in this Dashboard ({tables.length})
              </h3>
              <span style={{ fontSize: "0.75rem", color: "var(--mb-color-text-muted)" }}>
                Drag a column onto another table’s column to link keys · drag cards by their header to arrange
              </span>
            </div>

            <div
              style={{
                position: "relative",
                minHeight: "480px",
                backgroundColor: "#f8fafc",
                border: "1px dashed #cbd5e1",
                borderRadius: "var(--mb-radius-card)",
                padding: "4px",
              }}
            >
              <ModelAutoWidthGrid
                className="model-layout"
                layout={modelLayout}
                cols={18}
                rowHeight={32}
                margin={[16, 16]}
                isDraggable={tables.length > 0}
                isResizable={tables.length > 0}
                compactType={null}
                preventCollision={false}
                onLayoutChange={(next) => setModelLayout(next)}
                onDragStop={persistModelLayout}
                onResizeStop={persistModelLayout}
                draggableHandle=".model-card-drag"
                draggableCancel="button, select, input, textarea, a, [data-dontdrag]"
              >
              {tables.map((table) => (
                <div key={table.id} style={{ height: "100%" }}>
                <div
                  style={{
                    backgroundColor: "#ffffff",
                    borderRadius: "var(--mb-radius-card)",
                    border: "1px solid var(--mb-color-border-card)",
                    boxShadow: "var(--mb-shadow-card)",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                  }}
                >
                  <div
                    className="model-card-drag"
                    style={{
                      padding: "0.875rem 1rem",
                      backgroundColor: "#f8fafc",
                      borderBottom: "1px solid var(--mb-color-border-card)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "grab",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Database size={16} color="var(--mb-color-brand)" />
                      <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--mb-color-text-primary)" }}>
                        {table.display_name}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => openScriptEditor(table)}
                        title={table.script ? "Edit table script" : "Add a Python script to this table"}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.2rem",
                          fontSize: "0.6875rem",
                          fontWeight: 600,
                          padding: "0.125rem 0.45rem",
                          borderRadius: "9999px",
                          border: "1px solid #cbd5e1",
                          backgroundColor: "#ffffff",
                          color: "#475569",
                          cursor: "pointer",
                        }}
                      >
                        <Code2 size={10} /> Script
                      </button>

                      {table.script && (
                        <button
                          type="button"
                          onClick={() => handleRefreshTable(table)}
                          disabled={refreshingId === table.id}
                          title="Re-run the script and replace this table's data"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.2rem",
                            fontSize: "0.6875rem",
                            fontWeight: 600,
                            padding: "0.125rem 0.45rem",
                            borderRadius: "9999px",
                            border: "1px solid #cbd5e1",
                            backgroundColor: "#ffffff",
                            color: "#475569",
                            cursor: refreshingId === table.id ? "not-allowed" : "pointer",
                          }}
                        >
                          <RefreshCw
                            size={10}
                            style={{ animation: refreshingId === table.id ? "spin 1s linear infinite" : undefined }}
                          />
                          Refresh
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => openColumnModal(table)}
                        title="Add a calculated column to this table"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.2rem",
                          fontSize: "0.6875rem",
                          fontWeight: 600,
                          padding: "0.125rem 0.45rem",
                          borderRadius: "9999px",
                          border: "1px dashed #cbd5e1",
                          backgroundColor: "#ffffff",
                          color: "var(--mb-color-brand)",
                          cursor: "pointer",
                        }}
                      >
                        <Plus size={10} /> Column
                      </button>

                      {table.role === "helper" && (
                        <span
                          style={{
                            fontSize: "0.625rem",
                            fontWeight: 700,
                            padding: "0.125rem 0.45rem",
                            borderRadius: "9999px",
                            backgroundColor: "rgba(249, 212, 92, 0.25)",
                            color: "#92400e",
                            textTransform: "uppercase",
                            letterSpacing: "0.03em",
                          }}
                        >
                          Helper · Independent
                        </span>
                      )}

                      <span
                        style={{
                          fontSize: "0.6875rem",
                          fontWeight: 600,
                          padding: "0.125rem 0.5rem",
                          borderRadius: "9999px",
                          backgroundColor: (table.origin || "upload") === "upload" ? "rgba(80, 158, 227, 0.12)" : "rgba(136, 191, 77, 0.15)",
                          color: (table.origin || "upload") === "upload" ? "var(--mb-color-brand)" : "var(--mb-color-success)",
                        }}
                      >
                        {ORIGIN_LABELS[table.origin || "upload"] || "Table"}
                      </span>
                    </div>
                  </div>

                  <div style={{ padding: "0.5rem 1rem", borderBottom: "1px solid #f1f5f9", fontSize: "0.6875rem", color: "#64748b" }}>
                    Rows: <strong>{table.row_count.toLocaleString()}</strong> | Columns: <strong>{table.columns.length}</strong>
                  </div>

                  <div style={{ padding: "0.5rem 0.75rem", flex: 1, minHeight: 0, overflowY: "auto" }}>
                    {table.columns.map((col) => {
                      let Icon = Type;
                      let iconColor = "#94a3b8";
                      if (col.semantic_type === "measure") {
                        Icon = Hash;
                        iconColor = "var(--mb-accent-1)";
                      } else if (col.semantic_type === "date") {
                        Icon = Calendar;
                        iconColor = "var(--mb-color-brand)";
                      }

                      const isKeyColumn = keyColumns.has(`${table.id}.${col.name}`);
                      const isActiveDrop =
                        !!dragKey &&
                        dragKey.tableId !== table.id &&
                        dropTarget?.tableId === table.id &&
                        dropTarget?.column === col.name;

                      return (
                        <div
                          key={col.name}
                          data-dontdrag="true"
                          data-table-id={table.id}
                          data-column={col.name}
                          onMouseDown={(e) => {
                            if (e.button !== 0) return;
                            e.preventDefault();
                            e.stopPropagation();
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setDragKey({ tableId: table.id, column: col.name });
                            setLinkOrigin({ x: rect.right - 10, y: rect.top + rect.height / 2 });
                            setPointer({ x: e.clientX, y: e.clientY });
                          }}
                          title={
                            dragKey && dragKey.tableId !== table.id
                              ? `Drop to link ${col.name}`
                              : "Drag this column onto another table's column to create a relationship"
                          }
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "0.375rem 0.5rem",
                            borderRadius: "4px",
                            fontSize: "0.75rem",
                            cursor: isLinking ? "progress" : "grab",
                            backgroundColor: isActiveDrop ? "rgba(80, 158, 227, 0.12)" : undefined,
                            outline: isActiveDrop ? "2px dashed var(--mb-color-brand)" : undefined,
                            outlineOffset: isActiveDrop ? "-2px" : undefined,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                            <Icon size={12} color={iconColor} />
                            <span style={{ fontWeight: 500, color: "#1e293b" }}>{col.name}</span>
                            {isKeyColumn && (
                              <span title="Relationship key" style={{ display: "inline-flex" }}><Key size={11} color="#d97706" /></span>
                            )}
                          </div>
                          <span style={{ fontSize: "0.6875rem", color: "#94a3b8" }}>{col.data_type}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                </div>
              ))}
              </ModelAutoWidthGrid>
            </div>
          </div>
        </>
      )}

      {/* ================= SAVED METRICS (MEASURES) ================= */}
      {activeTab === "metrics" && (
        <>
          <div
            style={{
              background: "linear-gradient(135deg, rgba(80,158,227,0.06) 0%, rgba(136,191,77,0.06) 100%)",
              border: "1px solid var(--mb-color-border-card)",
              borderRadius: "var(--mb-radius-card)",
              padding: "1.25rem 1.5rem",
              boxShadow: "var(--mb-shadow-card)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                <Star size={18} color="var(--mb-color-brand)" />
                <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--mb-color-text-primary)" }}>
                  Dashboard Metrics (Measures)
                </h3>
              </div>
              <p style={{ fontSize: "0.8125rem", color: "var(--mb-color-text-muted)", maxWidth: "680px" }}>
                Metrics are reusable, dynamic calculation recipes (not table columns). Define one here, then pick it
                directly from the Y-Axis picker in the Visual Card Builder. Changing a metric updates every card using it.
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenMetricModal}
              disabled={tables.length === 0}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.375rem",
                padding: "0.5rem 1rem",
                borderRadius: "var(--mb-radius-btn)",
                border: "none",
                backgroundColor: "var(--mb-color-brand)",
                color: "#ffffff",
                fontSize: "0.8125rem",
                fontWeight: 600,
                cursor: tables.length === 0 ? "not-allowed" : "pointer",
                boxShadow: "0 1px 2px rgba(80, 158, 227, 0.3)",
                flexShrink: 0,
              }}
            >
              <Plus size={14} />
              Define New Metric
            </button>
          </div>

          {metrics.length === 0 ? (
            <div
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "var(--mb-radius-card)",
                border: "1px dashed #cbd5e1",
                padding: "3.5rem 2rem",
                textAlign: "center",
              }}
            >
              <Calculator size={32} color="var(--mb-color-brand)" style={{ margin: "0 auto 0.75rem auto", opacity: 0.7 }} />
              <h4 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--mb-color-text-primary)", marginBottom: "0.375rem" }}>
                No Metrics Defined Yet
              </h4>
              <p style={{ fontSize: "0.8125rem", color: "var(--mb-color-text-muted)", maxWidth: "520px", margin: "0 auto 1rem auto" }}>
                Create your first measure — for example <code>sum(amount)</code> for Total Volume, or a ratio like{" "}
                <code>sum(is_fraud) / count() × 100</code> for Fraud Rate.
              </p>
              <button
                type="button"
                onClick={handleOpenMetricModal}
                disabled={tables.length === 0}
                style={{
                  backgroundColor: "var(--mb-color-brand)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "var(--mb-radius-btn)",
                  padding: "0.4375rem 1rem",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  cursor: tables.length === 0 ? "not-allowed" : "pointer",
                }}
              >
                + Define First Metric
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1.25rem" }}>
              {metrics.map((metric) => {
                const tbl = tables.find((t) => t.id === metric.table_id);
                const badge = formatBadge[metric.format_type] || formatBadge.number;
                return (
                  <div
                    key={metric.id}
                    style={{
                      backgroundColor: "#ffffff",
                      borderRadius: "var(--mb-radius-card)",
                      border: "1px solid var(--mb-color-border-card)",
                      boxShadow: "var(--mb-shadow-card)",
                      padding: "1rem 1.125rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <Star size={14} color="var(--mb-color-brand)" fill="rgba(80,158,227,0.25)" />
                        <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--mb-color-text-primary)" }}>
                          {metric.name}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                        <span
                          style={{
                            fontSize: "0.625rem",
                            fontWeight: 700,
                            padding: "0.125rem 0.4rem",
                            borderRadius: "9999px",
                            color: badge.color,
                            backgroundColor: badge.bg,
                            textTransform: "uppercase",
                            letterSpacing: "0.03em",
                          }}
                        >
                          {badge.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteMetric(metric.id)}
                          title="Delete Metric"
                          style={{ background: "transparent", border: "none", cursor: "pointer", color: "#94a3b8", padding: "2px" }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = "#dc2626")}
                          onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {metric.description && (
                      <p style={{ fontSize: "0.75rem", color: "var(--mb-color-text-muted)", lineHeight: 1.4 }}>
                        {metric.description}
                      </p>
                    )}

                    <div
                      style={{
                        fontFamily: "var(--mb-font-mono)",
                        fontSize: "0.75rem",
                        backgroundColor: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: "4px",
                        padding: "0.375rem 0.5rem",
                        color: "#1e293b",
                        overflowX: "auto",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {describeMetric(metric)}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginTop: "auto", paddingTop: "0.25rem" }}>
                      <Database size={11} color="#94a3b8" />
                      <span style={{ fontSize: "0.6875rem", color: "#64748b" }}>
                        Table: <strong>{tbl?.display_name || metric.table_id}</strong>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ================= NEW DERIVED TABLE MODAL ================= */}
      {showTableModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "1rem",
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "var(--mb-radius-card)",
              padding: "1.5rem",
              width: "480px",
              maxWidth: "95vw",
              boxShadow: "var(--mb-shadow-dropdown)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, color: "var(--mb-color-text-primary)" }}>
                New Derived Table (Model)
              </h3>
              <button
                type="button"
                onClick={() => setShowTableModal(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748b" }}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--mb-color-text-muted)", marginBottom: "1rem" }}>
              Aggregate a base table into a new first-class table. It persists as Parquet and becomes available to every card.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.25rem" }}>
                  New Table Name:
                </label>
                <input
                  type="text"
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  placeholder="e.g. brand_monthly_totals"
                  style={{ width: "100%", padding: "0.4rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8125rem" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.25rem" }}>
                  Base Table:
                </label>
                <select
                  value={baseTableId}
                  onChange={(e) => {
                    setBaseTableId(e.target.value);
                    const t = tables.find((x) => x.id === e.target.value);
                    setGroupByCol(t?.columns.find((c) => c.semantic_type !== "measure")?.name || "");
                    setMeasureCol(t?.columns.find((c) => c.semantic_type === "measure")?.name || "");
                  }}
                  style={{ width: "100%", padding: "0.4rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8125rem" }}
                >
                  {tables
                    .filter((t) => t.role !== "helper")
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.display_name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.25rem" }}>
                  Group By (Dimension):
                </label>
                <select
                  value={groupByCol}
                  onChange={(e) => setGroupByCol(e.target.value)}
                  style={{ width: "100%", padding: "0.4rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8125rem" }}
                >
                  <option value="">-- No grouping (single row) --</option>
                  {renderColumnOptions(tables.find((t) => t.id === baseTableId), false)}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "0.5rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.25rem" }}>
                    Measure Column:
                  </label>
                  <select
                    value={measureCol}
                    onChange={(e) => setMeasureCol(e.target.value)}
                    style={{ width: "100%", padding: "0.4rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8125rem" }}
                  >
                    <option value="">-- None --</option>
                    {renderColumnOptions(tables.find((t) => t.id === baseTableId), true)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.25rem" }}>
                    Aggregation:
                  </label>
                  <select
                    value={measureAgg}
                    onChange={(e) => setMeasureAgg(e.target.value)}
                    style={{ width: "100%", padding: "0.4rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8125rem" }}
                  >
                    {AGGREGATIONS.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div
                style={{
                  fontSize: "0.75rem",
                  fontFamily: "var(--mb-font-mono)",
                  backgroundColor: "rgba(80,158,227,0.06)",
                  border: "1px dashed rgba(80,158,227,0.4)",
                  borderRadius: "4px",
                  padding: "0.5rem 0.625rem",
                  color: "#1e293b",
                  overflowX: "auto",
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ color: "#64748b", fontWeight: 600, fontFamily: "var(--mb-font-sans)" }}>Preview query: </span>
                SELECT {groupByCol ? groupByCol : "1"} {measureCol ? `, ${measureAgg}(${measureCol})` : ""} FROM{" "}
                {tables.find((t) => t.id === baseTableId)?.display_name || "?"}
                {groupByCol ? ` GROUP BY ${groupByCol}` : ""}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1.25rem" }}>
              <button
                type="button"
                onClick={() => setShowTableModal(false)}
                disabled={isSavingModel}
                style={{ padding: "0.375rem 0.875rem", borderRadius: "4px", border: "1px solid #cbd5e1", background: "#ffffff", fontSize: "0.8125rem" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateModelTable}
                disabled={isSavingModel || !newTableName.trim() || !baseTableId || (!groupByCol && !measureCol)}
                style={{
                  padding: "0.375rem 1rem",
                  borderRadius: "4px",
                  border: "none",
                  backgroundColor: "var(--mb-color-brand)",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: "0.8125rem",
                  cursor: isSavingModel ? "not-allowed" : "pointer",
                }}
              >
                {isSavingModel ? "Creating..." : "Create Table"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= NEW CALCULATED COLUMN MODAL ================= */}
      {showColumnModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "1rem",
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "var(--mb-radius-card)",
              padding: "1.5rem",
              width: "480px",
              maxWidth: "95vw",
              boxShadow: "var(--mb-shadow-dropdown)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, color: "var(--mb-color-text-primary)" }}>
                Add Calculated Column
              </h3>
              <button
                type="button"
                onClick={() => setShowColumnModal(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748b" }}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--mb-color-text-muted)", marginBottom: "1rem" }}>
              Compute a new row-level column on{" "}
              <strong>{tables.find((t) => t.id === columnTableId)?.display_name || "table"}</strong> using an expression.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.25rem" }}>
                  Column Name:
                </label>
                <input
                  type="text"
                  value={columnName}
                  onChange={(e) => setColumnName(e.target.value)}
                  placeholder="e.g. amount_per_card"
                  style={{ width: "100%", padding: "0.4rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8125rem" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.25rem" }}>
                  Expression:
                </label>
                <input
                  type="text"
                  value={columnExpr}
                  onChange={(e) => setColumnExpr(e.target.value)}
                  placeholder="e.g. credit_limit / num_cards_issued"
                  style={{
                    width: "100%",
                    padding: "0.4rem",
                    borderRadius: "4px",
                    border: "1px solid #cbd5e1",
                    fontFamily: "var(--mb-font-mono)",
                    fontSize: "0.8125rem",
                  }}
                />
                <div style={{ fontSize: "0.6875rem", color: "#94a3b8", marginTop: "0.25rem" }}>
                  Supports numbers, column names, parentheses, <code>+ - * / % **</code>, <code>abs(x)</code>, and{" "}
                  <code>round(x, n)</code>.
                </div>
              </div>

              <div style={{ fontSize: "0.6875rem", color: "#64748b", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "4px", padding: "0.5rem 0.625rem" }}>
                Available columns:{" "}
                <span style={{ fontFamily: "var(--mb-font-mono)" }}>
                  {(tables.find((t) => t.id === columnTableId)?.columns || [])
                    .filter((c) => c.semantic_type === "measure")
                    .map((c) => c.name)
                    .join(", ") || "(no numeric columns)"}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1.25rem" }}>
              <button
                type="button"
                onClick={() => setShowColumnModal(false)}
                disabled={isSavingModel}
                style={{ padding: "0.375rem 0.875rem", borderRadius: "4px", border: "1px solid #cbd5e1", background: "#ffffff", fontSize: "0.8125rem" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddColumn}
                disabled={isSavingModel || !columnName.trim() || !columnExpr.trim()}
                style={{
                  padding: "0.375rem 1rem",
                  borderRadius: "4px",
                  border: "none",
                  backgroundColor: "var(--mb-color-brand)",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: "0.8125rem",
                  cursor: isSavingModel ? "not-allowed" : "pointer",
                }}
              >
                {isSavingModel ? "Adding..." : "Add Column"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= NEW EMPTY TABLE MODAL ================= */}
      {showEmptyModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "1rem",
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "var(--mb-radius-card)",
              padding: "1.5rem",
              width: "500px",
              maxWidth: "95vw",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "var(--mb-shadow-dropdown)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, color: "var(--mb-color-text-primary)" }}>
                New Empty Table
              </h3>
              <button
                type="button"
                onClick={() => setShowEmptyModal(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748b" }}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--mb-color-text-muted)", marginBottom: "1rem" }}>
              Creates a zero-row table with a declared schema. Fill or modify it later with a Python script
              (the <strong>Script</strong> button on the table card). Helper tables are independent and excluded from
              derived-table base pickers.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.25rem" }}>
                  Table Name:
                </label>
                <input
                  type="text"
                  value={emptyName}
                  onChange={(e) => setEmptyName(e.target.value)}
                  placeholder="e.g. sort_order"
                  style={{ width: "100%", padding: "0.4rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8125rem" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.25rem" }}>
                  Table Role:
                </label>
                <select
                  value={emptyRole}
                  onChange={(e) => setEmptyRole(e.target.value as "data" | "helper")}
                  style={{ width: "100%", padding: "0.4rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8125rem" }}
                >
                  <option value="helper">Helper (independent, not auto-linked)</option>
                  <option value="data">Data (participates in modeling)</option>
                </select>
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.375rem" }}>
                  <label style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569" }}>Columns:</label>
                  <button
                    type="button"
                    onClick={() => setEmptyColumns((prev) => [...prev, { name: "", dtype: "string" }])}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.2rem",
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      color: "var(--mb-color-brand)",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    <Plus size={11} /> Add Column
                  </button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                  {emptyColumns.map((col, idx) => (
                    <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 130px 28px", gap: "0.375rem" }}>
                      <input
                        type="text"
                        value={col.name}
                        onChange={(e) =>
                          setEmptyColumns((prev) =>
                            prev.map((c, i) => (i === idx ? { ...c, name: e.target.value } : c))
                          )
                        }
                        placeholder="column_name"
                        style={{ padding: "0.35rem 0.4rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8125rem" }}
                      />
                      <select
                        value={col.dtype}
                        onChange={(e) =>
                          setEmptyColumns((prev) =>
                            prev.map((c, i) => (i === idx ? { ...c, dtype: e.target.value } : c))
                          )
                        }
                        style={{ padding: "0.35rem 0.4rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8125rem" }}
                      >
                        {COLUMN_DTYPES.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setEmptyColumns((prev) => prev.filter((_, i) => i !== idx))}
                        disabled={emptyColumns.length === 1}
                        title="Remove column"
                        style={{
                          background: "transparent",
                          border: "none",
                          cursor: emptyColumns.length === 1 ? "not-allowed" : "pointer",
                          color: "#dc2626",
                          opacity: emptyColumns.length === 1 ? 0.4 : 1,
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1.25rem" }}>
              <button
                type="button"
                onClick={() => setShowEmptyModal(false)}
                disabled={isSavingModel}
                style={{ padding: "0.375rem 0.875rem", borderRadius: "4px", border: "1px solid #cbd5e1", background: "#ffffff", fontSize: "0.8125rem" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateEmpty}
                disabled={
                  isSavingModel ||
                  !emptyName.trim() ||
                  emptyColumns.filter((c) => c.name.trim()).length === 0
                }
                style={{
                  padding: "0.375rem 1rem",
                  borderRadius: "4px",
                  border: "none",
                  backgroundColor: "var(--mb-color-brand)",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: "0.8125rem",
                  cursor: isSavingModel ? "not-allowed" : "pointer",
                }}
              >
                {isSavingModel ? "Creating..." : "Create Empty Table"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= PYTHON TABLE / SCRIPT MODAL ================= */}
      {showScriptModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "1rem",
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "var(--mb-radius-card)",
              padding: "1.5rem",
              width: "720px",
              maxWidth: "95vw",
              maxHeight: "92vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "var(--mb-shadow-dropdown)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, color: "var(--mb-color-text-primary)" }}>
                {scriptTableId ? `Table Script — ${scriptName}` : "New Python Table"}
              </h3>
              <button
                type="button"
                onClick={() => setShowScriptModal(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748b" }}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--mb-color-text-muted)", marginBottom: "0.875rem" }}>
              Runs in the workspace Python runtime. Assign the output DataFrame to <code>result</code> (Polars or pandas).
              All dashboard tables are pre-loaded by name, and <code>df</code> is the first table.
              {scriptTableId ? " The table's current snapshot is also in scope under its own name." : ""}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: scriptTableId ? "1fr 170px" : "1fr 170px", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.25rem" }}>
                  Table Name:
                </label>
                <input
                  type="text"
                  value={scriptName}
                  onChange={(e) => setScriptName(e.target.value)}
                  disabled={!!scriptTableId}
                  placeholder="e.g. brand_summary"
                  style={{
                    width: "100%",
                    padding: "0.4rem",
                    borderRadius: "4px",
                    border: "1px solid #cbd5e1",
                    fontSize: "0.8125rem",
                    backgroundColor: scriptTableId ? "#f1f5f9" : "#ffffff",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.25rem" }}>
                  Role:
                </label>
                <select
                  value={scriptRole}
                  onChange={(e) => setScriptRole(e.target.value as "data" | "helper")}
                  style={{ width: "100%", padding: "0.4rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8125rem" }}
                >
                  <option value="data">Data</option>
                  <option value="helper">Helper (independent)</option>
                </select>
              </div>
            </div>

            <div
              style={{
                flex: 1,
                minHeight: "220px",
                border: "1px solid #cbd5e1",
                borderRadius: "4px",
                overflow: "hidden",
              }}
            >
              <CodeMirror
                value={scriptText}
                height="240px"
                extensions={[python()]}
                onChange={(val) => setScriptText(val)}
                theme={vscodeLight}
                basicSetup={{ lineNumbers: true, bracketMatching: true, autocompletion: true, foldGutter: false }}
              />
            </div>

            {scriptError && (
              <div
                style={{
                  marginTop: "0.75rem",
                  padding: "0.5rem 0.625rem",
                  borderRadius: "4px",
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#b91c1c",
                  fontSize: "0.75rem",
                  fontFamily: "var(--mb-font-mono)",
                  whiteSpace: "pre-wrap",
                  maxHeight: "120px",
                  overflowY: "auto",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontWeight: 700, marginBottom: "0.2rem" }}>
                  <AlertCircle size={12} /> Script error
                </div>
                {scriptError}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
              <button
                type="button"
                onClick={() => setShowScriptModal(false)}
                disabled={isRunningScript}
                style={{ padding: "0.375rem 0.875rem", borderRadius: "4px", border: "1px solid #cbd5e1", background: "#ffffff", fontSize: "0.8125rem" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveScript}
                disabled={isRunningScript || !scriptText.trim() || (!scriptTableId && !scriptName.trim())}
                style={{
                  padding: "0.375rem 1rem",
                  borderRadius: "4px",
                  border: "none",
                  backgroundColor: "var(--mb-color-brand)",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: "0.8125rem",
                  cursor: isRunningScript ? "not-allowed" : "pointer",
                }}
              >
                {isRunningScript ? "Running..." : scriptTableId ? "Save & Run" : "Run & Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Relationship drag line overlay */}
      {dragKey && linkOrigin && pointer && (
        <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999 }}>
          <svg width="100%" height="100%">
            <line
              x1={linkOrigin.x}
              y1={linkOrigin.y}
              x2={pointer.x}
              y2={pointer.y}
              stroke="var(--mb-color-brand)"
              strokeWidth="2"
              strokeDasharray="5 4"
            />
            <circle cx={pointer.x} cy={pointer.y} r="4" fill="var(--mb-color-brand)" />
            <circle cx={linkOrigin.x} cy={linkOrigin.y} r="3" fill="var(--mb-color-brand)" />
          </svg>
        </div>
      )}

      {/* ================= DEFINE METRIC MODAL ================= */}
      {showMetricModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "1rem",
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "var(--mb-radius-card)",
              padding: "1.5rem",
              width: "520px",
              maxWidth: "95vw",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "var(--mb-shadow-dropdown)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <h3 style={{ fontSize: "1.0625rem", fontWeight: 700, color: "var(--mb-color-text-primary)" }}>
                Define New Metric (Measure)
              </h3>
              <button
                type="button"
                onClick={() => setShowMetricModal(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748b" }}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--mb-color-text-muted)", marginBottom: "1rem" }}>
              A Metric is a reusable calculation recipe. It is not a table column — it dynamically evaluates against
              whatever dimensions and filters are applied on the dashboard.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.25rem" }}>
                  Metric Name:
                </label>
                <input
                  type="text"
                  value={metricName}
                  onChange={(e) => setMetricName(e.target.value)}
                  placeholder="e.g. Total Volume, Fraud Loss Rate"
                  style={{ width: "100%", padding: "0.4rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8125rem" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.25rem" }}>
                  Description (Optional):
                </label>
                <input
                  type="text"
                  value={metricDesc}
                  onChange={(e) => setMetricDesc(e.target.value)}
                  placeholder="Business definition of this metric..."
                  style={{ width: "100%", padding: "0.4rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8125rem" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.25rem" }}>
                  Base Table:
                </label>
                <select
                  value={metricTableId}
                  onChange={(e) => {
                    setMetricTableId(e.target.value);
                    const t = tables.find((x) => x.id === e.target.value);
                    setMetricColumn(t?.columns.find((c) => c.semantic_type === "measure")?.name || t?.columns[0]?.name || "");
                    setNumColumn(t?.columns[0]?.name || "");
                    setDenomColumn("");
                  }}
                  style={{ width: "100%", padding: "0.4rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8125rem" }}
                >
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.display_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.25rem" }}>
                  Formula Type:
                </label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={() => setFormulaType("simple_agg")}
                    style={{
                      flex: 1,
                      padding: "0.4rem",
                      borderRadius: "4px",
                      border: formulaType === "simple_agg" ? "1.5px solid var(--mb-color-brand)" : "1px solid #cbd5e1",
                      backgroundColor: formulaType === "simple_agg" ? "rgba(80,158,227,0.08)" : "#ffffff",
                      color: formulaType === "simple_agg" ? "var(--mb-color-brand)" : "#475569",
                      fontWeight: 600,
                      fontSize: "0.75rem",
                      cursor: "pointer",
                    }}
                  >
                    Simple Aggregation
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormulaType("ratio")}
                    style={{
                      flex: 1,
                      padding: "0.4rem",
                      borderRadius: "4px",
                      border: formulaType === "ratio" ? "1.5px solid var(--mb-color-brand)" : "1px solid #cbd5e1",
                      backgroundColor: formulaType === "ratio" ? "rgba(80,158,227,0.08)" : "#ffffff",
                      color: formulaType === "ratio" ? "var(--mb-color-brand)" : "#475569",
                      fontWeight: 600,
                      fontSize: "0.75rem",
                      cursor: "pointer",
                    }}
                  >
                    Ratio / Rate
                  </button>
                </div>
              </div>

              {formulaType === "simple_agg" && (
                <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "0.5rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.25rem" }}>
                      Column:
                    </label>
                    <select
                      value={metricColumn}
                      onChange={(e) => setMetricColumn(e.target.value)}
                      style={{ width: "100%", padding: "0.4rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8125rem" }}
                    >
                      {renderColumnOptions(metricTableObj, true)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.25rem" }}>
                      Aggregation:
                    </label>
                    <select
                      value={metricAgg}
                      onChange={(e) => setMetricAgg(e.target.value)}
                      style={{ width: "100%", padding: "0.4rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8125rem" }}
                    >
                      {AGGREGATIONS.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {formulaType === "ratio" && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "6px",
                    padding: "0.75rem",
                  }}
                >
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#334155" }}>Numerator:</span>
                  <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "0.5rem" }}>
                    <select
                      value={numColumn}
                      onChange={(e) => setNumColumn(e.target.value)}
                      style={{ padding: "0.4rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8125rem" }}
                    >
                      {renderColumnOptions(metricTableObj, false)}
                    </select>
                    <select
                      value={numAgg}
                      onChange={(e) => setNumAgg(e.target.value)}
                      style={{ padding: "0.4rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8125rem" }}
                    >
                      {RATIO_AGGS.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginTop: "0.25rem" }}>Denominator:</span>
                  <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "0.5rem" }}>
                    <select
                      value={denomColumn}
                      onChange={(e) => setDenomColumn(e.target.value)}
                      style={{ padding: "0.4rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8125rem" }}
                    >
                      <option value="">-- Same as Numerator Column --</option>
                      {renderColumnOptions(metricTableObj, false)}
                    </select>
                    <select
                      value={denomAgg}
                      onChange={(e) => setDenomAgg(e.target.value)}
                      style={{ padding: "0.4rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8125rem" }}
                    >
                      {RATIO_AGGS.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#475569" }}>Multiplier:</span>
                    <input
                      type="number"
                      value={multiplier}
                      onChange={(e) => setMultiplier(Number(e.target.value))}
                      style={{ width: "90px", padding: "0.3rem 0.4rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8125rem" }}
                    />
                    <span style={{ fontSize: "0.6875rem", color: "#94a3b8" }}>
                      (use 100 for percentages)
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.25rem" }}>
                  Display Format:
                </label>
                <select
                  value={formatType}
                  onChange={(e) => setFormatType(e.target.value as "number" | "currency" | "percentage")}
                  style={{ width: "100%", padding: "0.4rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8125rem" }}
                >
                  {FORMAT_TYPES.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Live formula preview */}
              <div
                style={{
                  fontSize: "0.75rem",
                  fontFamily: "var(--mb-font-mono)",
                  backgroundColor: "rgba(80,158,227,0.06)",
                  border: "1px dashed rgba(80,158,227,0.4)",
                  borderRadius: "4px",
                  padding: "0.5rem 0.625rem",
                  color: "#1e293b",
                  overflowX: "auto",
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ color: "#64748b", fontWeight: 600, fontFamily: "var(--mb-font-sans)" }}>Formula preview: </span>
                {formulaType === "simple_agg"
                  ? metricAgg === "count_distinct"
                    ? `count_distinct(${metricColumn || "?"})`
                    : `${metricAgg}(${metricColumn || "?"})`
                  : `${numAgg === "count" ? `count(${numColumn || "?"})` : `sum(${numColumn || "?"})`} / ${
                      denomAgg === "count" ? "count()" : `sum(${denomColumn || numColumn || "?"})`
                    } × ${multiplier}`}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1.25rem" }}>
              <button
                type="button"
                onClick={() => setShowMetricModal(false)}
                disabled={isSavingMetric}
                style={{ padding: "0.375rem 0.875rem", borderRadius: "4px", border: "1px solid #cbd5e1", background: "#ffffff", fontSize: "0.8125rem" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveMetric}
                disabled={
                  isSavingMetric ||
                  !metricName.trim() ||
                  !metricTableId ||
                  (formulaType === "simple_agg" && !metricColumn) ||
                  (formulaType === "ratio" && !numColumn)
                }
                style={{
                  padding: "0.375rem 1rem",
                  borderRadius: "4px",
                  border: "none",
                  backgroundColor: "var(--mb-color-brand)",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: "0.8125rem",
                  cursor: isSavingMetric ? "not-allowed" : "pointer",
                }}
              >
                {isSavingMetric ? "Saving Metric..." : "Save Metric"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
