import React, { useState } from "react";
import { Database, Link2, Trash2, Plus, ArrowRight, Hash, Calendar, Type } from "lucide-react";
import { createRelationship, deleteRelationship } from "../../services/api";
import type { TableItem, RelationshipItem } from "../../types/larper";

export interface ModelViewProps {
  dashboardId: string;
  tables: TableItem[];
  relationships: RelationshipItem[];
  onRefresh: () => void;
}

export const ModelView: React.FC<ModelViewProps> = ({
  dashboardId,
  tables,
  relationships,
  onRefresh,
}) => {
  const [fromTable, setFromTable] = useState<string>(tables[0]?.id || "");
  const [fromCol, setFromCol] = useState<string>("");
  const [toTable, setToTable] = useState<string>(tables[1]?.id || "");
  const [toCol, setToCol] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fromTblObj = tables.find((t) => t.id === fromTable);
  const toTblObj = tables.find((t) => t.id === toTable);

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", paddingBottom: "3rem" }}>
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
        <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--mb-color-text-primary)", marginBottom: "1rem" }}>
          Tables in this Dashboard ({tables.length})
        </h3>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1.25rem" }}>
          {tables.map((table) => (
            <div
              key={table.id}
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "var(--mb-radius-card)",
                border: "1px solid var(--mb-color-border-card)",
                boxShadow: "var(--mb-shadow-card)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Table Card Header */}
              <div
                style={{
                  padding: "0.875rem 1rem",
                  backgroundColor: "#f8fafc",
                  borderBottom: "1px solid var(--mb-color-border-card)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Database size={16} color="var(--mb-color-brand)" />
                  <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--mb-color-text-primary)" }}>
                    {table.display_name}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    padding: "0.125rem 0.5rem",
                    borderRadius: "9999px",
                    backgroundColor: table.table_type === "derived_python" ? "rgba(136, 191, 77, 0.15)" : "rgba(80, 158, 227, 0.12)",
                    color: table.table_type === "derived_python" ? "var(--mb-color-success)" : "var(--mb-color-brand)",
                  }}
                >
                  {table.table_type === "derived_python" ? "⚡ Derived Model" : "Raw Upload"}
                </span>
              </div>

              {/* Sub-header Stats */}
              <div style={{ padding: "0.5rem 1rem", borderBottom: "1px solid #f1f5f9", fontSize: "0.6875rem", color: "#64748b" }}>
                Rows: <strong>{table.row_count.toLocaleString()}</strong> | Columns: <strong>{table.columns.length}</strong>
              </div>

              {/* Column Listing */}
              <div style={{ padding: "0.5rem 0.75rem", maxHeight: "260px", overflowY: "auto" }}>
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

                  return (
                    <div
                      key={col.name}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0.375rem 0.5rem",
                        borderRadius: "4px",
                        fontSize: "0.75rem",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                        <Icon size={12} color={iconColor} />
                        <span style={{ fontWeight: 500, color: "#1e293b" }}>{col.name}</span>
                      </div>
                      <span style={{ fontSize: "0.6875rem", color: "#94a3b8" }}>{col.data_type}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
