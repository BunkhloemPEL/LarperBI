import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  X,
  PieChart,
  LineChart,
  BarChart,
  Hash,
  Activity,
  Layers,
  Sparkles,
  Columns,
} from "lucide-react";
import { runQuery, createCard, updateCard } from "../../services/api";
import type { TableItem, CardConfig, QueryResult, CardItem, MetricItem, RelationshipItem } from "../../types/larper";
import type { SmartScalarItem, CardBreakdownItem } from "../../types/dashboard";

// Import our replicated visual components
import {
  SmartScalar,
  DonutChart,
  CartesianChart,
  WaterfallChart,
  FunnelChart,
  GaugeChart,
  ProgressBar,
  TreemapChart,
  buildGenericBarOption,
  buildGenericRowOption,
  buildGenericLineOption,
  type WaterfallStep,
  type FunnelStep,
  type TreemapNode,
} from "../metabase-viz";
import { ChartErrorBoundary } from "../metabase-viz/ChartErrorBoundary";

export interface CardBuilderModalProps {
  dashboardId: string;
  tables: TableItem[];
  relationships?: RelationshipItem[];
  metrics?: MetricItem[];
  isOpen: boolean;
  onClose: () => void;
  onCardCreated: () => void;
  editingCard?: CardItem | null;
}

const VIZ_TYPES = [
  { id: "donut", label: "Donut / Pie Chart", icon: PieChart },
  { id: "bar", label: "Bar Chart", icon: BarChart },
  { id: "row", label: "Row Chart (Horizontal)", icon: Columns },
  { id: "line", label: "Line / Area Chart", icon: LineChart },
  { id: "smart_scalar", label: "SmartScalar (KPI)", icon: Hash },
  { id: "waterfall", label: "Waterfall Bridge", icon: Activity },
  { id: "funnel", label: "Funnel Progression", icon: Layers },
  { id: "gauge", label: "Risk Gauge Dial", icon: Activity },
  { id: "progress", label: "Progress Bar", icon: Sparkles },
  { id: "treemap", label: "Treemap Area Tiles", icon: Layers },
];

export const CardBuilderModal: React.FC<CardBuilderModalProps> = ({
  dashboardId,
  tables,
  relationships = [],
  metrics = [],
  isOpen,
  onClose,
  onCardCreated,
  editingCard,
}) => {

  const [selectedTableId, setSelectedTableId] = useState<string>(editingCard?.table_id || tables[0]?.id || "");
  const [vizType, setVizType] = useState<string>(editingCard?.viz_type || "donut");
  const [title, setTitle] = useState<string>(editingCard?.title || "New Visual Card");

  // Field selections
  const [selectedDim, setSelectedDim] = useState<string>(editingCard?.config.dimensions[0]?.column || "");
  const [dateGrain, setDateGrain] = useState<"year" | "month" | "day">(editingCard?.config.dimensions[0]?.date_grain || "month");
  const [selectedMeas, setSelectedMeas] = useState<string>(editingCard?.config.measures[0]?.column || "");
  const [aggregation, setAggregation] = useState<"sum" | "avg" | "count" | "min" | "max">(
    (editingCard?.config.measures[0]?.aggregation as "sum" | "avg" | "count" | "min" | "max") || "sum"
  );
  const [selectedMetricId, setSelectedMetricId] = useState<string>(editingCard?.config.measures[0]?.metric_id || "");
  // Query & Preview states
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const selectedTable = tables.find((t) => t.id === selectedTableId) || tables[0];

  // Find joined tables via star-schema relationships
  const joinedTables = useMemo(() => {
    if (!relationships || !selectedTableId) return [];
    const linkedIds = new Set<string>();
    relationships.forEach((rel) => {
      if (rel.from_table_id === selectedTableId) {
        linkedIds.add(rel.to_table_id);
      } else if (rel.to_table_id === selectedTableId) {
        linkedIds.add(rel.from_table_id);
      }
    });
    return tables.filter((t) => linkedIds.has(t.id));
  }, [relationships, selectedTableId, tables]);

  const allAvailableColumns = useMemo(() => [
    ...(selectedTable?.columns || []),
    ...joinedTables.flatMap((jt) => jt.columns),
  ], [selectedTable, joinedTables]);
  // Saved metrics available for the selected table
  const availableMetrics = metrics.filter((m) => m.table_id === selectedTableId);
  const activeMetric = availableMetrics.find((m) => m.id === selectedMetricId);

  // Populate fields when editingCard changes or modal opens
  useEffect(() => {
    if (editingCard) {
      setSelectedTableId(editingCard.table_id);
      setVizType(editingCard.viz_type);
      setTitle(editingCard.title);
      setSelectedDim(editingCard.config.dimensions[0]?.column || "");
      setDateGrain(editingCard.config.dimensions[0]?.date_grain || "month");
      setSelectedMeas(editingCard.config.measures[0]?.column || "");
      setSelectedMetricId(editingCard.config.measures[0]?.metric_id || "");
      setAggregation(
        (editingCard.config.measures[0]?.aggregation as "sum" | "avg" | "count" | "min" | "max") || "sum"
      );
    } else {
      setTitle("New Visual Card");
      setVizType("donut");
      setSelectedMetricId("");
      if (selectedTable) {
        const dimCol = selectedTable.columns.find((c) => c.semantic_type !== "measure") || selectedTable.columns[0];
        const measCol = selectedTable.columns.find((c) => c.semantic_type === "measure") || selectedTable.columns[1];
        if (dimCol) setSelectedDim(dimCol.name);
        if (measCol) setSelectedMeas(measCol.name);
      }
    }
  }, [editingCard, selectedTable]);

  // Execute live preview query
  const executePreview = useCallback(async () => {
    if (!selectedTableId) return;
    setIsLoading(true);

    const previewMeasures = selectedMetricId
      ? [{ metric_id: selectedMetricId, alias: metrics.find((m) => m.id === selectedMetricId)?.name }]
      : selectedMeas
        ? [{ column: selectedMeas, aggregation }]
        : [];

    const config: CardConfig = {
      dimensions: selectedDim ? [{ column: selectedDim, date_grain: dateGrain }] : [],
      measures: previewMeasures,
      filters: [],
      limit: 20,
      sort_desc: true,
    };

    try {
      const res = await runQuery(dashboardId, selectedTableId, vizType, config);
      setQueryResult(res);
    } catch (err) {
      console.error("Preview query error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [dashboardId, selectedTableId, vizType, selectedDim, dateGrain, selectedMeas, aggregation, selectedMetricId, metrics]);

  useEffect(() => {
    executePreview();
  }, [executePreview]);

  // Handle visual type change
  const handleVizTypeChange = (newType: string) => {
    setVizType(newType);
    setQueryResult(null); // Clear previous result immediately so incompatible data is never rendered
  };

  // Handle Create Card
  const handleCreate = async () => {
    if (!selectedTableId || !title.trim()) return;
    setIsSubmitting(true);

    const saveMeasures = selectedMetricId
      ? [{ metric_id: selectedMetricId, alias: metrics.find((m) => m.id === selectedMetricId)?.name }]
      : selectedMeas
        ? [{ column: selectedMeas, aggregation }]
        : [];

    const config: CardConfig = {
      dimensions: selectedDim ? [{ column: selectedDim, date_grain: dateGrain }] : [],
      measures: saveMeasures,
      filters: [],
      limit: 30,
      sort_desc: true,
    };

    try {
      if (editingCard) {
        await updateCard(dashboardId, editingCard.id, {
          table_id: selectedTableId,
          viz_type: vizType,
          title: title.trim(),
          config,
        });
      } else {
        await createCard(dashboardId, {
          table_id: selectedTableId,
          viz_type: vizType,
          title: title.trim(),
          config,
          grid_layout: { x: 0, y: 0, w: vizType === "smart_scalar" ? 3 : 6, h: 4 },
        });
      }
      onCardCreated();
      onClose();
    } catch (err: unknown) {
      alert(`Failed to create card: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render the preview component based on query result data
  const renderPreviewContent = () => {
    // If loading or query result does not match current visual type, display loading placeholder
    if (isLoading || !queryResult || queryResult.viz_type !== vizType || !queryResult.data) {
      return (
        <div style={{ color: "#94a3b8", textAlign: "center", padding: "3rem" }}>
          <div style={{ marginBottom: "0.5rem", fontWeight: 600 }}>Calculating visual preview...</div>
          <div style={{ fontSize: "0.75rem" }}>Preparing {VIZ_TYPES.find((v) => v.id === vizType)?.label}...</div>
        </div>
      );
    }

    const { data } = queryResult;
    if (vizType === "smart_scalar") {
      return <SmartScalar data={data as SmartScalarItem} />;
    }
    if (vizType === "donut") {
      return (
        <DonutChart
          data={data as CardBreakdownItem[]}
          height={280}
          centerSubtitle={activeMetric?.name || "Total"}
        />
      );
    }
    if (vizType === "waterfall") {
      return <WaterfallChart data={data as WaterfallStep[]} height={280} />;
    }
    if (vizType === "funnel") {
      return <FunnelChart data={data as FunnelStep[]} height={280} />;
    }
    if (vizType === "gauge") {
      const g = data as { value: number; min: number; max: number; unit: string; title: string };
      return <GaugeChart value={g?.value ?? 0} min={g?.min ?? 0} max={g?.max ?? 100} unit={g?.unit ?? ""} title={g?.title ?? ""} height={280} />;
    }
    if (vizType === "progress") {
      const p = data as { current: number; goal: number; label: string };
      return <ProgressBar current={p?.current ?? 0} goal={p?.goal ?? 100} label={p?.label ?? "Goal Target"} height={280} />;
    }
    if (vizType === "treemap") {
      return <TreemapChart data={data as TreemapNode[]} height={280} />;
    }

    if (vizType === "bar") {
      const c = data as { dimensions: string[]; series: { name: string; data: number[] }[] };
      const opt = buildGenericBarOption(c?.dimensions || [], c?.series || []);
      return <CartesianChart option={opt} height={280} />;
    }

    if (vizType === "row") {
      const c = data as { dimensions: string[]; series: { name: string; data: number[] }[] };
      const opt = buildGenericRowOption(c?.dimensions || [], c?.series || []);
      return <CartesianChart option={opt} height={280} />;
    }

    // Default line / area
    const c = data as { dimensions: string[]; series: { name: string; data: number[] }[] };
    const opt = buildGenericLineOption(c?.dimensions || [], c?.series || [], true);
    return <CartesianChart option={opt} height={280} />;
  };

  if (!isOpen) return null;

  return (
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
          width: "900px",
          maxWidth: "95vw",
          height: "640px",
          display: "flex",
          flexDirection: "column",
          boxShadow: "var(--mb-shadow-dropdown)",
          overflow: "hidden",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "1rem 1.5rem",
            borderBottom: "1px solid var(--mb-color-border-card)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--mb-color-text-primary)" }}>
              {editingCard ? "Edit Visual Card" : "Visual Card Builder"}
            </h3>
            <p style={{ fontSize: "0.75rem", color: "var(--mb-color-text-muted)" }}>
              {editingCard ? "Modify card chart type, dimensions, or aggregations." : "Configure visual parameters with instant live preview."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748b" }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body: Left Config Panel, Right Live Preview */}
        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", flex: 1, minHeight: 0 }}>
          {/* Configuration Form */}
          <div
            style={{
              padding: "1.25rem",
              borderRight: "1px solid var(--mb-color-border-card)",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            {/* Title */}
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.25rem" }}>
                Card Title:
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ width: "100%", padding: "0.4rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8125rem" }}
              />
            </div>

            {/* Source Table */}
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.25rem" }}>
                Source Table:
              </label>
              <select
                value={selectedTableId}
                onChange={(e) => setSelectedTableId(e.target.value)}
                style={{ width: "100%", padding: "0.4rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8125rem" }}
              >
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.display_name} (
                    {t.table_type === "raw_upload"
                      ? "Raw Upload"
                      : t.table_type === "python_script"
                        ? "⚡ Python Table"
                        : t.table_type === "manual"
                          ? "Manual Table"
                          : "⚡ Derived Model"}
                    {t.role === "helper" ? " · Helper" : ""})
                  </option>
                ))}
              </select>
            </div>

            {/* Visual Type Selector */}
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.375rem" }}>
                Visualization Component:
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.375rem" }}>
                {VIZ_TYPES.map((v) => {
                  const Icon = v.icon;
                  const isSelected = vizType === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => handleVizTypeChange(v.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.375rem",
                        padding: "0.4rem 0.5rem",
                        borderRadius: "4px",
                        border: isSelected ? "1.5px solid var(--mb-color-brand)" : "1px solid #e2e8f0",
                        backgroundColor: isSelected ? "rgba(80, 158, 227, 0.08)" : "#ffffff",
                        color: isSelected ? "var(--mb-color-brand)" : "#475569",
                        fontSize: "0.6875rem",
                        fontWeight: isSelected ? 700 : 500,
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <Icon size={12} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {v.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dimension (X-Axis / Category) */}
            {vizType !== "smart_scalar" && vizType !== "gauge" && vizType !== "progress" && (
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.25rem" }}>
                  Category / Dimension (X-Axis):
                </label>
                <select
                  value={selectedDim}
                  onChange={(e) => setSelectedDim(e.target.value)}
                  style={{ width: "100%", padding: "0.4rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8125rem" }}
                >
                  <option value="">-- None --</option>
                  <optgroup label={`${selectedTable?.display_name || "Primary"} (Primary Table)`}>
                    {selectedTable?.columns.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name} ({c.semantic_type})
                      </option>
                    ))}
                  </optgroup>
                  {joinedTables.map((jt) => (
                    <optgroup key={jt.id} label={`${jt.display_name} (Joined Table)`}>
                      {jt.columns.map((c) => (
                        <option key={`${jt.id}.${c.name}`} value={c.name}>
                          {c.name} ({c.semantic_type})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>

                {allAvailableColumns.find((c) => c.name === selectedDim)?.semantic_type === "date" && (
                  <div style={{ marginTop: "0.375rem" }}>
                    <span style={{ fontSize: "0.6875rem", color: "#64748b" }}>Date Bucket:</span>
                    <select
                      value={dateGrain}
                      onChange={(e) => setDateGrain(e.target.value as "year" | "month" | "day")}
                      style={{ marginLeft: "0.5rem", padding: "0.25rem 0.5rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.75rem" }}
                    >
                      <option value="year">Yearly</option>
                      <option value="month">Monthly</option>
                      <option value="day">Daily</option>
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Measure (Y-Axis / Metric) */}
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.25rem" }}>
                Metric / Measure (Y-Axis):
              </label>

              {availableMetrics.length > 0 && (
                <div style={{ marginBottom: "0.375rem" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      fontSize: "0.6875rem",
                      fontWeight: 700,
                      color: "var(--mb-color-brand)",
                      marginBottom: "0.25rem",
                    }}
                  >
                    ★ Saved Metrics
                  </div>
                  <select
                    value={selectedMetricId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setSelectedMetricId(nextId);
                      if (nextId) {
                        const met = availableMetrics.find((m) => m.id === nextId);
                        if (met && (title === "New Visual Card" || !title.trim())) {
                          setTitle(met.name);
                        }
                      }
                    }}
                    style={{
                      width: "100%",
                      padding: "0.4rem",
                      borderRadius: "4px",
                      border: selectedMetricId ? "1.5px solid var(--mb-color-brand)" : "1px solid #cbd5e1",
                      backgroundColor: selectedMetricId ? "rgba(80, 158, 227, 0.06)" : "#ffffff",
                      fontSize: "0.8125rem",
                      fontWeight: selectedMetricId ? 600 : 400,
                      color: selectedMetricId ? "var(--mb-color-brand)" : "#1e293b",
                    }}
                  >
                    <option value="">-- Raw Column Aggregation --</option>
                    {availableMetrics.map((m) => (
                      <option key={m.id} value={m.id}>
                        ★ {m.name} ({m.format_type})
                      </option>
                    ))}
                  </select>

                  {activeMetric && (
                    <div
                      style={{
                        marginTop: "0.3125rem",
                        fontSize: "0.6875rem",
                        color: "#64748b",
                        backgroundColor: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: "4px",
                        padding: "0.3125rem 0.5rem",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.5rem",
                      }}
                    >
                      <span style={{ fontFamily: "var(--mb-font-mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {activeMetric.formula_type === "ratio"
                          ? `${activeMetric.definition.numerator_agg === "count" ? "count()" : `sum(${String(activeMetric.definition.numerator_column)})`} / ${
                              activeMetric.definition.denominator_agg === "count"
                                ? "count()"
                                : `sum(${String(activeMetric.definition.denominator_column)})`
                            } × ${Number(activeMetric.definition.multiplier ?? 100)}`
                          : `${String(activeMetric.definition.aggregation)}(${String(activeMetric.definition.column)})`}
                      </span>
                      <span style={{ flexShrink: 0 }}>Format: {activeMetric.format_type}</span>
                    </div>
                  )}
                </div>
              )}

              {!selectedMetricId && (
                <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "0.375rem" }}>
                  <select
                    value={selectedMeas}
                    onChange={(e) => setSelectedMeas(e.target.value)}
                    style={{ padding: "0.4rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8125rem" }}
                  >
                    <optgroup label={`${selectedTable?.display_name || "Primary"} (Primary Table)`}>
                      {selectedTable?.columns.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
                    {joinedTables.map((jt) => (
                      <optgroup key={jt.id} label={`${jt.display_name} (Joined Table)`}>
                        {jt.columns.map((c) => (
                          <option key={`${jt.id}.${c.name}`} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>

                  <select
                    value={aggregation}
                    onChange={(e) => setAggregation(e.target.value as "sum" | "avg" | "count" | "min" | "max")}
                    style={{ padding: "0.4rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8125rem" }}
                  >
                    <option value="sum">Sum</option>
                    <option value="avg">Average</option>
                    <option value="count">Count</option>
                    <option value="min">Min</option>
                    <option value="max">Max</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Live Preview Panel */}
          <div
            style={{
              padding: "1.5rem",
              backgroundColor: "var(--mb-color-bg-page)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b", letterSpacing: "0.04em" }}>
                  Interactive Live Preview
                </span>
                <span style={{ fontSize: "0.6875rem", color: "var(--mb-color-brand)", fontWeight: 600 }}>
                  Rendered in ECharts / Metabase UI
                </span>
              </div>

              <div
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: "var(--mb-radius-card)",
                  border: "1px solid var(--mb-color-border-card)",
                  padding: "1.25rem",
                  boxShadow: "var(--mb-shadow-card)",
                  minHeight: "340px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ChartErrorBoundary onReset={executePreview}>
                  {renderPreviewContent()}
                </ChartErrorBoundary>
              </div>
            </div>

            {/* Action Bar */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "var(--mb-radius-btn)",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#ffffff",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={isSubmitting || !title.trim() || !selectedTableId}
                style={{
                  padding: "0.5rem 1.25rem",
                  borderRadius: "var(--mb-radius-btn)",
                  border: "none",
                  backgroundColor: "var(--mb-color-brand)",
                  color: "#ffffff",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                  boxShadow: "0 1px 2px rgba(80, 158, 227, 0.3)",
                }}
              >
                {isSubmitting ? "Saving..." : editingCard ? "Save Changes" : "Add to Dashboard"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
