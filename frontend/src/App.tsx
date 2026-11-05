import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft } from "lucide-react";
import {
  fetchDashboards,
  createDashboard,
  deleteDashboard,
  fetchDashboardDetail,
  updateDashboard,
} from "./services/api";
import type { DashboardItem, DashboardDetail } from "./types/larper";

import { DashboardList } from "./components/DashboardManager/DashboardList";
import { CanvasView } from "./components/DashboardCanvas/CanvasView";
import { DataTableView } from "./components/DataView/DataTableView";
import { JupyterNotebook } from "./components/Notebook/JupyterNotebook";
import { ModelView } from "./components/ModelView/ModelView";
import { VisualGallery } from "./components/VisualGallery";
import { DashboardSidebar } from "./components/layout/DashboardSidebar";

const getInitialDashboardId = (): string | null => {
  const hash = typeof window !== "undefined" ? window.location.hash : "";
  const match = hash.match(/^#\/dashboard\/([^/?]+)/);
  return match ? match[1] : null;
};

export const App: React.FC = () => {
  const [dashboards, setDashboards] = useState<DashboardItem[]>([]);
  const [activeDashboardId, setActiveDashboardId] = useState<string | null>(getInitialDashboardId);
  const [dashboardDetail, setDashboardDetail] = useState<DashboardDetail | null>(null);
  const [activeTab, setActiveTab] = useState<"canvas" | "data" | "python_lab" | "model" | "gallery">("canvas");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Editable title state
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [titleInput, setTitleInput] = useState<string>("");

  // Load Dashboards on mount
  const loadDashboards = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchDashboards();
      setDashboards(data);
    } catch (err) {
      console.error("Failed to load dashboards:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboards();
  }, [loadDashboards]);

  // Load Active Dashboard Detail
  const loadActiveDashboard = useCallback(async () => {
    if (!activeDashboardId) return;
    try {
      const detail = await fetchDashboardDetail(activeDashboardId);
      setDashboardDetail(detail);
      setTitleInput(detail.dashboard.title);
    } catch (err) {
      console.error("Failed to load dashboard detail:", err);
    }
  }, [activeDashboardId]);

  useEffect(() => {
    loadActiveDashboard();
  }, [loadActiveDashboard]);
  // Synchronize activeDashboardId with URL hash for refresh survival and deep linking
  useEffect(() => {
    if (activeDashboardId) {
      if (window.location.hash !== `#/dashboard/${activeDashboardId}`) {
        window.location.hash = `#/dashboard/${activeDashboardId}`;
      }
    } else {
      if (window.location.hash) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    }
  }, [activeDashboardId]);

  useEffect(() => {
    const handleHashChange = () => {
      const match = window.location.hash.match(/^#\/dashboard\/([^/?]+)/);
      const nextId = match ? match[1] : null;
      setActiveDashboardId((prev) => (prev !== nextId ? nextId : prev));
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);


  // Create Dashboard Action
  const handleCreateDashboard = async (title: string, description?: string) => {
    const created = await createDashboard(title, description);
    await loadDashboards();
    setActiveDashboardId(created.id);
    setActiveTab("canvas");
  };

  // Delete Dashboard Action
  const handleDeleteDashboard = async (id: string) => {
    await deleteDashboard(id);
    await loadDashboards();
    if (activeDashboardId === id) {
      setActiveDashboardId(null);
    }
  };

  const handleCardsLayoutSaved = useCallback(
    (layouts: { id: string; x: number; y: number; w: number; h: number }[]) => {
      setDashboardDetail((prev) => {
        if (!prev) return prev;
        const byId = new Map(layouts.map((layout) => [layout.id, layout]));
        return {
          ...prev,
          cards: prev.cards.map((card) => {
            const layout = byId.get(card.id);
            return layout
              ? { ...card, grid_layout: { x: layout.x, y: layout.y, w: layout.w, h: layout.h } }
              : card;
          }),
        };
      });
    },
    []
  );

  // Title update
  const handleTitleBlur = async () => {
    setIsEditingTitle(false);
    if (!activeDashboardId || !titleInput.trim()) return;
    try {
      await updateDashboard(activeDashboardId, { title: titleInput.trim() });
      await loadActiveDashboard();
      await loadDashboards();
    } catch (err) {
      console.error("Failed to update title:", err);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "var(--mb-color-bg-page)" }}>
      {/* Top Header */}
      <header
        style={{
          backgroundColor: "#ffffff",
          borderBottom: "1px solid var(--mb-color-border-card)",
          padding: "0.75rem 2rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 1px 2px rgba(0, 0, 0, 0.03)",
          position: "sticky",
          top: 0,
          zIndex: 20,
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
          {/* Logo & Brand */}
          <div
            onClick={() => setActiveDashboardId(null)}
            style={{ display: "flex", alignItems: "center", gap: "0.625rem", cursor: "pointer" }}
          >
            <div
              style={{
                backgroundColor: "var(--mb-color-brand)",
                color: "#ffffff",
                width: "32px",
                height: "32px",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: "1rem",
              }}
            >
              L
            </div>
            <div>
              <span style={{ fontSize: "1rem", fontWeight: 800, color: "var(--mb-color-text-primary)", letterSpacing: "-0.02em" }}>
                LarperBI
              </span>
              <span
                style={{
                  fontSize: "0.625rem",
                  marginLeft: "0.375rem",
                  backgroundColor: "rgba(80, 158, 227, 0.12)",
                  color: "var(--mb-color-brand)",
                  padding: "0.125rem 0.375rem",
                  borderRadius: "9999px",
                  fontWeight: 700,
                }}
              >
                STUDIO
              </span>
            </div>
          </div>

          {/* Active Dashboard Title / Back Link */}
          {activeDashboardId && dashboardDetail && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", borderLeft: "1px solid #e2e8f0", paddingLeft: "1.25rem" }}>
              <button
                type="button"
                onClick={() => setActiveDashboardId(null)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  background: "transparent",
                  border: "none",
                  color: "var(--mb-color-text-muted)",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                <ChevronLeft size={14} /> Back
              </button>

              {isEditingTitle ? (
                <input
                  type="text"
                  autoFocus
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onBlur={handleTitleBlur}
                  onKeyDown={(e) => e.key === "Enter" && handleTitleBlur()}
                  style={{
                    fontSize: "0.9375rem",
                    fontWeight: 700,
                    padding: "0.25rem 0.5rem",
                    borderRadius: "4px",
                    border: "1.5px solid var(--mb-color-brand)",
                    outline: "none",
                  }}
                />
              ) : (
                <h2
                  onClick={() => setIsEditingTitle(true)}
                  title="Click to rename"
                  style={{
                    fontSize: "0.9375rem",
                    fontWeight: 700,
                    color: "var(--mb-color-text-primary)",
                    cursor: "text",
                    padding: "0.25rem 0.375rem",
                    borderRadius: "4px",
                  }}
                >
                  {dashboardDetail.dashboard.title}
                </h2>
              )}
            </div>
          )}
        </div>

      </header>

      {/* Main Body */}
      <div style={{ display: "flex", flex: 1, minWidth: 0 }}>
        {activeDashboardId && (
          <DashboardSidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            modelCount={dashboardDetail?.tables.length || 0}
            galleryCount={14}
          />
        )}
      <main style={{ flex: 1, padding: "1.5rem 2rem", maxWidth: "1600px", margin: "0 auto", width: "100%", minWidth: 0 }}>
        {!activeDashboardId ? (
          <DashboardList
            dashboards={dashboards}
            onOpenDashboard={(id) => {
              setActiveDashboardId(id);
              setActiveTab("canvas");
            }}
            onCreateDashboard={handleCreateDashboard}
            onDeleteDashboard={handleDeleteDashboard}
            isLoading={isLoading}
          />
        ) : (
          <>
            {activeTab === "canvas" && dashboardDetail && (
              <CanvasView
                dashboardId={activeDashboardId}
                tables={dashboardDetail.tables}
                cards={dashboardDetail.cards}
                filters={dashboardDetail.filters || []}
                metrics={dashboardDetail.metrics || []}
                relationships={dashboardDetail.relationships || []}
                onRefresh={loadActiveDashboard}
                onLayoutSaved={handleCardsLayoutSaved}
              />
            )}

            {activeTab === "data" && dashboardDetail && (
              <DataTableView
                dashboardId={activeDashboardId}
                tables={dashboardDetail.tables}
              />
            )}

            {activeTab === "python_lab" && dashboardDetail && (
              <JupyterNotebook
                dashboardId={activeDashboardId}
                tables={dashboardDetail.tables}
                onTableCreated={loadActiveDashboard}
              />
            )}

            {activeTab === "model" && dashboardDetail && (
              <ModelView
                dashboardId={activeDashboardId}
                tables={dashboardDetail.tables}
                relationships={dashboardDetail.relationships}
                metrics={dashboardDetail.metrics || []}
                onRefresh={loadActiveDashboard}
              />
            )}

            {activeTab === "gallery" && <VisualGallery />}
          </>
        )}
      </main>
      </div>
    </div>
  );
};

export default App;
