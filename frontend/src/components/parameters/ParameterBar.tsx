import React, { useState } from "react";
import { Plus, RotateCcw, X, SlidersHorizontal } from "lucide-react";
import styles from "./ParameterWidget.module.css";
import { ParameterWidget } from "./ParameterWidget";
import { createDashboardFilter, deleteDashboardFilter } from "../../services/api";
import type { FilterItem, TableItem } from "../../types/larper";

export interface ParameterBarProps {
  dashboardId: string;
  filters: FilterItem[];
  activeValues: Record<string, unknown>;
  onFilterChange: (filterId: string, value: unknown) => void;
  onResetAll: () => void;
  tables: TableItem[];
  onRefreshFilters: () => void;
  isEditing?: boolean;
}

export const ParameterBar: React.FC<ParameterBarProps> = ({
  dashboardId,
  filters,
  activeValues,
  onFilterChange,
  onResetAll,
  tables,
  onRefreshFilters,
  isEditing = false,
}) => {
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [name, setName] = useState<string>("Filter Parameter");
  const [tableId, setTableId] = useState<string>(tables[0]?.id || "");
  const [columnName, setColumnName] = useState<string>("");
  const [filterType, setFilterType] = useState<"category" | "date_range" | "text">("category");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const selectedTable = tables.find((t) => t.id === tableId) || tables[0];

  const handleOpenAdd = () => {
    setName("New Filter");
    if (tables[0]) {
      setTableId(tables[0].id);
      if (tables[0].columns[0]) {
        setColumnName(tables[0].columns[0].name);
        setFilterType(tables[0].columns[0].semantic_type === "date" ? "date_range" : "category");
      }
    }
    setShowAddModal(true);
  };

  const handleCreate = async () => {
    if (!name.trim() || !tableId || !columnName) return;
    setIsSubmitting(true);
    try {
      await createDashboardFilter(dashboardId, {
        name: name.trim(),
        filter_type: filterType,
        table_id: tableId,
        column_name: columnName,
      });
      setShowAddModal(false);
      onRefreshFilters();
    } catch (err: unknown) {
      alert(`Failed to create filter: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (filterId: string) => {
    try {
      await deleteDashboardFilter(dashboardId, filterId);
      onRefreshFilters();
    } catch (err: unknown) {
      alert(`Failed to delete filter: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const hasAnyActiveFilters = Object.values(activeValues).some(
    (v) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0)
  );

  return (
    <>
      <div className={styles.parameterBar}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <SlidersHorizontal size={14} color="var(--mb-color-brand)" />
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--mb-color-text-muted)", textTransform: "uppercase" }}>
            Filters:
          </span>
        </div>

        {/* Filter Pills List */}
        {filters.map((f) => (
          <ParameterWidget
            key={f.id}
            dashboardId={dashboardId}
            filter={f}
            currentValue={activeValues[f.id]}
            onChange={onFilterChange}
            onDeleteFilter={handleDelete}
            isEditing={isEditing}
          />
        ))}

        {/* Add Filter Button */}
        <button
          type="button"
          onClick={handleOpenAdd}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
            height: "32px",
            padding: "0 0.625rem",
            backgroundColor: "transparent",
            border: "1px dashed #cbd5e1",
            borderRadius: "var(--mb-radius-btn)",
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "var(--mb-color-brand)",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--mb-color-brand)";
            e.currentTarget.style.backgroundColor = "rgba(80, 158, 227, 0.06)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#cbd5e1";
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <Plus size={13} />
          Add Filter
        </button>

        {/* Reset All Filters Button */}
        {hasAnyActiveFilters && (
          <button
            type="button"
            onClick={onResetAll}
            title="Reset all filters to All"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
              height: "32px",
              padding: "0 0.5rem",
              background: "transparent",
              border: "none",
              color: "var(--mb-color-text-muted)",
              fontSize: "0.75rem",
              fontWeight: 600,
              cursor: "pointer",
              marginLeft: "auto",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--mb-color-brand)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--mb-color-text-muted)")}
          >
            <RotateCcw size={12} />
            Reset All
          </button>
        )}
      </div>

      {/* Add Filter Modal */}
      {showAddModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.45)",
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--mb-color-text-primary)" }}>
                Add Dashboard Filter
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748b" }}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--mb-color-text-muted)", marginBottom: "1rem" }}>
              Create an interactive filter parameter that cross-filters visual cards.
            </p>

            {/* Filter Label */}
            <div style={{ marginBottom: "0.875rem" }}>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.25rem" }}>
                Filter Label Name:
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ width: "100%", padding: "0.4rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8125rem" }}
              />
            </div>

            {/* Source Table */}
            <div style={{ marginBottom: "0.875rem" }}>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.25rem" }}>
                Target Table:
              </label>
              <select
                value={tableId}
                onChange={(e) => {
                  setTableId(e.target.value);
                  const tbl = tables.find((t) => t.id === e.target.value);
                  if (tbl && tbl.columns[0]) {
                    setColumnName(tbl.columns[0].name);
                    setFilterType(tbl.columns[0].semantic_type === "date" ? "date_range" : "category");
                  }
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

            {/* Target Column */}
            <div style={{ marginBottom: "0.875rem" }}>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.25rem" }}>
                Target Column:
              </label>
              <select
                value={columnName}
                onChange={(e) => {
                  setColumnName(e.target.value);
                  const col = selectedTable?.columns.find((c) => c.name === e.target.value);
                  if (col) {
                    setFilterType(col.semantic_type === "date" ? "date_range" : "category");
                  }
                }}
                style={{ width: "100%", padding: "0.4rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8125rem" }}
              >
                {selectedTable?.columns.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.semantic_type})
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Type */}
            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.25rem" }}>
                Filter Widget Type:
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as "category" | "date_range" | "text")}
                style={{ width: "100%", padding: "0.4rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8125rem" }}
              >
                <option value="category">Category (Dropdown Multi-Select)</option>
                <option value="date_range">Date Range (Presets & Calendar)</option>
                <option value="text">Text Search</option>
              </select>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                disabled={isSubmitting}
                style={{ padding: "0.375rem 0.875rem", borderRadius: "4px", border: "1px solid #cbd5e1", background: "#ffffff", fontSize: "0.8125rem" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={isSubmitting || !name.trim() || !columnName}
                style={{
                  padding: "0.375rem 1rem",
                  borderRadius: "4px",
                  border: "none",
                  backgroundColor: "var(--mb-color-brand)",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: "0.8125rem",
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                }}
              >
                {isSubmitting ? "Adding..." : "Add Filter"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
