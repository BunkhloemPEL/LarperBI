import React, { useState, useEffect, useMemo, useRef } from "react";
import dashCardStyles from "../metabase-viz/DashCard/DashCard.module.css";
import { Trash2, Pencil, Maximize2, X } from "lucide-react";
import { runQuery } from "../../services/api";
import type { CardItem, QueryResult, FilterItem } from "../../types/larper";
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
  CardEmptyState,
  CardErrorView,
} from "../metabase-viz";
import { ChartErrorBoundary } from "../metabase-viz/ChartErrorBoundary";

export interface CanvasCardRendererProps {
  dashboardId: string;
  card: CardItem;
  onDelete: (cardId: string) => void;
  onEdit: (card: CardItem) => void;
  isEditing?: boolean;
  activeFilters?: Record<string, unknown>;
  dashboardFilters?: FilterItem[];
}

export const CanvasCardRenderer: React.FC<CanvasCardRendererProps> = ({
  dashboardId,
  card,
  onDelete,
  onEdit,
  isEditing = false,
  activeFilters,
  dashboardFilters,
}) => {
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [isRevalidating, setIsRevalidating] = useState<boolean>(false);
  const [isZoomed, setIsZoomed] = useState<boolean>(false);
  const hasLoadedOnceRef = useRef<boolean>(false);

  // Close zoom modal on Escape key
  useEffect(() => {
    if (!isZoomed) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsZoomed(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isZoomed]);

  // Serialize query parameters to prevent layout coordinate updates [x,y,w,h] from triggering queries
  const queryHash = useMemo(() => {
    const filterEntries = (dashboardFilters || []).map((f) => [f.id, f.column_name, activeFilters?.[f.id] ?? null]);
    return `${dashboardId}|${card.table_id}|${card.viz_type}|${JSON.stringify(card.config)}|${JSON.stringify(filterEntries)}`;
  }, [dashboardId, card.table_id, card.viz_type, card.config, activeFilters, dashboardFilters]);

  useEffect(() => {
    let isCancelled = false;

    if (!hasLoadedOnceRef.current) {
      setIsInitialLoading(true);
    } else {
      setIsRevalidating(true);
    }

    const mergedFilters = [...(card.config.filters || [])];

    if (activeFilters && dashboardFilters) {
      dashboardFilters.forEach((f) => {
        const val = activeFilters[f.id];
        if (val !== undefined && val !== null && val !== "" && !(Array.isArray(val) && val.length === 0)) {
          if (f.filter_type === "category") {
            mergedFilters.push({
              column: f.column_name,
              operator: "in",
              value: Array.isArray(val) ? val : [val],
            });
          } else if (f.filter_type === "date_range") {
            mergedFilters.push({
              column: f.column_name,
              operator: "date_range",
              value: val,
            });
          } else if (f.filter_type === "text") {
            mergedFilters.push({
              column: f.column_name,
              operator: "contains",
              value: val,
            });
          }
        }
      });
    }

    const queryConfig = {
      ...card.config,
      filters: mergedFilters,
    };

    runQuery(dashboardId, card.table_id, card.viz_type, queryConfig)
      .then((res) => {
        if (!isCancelled) {
          setQueryResult(res);
          setQueryError(null);
          hasLoadedOnceRef.current = true;
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error(`Error loading card ${card.id}:`, err);
          setQueryError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsInitialLoading(false);
          setIsRevalidating(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [queryHash]);

  const renderVisual = (customHeight: number | string = "100%", isZoom: boolean = false) => {
    if (isInitialLoading) {
      return null;
    }

    if (queryError) {
      return (
        <CardErrorView
          error={queryError}
          onRetry={() => {
            hasLoadedOnceRef.current = false;
            setIsInitialLoading(true);
            setQueryError(null);
          }}
        />
      );
    }

    if (!queryResult || !queryResult.data) {
      const hasActiveFilters = Object.values(activeFilters || {}).some(
        (v) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0)
      );
      return <CardEmptyState isFiltered={hasActiveFilters} />;
    }

    const { data } = queryResult;
    const { viz_type } = card;
    if (viz_type === "smart_scalar") {
      return <SmartScalar data={data as SmartScalarItem} isZoomed={isZoom} />;
    }
    if (viz_type === "donut") {
      return (
        <DonutChart
          data={data as CardBreakdownItem[]}
          height={customHeight}
          centerSubtitle={card.config.measures[0]?.alias || "Total"}
        />
      );
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
      <DashCard
        title={card.title}
        vizType={card.viz_type}
        isLoading={isInitialLoading}
        isRevalidating={isRevalidating}
        actions={
          <>
            <button
              type="button"
              data-dontdrag="true"
              onClick={() => setIsZoomed(true)}
              title="Zoom / Expand to Fullscreen"
              className={dashCardStyles.actionBtn}
            >
              <Maximize2 size={13} />
            </button>
            <button
              type="button"
              data-dontdrag="true"
              onClick={() => onEdit(card)}
              title="Edit Visual Card"
              className={dashCardStyles.actionBtn}
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              data-dontdrag="true"
              onClick={() => onDelete(card.id)}
              title="Delete Card"
              className={dashCardStyles.actionBtn}
            >
              <Trash2 size={13} />
            </button>
          </>
        }
      >
        <ChartErrorBoundary onReset={() => setQueryResult(null)}>
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
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
              {renderVisual("100%", true)}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
