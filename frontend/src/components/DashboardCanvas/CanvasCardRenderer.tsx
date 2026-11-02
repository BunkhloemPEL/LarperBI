import React, { useState, useEffect } from "react";
import { Trash2, Pencil, Maximize2, X } from "lucide-react";
import { runQuery } from "../../services/api";
import type { CardItem, QueryResult } from "../../types/larper";
import type { SmartScalarItem, CardBreakdownItem } from "../../types/dashboard";

import {
  DashCard,
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

export interface CanvasCardRendererProps {
  dashboardId: string;
  card: CardItem;
  onDelete: (cardId: string) => void;
  onEdit: (card: CardItem) => void;
  isEditing?: boolean;
}

export const CanvasCardRenderer: React.FC<CanvasCardRendererProps> = ({
  dashboardId,
  card,
  onDelete,
  onEdit,
  isEditing = false,
}) => {
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isZoomed, setIsZoomed] = useState<boolean>(false);

  const fetchCardData = () => {
    setIsLoading(true);
    runQuery(dashboardId, card.table_id, card.viz_type, card.config)
      .then((res) => {
        setQueryResult(res);
      })
      .catch((err) => console.error(`Error loading card ${card.id}:`, err))
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    fetchCardData();
  }, [dashboardId, card]);

  const renderVisual = (customHeight: number | string = "100%") => {
    if (isLoading) {
      return null;
    }

    if (!queryResult || !queryResult.data) {
      return <div style={{ color: "#94a3b8", textAlign: "center", padding: "2rem" }}>No data to display.</div>;
    }

    const { data } = queryResult;
    const { viz_type } = card;

    if (viz_type === "smart_scalar") {
      return <SmartScalar data={data as SmartScalarItem} />;
    }
    if (viz_type === "donut") {
      return <DonutChart data={data as CardBreakdownItem[]} height={customHeight} />;
    }
    if (viz_type === "waterfall") {
      return <WaterfallChart data={data as WaterfallStep[]} height={customHeight} />;
    }
    if (viz_type === "funnel") {
      return <FunnelChart data={data as FunnelStep[]} height={customHeight} />;
    }
    if (viz_type === "gauge") {
      const g = data as { value: number; min: number; max: number; unit: string; title: string };
      return <GaugeChart value={g?.value ?? 0} min={g?.min ?? 0} max={g?.max ?? 100} unit={g?.unit ?? ""} title={g?.title ?? ""} height={customHeight} />;
    }
    if (viz_type === "progress") {
      const p = data as { current: number; goal: number; label: string };
      return <ProgressBar current={p?.current ?? 0} goal={p?.goal ?? 100} label={p?.label ?? "Goal"} height={customHeight} />;
    }
    if (viz_type === "treemap") {
      return <TreemapChart data={data as TreemapNode[]} height={customHeight} />;
    }

    if (viz_type === "bar") {
      const c = data as { dimensions: string[]; series: { name: string; data: number[] }[] };
      const opt = buildGenericBarOption(c?.dimensions || [], c?.series || []);
      return <CartesianChart option={opt} height={customHeight} />;
    }

    if (viz_type === "row") {
      const c = data as { dimensions: string[]; series: { name: string; data: number[] }[] };
      const opt = buildGenericRowOption(c?.dimensions || [], c?.series || []);
      return <CartesianChart option={opt} height={customHeight} />;
    }

    // Default line / area
    const c = data as { dimensions: string[]; series: { name: string; data: number[] }[] };
    const opt = buildGenericLineOption(c?.dimensions || [], c?.series || [], true);
    return <CartesianChart option={opt} height={customHeight} />;
  };

  return (
    <>
      <DashCard title={card.title} isLoading={isLoading}>
        {/* Card Header Action Buttons */}
        <div
          data-dontdrag="true"
          style={{ position: "absolute", top: 10, right: 10, zIndex: 35, display: "flex", alignItems: "center", gap: "6px" }}
        >
          {/* Zoom / Maximize Fullscreen Button */}
          <button
            type="button"
            data-dontdrag="true"
            onClick={() => setIsZoomed(true)}
            title="Zoom / Expand to Fullscreen"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "#94a3b8",
              padding: "2px",
              borderRadius: "4px",
              display: "inline-flex",
              alignItems: "center",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--mb-color-brand)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
          >
            <Maximize2 size={13} />
          </button>

          {/* Edit Card Button */}
          <button
            type="button"
            data-dontdrag="true"
            onClick={() => onEdit(card)}
            title="Edit Visual Card"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "#94a3b8",
              padding: "2px",
              borderRadius: "4px",
              display: "inline-flex",
              alignItems: "center",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--mb-color-brand)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
          >
            <Pencil size={13} />
          </button>

          {/* Delete Card Button */}
          <button
            type="button"
            data-dontdrag="true"
            onClick={() => onDelete(card.id)}
            title="Delete Card"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "#94a3b8",
              padding: "2px",
              borderRadius: "4px",
              display: "inline-flex",
              alignItems: "center",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#dc2626")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
          >
            <Trash2 size={13} />
          </button>
        </div>

        <ChartErrorBoundary onReset={fetchCardData}>
          <div style={{ pointerEvents: isEditing ? "none" : "auto", height: "100%", userSelect: "none", WebkitUserSelect: "none" }}>
            {renderVisual()}
          </div>
        </ChartErrorBoundary>
      </DashCard>

      {/* Zoom / Fullscreen Modal */}
      {isZoomed && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "2rem",
          }}
          onClick={() => setIsZoomed(false)}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "var(--mb-radius-card)",
              width: "90vw",
              maxWidth: "1300px",
              height: "80vh",
              display: "flex",
              flexDirection: "column",
              padding: "1.5rem",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--mb-color-text-primary)" }}>
                  {card.title} (Zoomed View)
                </h3>
                <span style={{ fontSize: "0.75rem", color: "var(--mb-color-text-muted)" }}>
                  Focus inspection mode with interactive zoom and tooltips.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsZoomed(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748b" }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              {renderVisual("100%")}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
