import React, { useState } from "react";
import { Plus, LayoutDashboard, Database, Layers, Trash2, ArrowUpRight } from "lucide-react";
import type { DashboardItem } from "../../types/larper";
import { ConfirmDialog } from "../common/ConfirmDialog";

export interface DashboardListProps {
  dashboards: DashboardItem[];
  onOpenDashboard: (dashboardId: string) => void;
  onCreateDashboard: (title: string, description?: string) => Promise<void>;
  onDeleteDashboard: (dashboardId: string) => Promise<void>;
  isLoading: boolean;
}

export const DashboardList: React.FC<DashboardListProps> = ({
  dashboards,
  onOpenDashboard,
  onCreateDashboard,
  onDeleteDashboard,
  isLoading,
}) => {
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>("Untitled Dashboard");
  const [newDesc, setNewDesc] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [dashboardToDelete, setDashboardToDelete] = useState<DashboardItem | null>(null);
  const [isDeletingDashboard, setIsDeletingDashboard] = useState<boolean>(false);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setIsSubmitting(true);
    try {
      await onCreateDashboard(newTitle.trim(), newDesc.trim() || undefined);
      setShowCreateModal(false);
      setNewTitle("Untitled Dashboard");
      setNewDesc("");
    } catch (err: unknown) {
      alert(`Failed to create dashboard: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDeleteDashboard = async () => {
    if (!dashboardToDelete) return;
    setIsDeletingDashboard(true);
    try {
      await onDeleteDashboard(dashboardToDelete.id);
      setDashboardToDelete(null);
    } catch (err: unknown) {
      alert(`Failed to delete dashboard: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsDeletingDashboard(false);
    }
  };

  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "2.5rem 1.5rem" }}>
      {/* Home Hero Banner */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "2rem",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--mb-color-text-primary)", letterSpacing: "-0.02em" }}>
            LarperBI Dashboards
          </h1>
          <p style={{ fontSize: "0.875rem", color: "var(--mb-color-text-muted)", marginTop: "0.25rem" }}>
            Self-service dashboard authoring tool with Python EDA lab, auto-join modeling, and Metabase visuals.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            backgroundColor: "var(--mb-color-brand)",
            color: "#ffffff",
            border: "none",
            borderRadius: "var(--mb-radius-btn)",
            padding: "0.625rem 1.25rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 2px 4px rgba(80, 158, 227, 0.3)",
          }}
        >
          <Plus size={16} />
          New Blank Dashboard
        </button>
      </div>

      {/* Grid of Dashboards */}
      {isLoading ? (
        <div style={{ textAlign: "center", padding: "4rem", color: "#94a3b8" }}>Loading workspaces...</div>
      ) : dashboards.length === 0 ? (
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "var(--mb-radius-card)",
            border: "2px dashed #cbd5e1",
            padding: "4rem 2rem",
            textAlign: "center",
            boxShadow: "var(--mb-shadow-card)",
          }}
        >
          <LayoutDashboard size={40} color="var(--mb-color-brand)" style={{ margin: "0 auto 1rem auto", opacity: 0.8 }} />
          <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--mb-color-text-primary)", marginBottom: "0.5rem" }}>
            No Dashboards Yet
          </h3>
          <p style={{ fontSize: "0.875rem", color: "var(--mb-color-text-muted)", marginBottom: "1.5rem" }}>
            Create a blank dashboard, drop a CSV, and start building your reports!
          </p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            style={{
              backgroundColor: "var(--mb-color-brand)",
              color: "#ffffff",
              border: "none",
              borderRadius: "var(--mb-radius-btn)",
              padding: "0.5rem 1.25rem",
              fontSize: "0.8125rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Create Blank Dashboard
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.25rem" }}>
          {dashboards.map((dash) => (
            <div
              key={dash.id}
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "var(--mb-radius-card)",
                border: "1px solid var(--mb-color-border-card)",
                boxShadow: "var(--mb-shadow-card)",
                padding: "1.25rem",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                minHeight: "180px",
                transition: "all 0.15s ease",
                cursor: "pointer",
              }}
              onClick={() => onOpenDashboard(dash.id)}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "var(--mb-shadow-hover)";
                e.currentTarget.style.borderColor = "var(--mb-color-brand)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "var(--mb-shadow-card)";
                e.currentTarget.style.borderColor = "var(--mb-color-border-card)";
              }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--mb-color-text-primary)" }}>
                    {dash.title}
                  </h3>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDashboardToDelete(dash);
                    }}
                    title="Delete Dashboard"
                    style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", padding: "4px" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#dc2626")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <p style={{ fontSize: "0.75rem", color: "var(--mb-color-text-muted)", marginBottom: "1rem" }}>
                  {dash.description || "Blank dashboard workspace ready for reporting."}
                </p>
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", fontSize: "0.75rem", color: "#64748b", borderTop: "1px solid #f1f5f9", paddingTop: "0.75rem" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                    <Database size={12} color="var(--mb-color-brand)" /> {dash.table_count} tables
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                    <Layers size={12} color="var(--mb-accent-1)" /> {dash.card_count} cards
                  </span>
                  <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: "0.25rem", color: "var(--mb-color-brand)", fontWeight: 600 }}>
                    Open <ArrowUpRight size={12} />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Blank Dashboard Modal */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "var(--mb-radius-card)",
              padding: "1.5rem",
              width: "420px",
              boxShadow: "var(--mb-shadow-dropdown)",
            }}
          >
            <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--mb-color-text-primary)", marginBottom: "0.5rem" }}>
              New Blank Dashboard
            </h3>
            <p style={{ fontSize: "0.8125rem", color: "var(--mb-color-text-muted)", marginBottom: "1rem" }}>
              Creates an empty workspace ready for dropping CSV/Excel data.
            </p>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.25rem" }}>
                Dashboard Title:
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Executive Fraud & Risk"
                style={{ width: "100%", padding: "0.4rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8125rem" }}
              />
            </div>

            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.25rem" }}>
                Description (Optional):
              </label>
              <input
                type="text"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Brief summary of this dashboard's purpose..."
                style={{ width: "100%", padding: "0.4rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8125rem" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                disabled={isSubmitting}
                style={{ padding: "0.375rem 0.875rem", borderRadius: "4px", border: "1px solid #cbd5e1", background: "#ffffff", fontSize: "0.8125rem" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={isSubmitting || !newTitle.trim()}
                style={{
                  padding: "0.375rem 0.875rem",
                  borderRadius: "4px",
                  border: "none",
                  backgroundColor: "var(--mb-color-brand)",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: "0.8125rem",
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                }}
              >
                {isSubmitting ? "Creating..." : "Create Dashboard"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={dashboardToDelete !== null}
        title={`Delete dashboard "${dashboardToDelete?.title ?? ""}"?`}
        message="This permanently removes the dashboard, its visual cards, and every uploaded or derived table."
        confirmLabel="Delete dashboard"
        isBusy={isDeletingDashboard}
        onCancel={() => setDashboardToDelete(null)}
        onConfirm={handleConfirmDeleteDashboard}
      />
    </div>
  );
};
