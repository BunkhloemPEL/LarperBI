import React, { useState, useCallback } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { Play, Sparkles, Check, AlertCircle, Database, Table as TableIcon } from "lucide-react";
import { executePythonSandbox, saveDerivedTable } from "../../services/api";
import type { TableItem, PythonExecuteResponse } from "../../types/larper";

export interface PythonLabProps {
  dashboardId: string;
  tables: TableItem[];
  onTableCreated: () => void;
}

const DEFAULT_CODE = `# Write Python EDA code to explore, clean, or aggregate data.
# The dashboard tables are pre-loaded in Polars as: 'df' and their table names.
import polars as pl

print("Shape of primary table:", df.shape)
print("Available columns:", df.columns)

# Example: Create an aggregated summary DataFrame
# df_summary = df.group_by(df.columns[0]).agg(pl.len().alias("count"))
`;

export const PythonLab: React.FC<PythonLabProps> = ({
  dashboardId,
  tables,
  onTableCreated,
}) => {
  const [code, setCode] = useState<string>(DEFAULT_CODE);
  const [output, setOutput] = useState<PythonExecuteResponse | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"preview" | "stdout" | "plot">("preview");

  // Save derived table state
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false);
  const [derivedName, setDerivedName] = useState<string>("");
  const [selectedVar, setSelectedVar] = useState<string>("");
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    setSaveSuccess(null);
    try {
      const res = await executePythonSandbox(dashboardId, code);
      setOutput(res);
      if (res.table_preview) {
        setActiveTab("preview");
        setSelectedVar(res.table_preview.var_name);
        setDerivedName(`${res.table_preview.var_name}_clean`);
      } else if (res.plot_base64) {
        setActiveTab("plot");
      } else {
        setActiveTab("stdout");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setOutput({
        success: false,
        stdout: "",
        error: msg,
        detected_dataframes: [],
      });
      setActiveTab("stdout");
    } finally {
      setIsRunning(false);
    }
  }, [dashboardId, code]);

  const handleSaveDerived = async () => {
    if (!derivedName.trim() || !selectedVar) return;
    setIsSaving(true);
    try {
      await saveDerivedTable(dashboardId, derivedName.trim(), selectedVar, code);
      setSaveSuccess(`Table '${derivedName}' materialized successfully!`);
      setShowSaveModal(false);
      onTableCreated();
    } catch (err: unknown) {
      alert(`Failed to save derived table: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 140px)", minHeight: "650px", gap: "1rem" }}>
      {/* Top Banner & Control Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#ffffff",
          padding: "0.875rem 1.25rem",
          borderRadius: "var(--mb-radius-card)",
          border: "1px solid var(--mb-color-border-card)",
          boxShadow: "var(--mb-shadow-card)",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div>
            <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--mb-color-text-primary)" }}>
              Python Data Lab (EDA Sandbox)
            </h2>
            <p style={{ fontSize: "0.75rem", color: "var(--mb-color-text-muted)" }}>
              Inspect and transform data with Polars. Save aggregated DataFrames as new dashboard tables.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--mb-color-text-muted)", fontWeight: 600 }}>
              Pre-loaded:
            </span>
            {tables.map((t, idx) => (
              <span
                key={t.id}
                style={{
                  fontSize: "0.6875rem",
                  backgroundColor: idx === 0 ? "rgba(80, 158, 227, 0.15)" : "#f1f5f9",
                  color: idx === 0 ? "var(--mb-color-brand)" : "#475569",
                  fontWeight: 600,
                  padding: "0.125rem 0.5rem",
                  borderRadius: "9999px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
              >
                <Database size={10} />
                {t.display_name} ({t.row_count.toLocaleString()} rows)
              </span>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button
            type="button"
            onClick={handleRun}
            disabled={isRunning}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              backgroundColor: "var(--mb-color-brand)",
              color: "#ffffff",
              border: "none",
              borderRadius: "var(--mb-radius-btn)",
              padding: "0.4375rem 1rem",
              fontSize: "0.8125rem",
              fontWeight: 600,
              cursor: isRunning ? "not-allowed" : "pointer",
              boxShadow: "0 1px 2px rgba(80, 158, 227, 0.3)",
              transition: "background-color 0.15s ease",
            }}
          >
            <Play size={13} fill="#ffffff" />
            {isRunning ? "Running Script..." : "Run Script (Shift+Enter)"}
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div
          style={{
            backgroundColor: "var(--mb-color-success-bg)",
            color: "var(--mb-color-success)",
            padding: "0.625rem 1rem",
            borderRadius: "6px",
            fontSize: "0.8125rem",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <Check size={16} />
          {saveSuccess}
        </div>
      )}

      {/* Main Split: Code Editor (Top/Left) and Output (Bottom/Right) */}
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "1rem", flex: 1, minHeight: 0 }}>
        {/* Editor Box */}
        <div
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid var(--mb-color-border-card)",
            borderRadius: "var(--mb-radius-card)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "var(--mb-shadow-card)",
          }}
        >
          <div
            style={{
              padding: "0.5rem 0.875rem",
              backgroundColor: "#f8fafc",
              borderBottom: "1px solid var(--mb-color-border-card)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--mb-color-text-secondary)" }}>
              main.py
            </span>
            <span style={{ fontSize: "0.6875rem", color: "var(--mb-color-text-subtle)" }}>
              Python 3.9+ / Polars Runtime
            </span>
          </div>

          <div
            style={{ flex: 1, overflow: "auto" }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.shiftKey || e.metaKey)) {
                e.preventDefault();
                handleRun();
              }
            }}
          >
            <CodeMirror
              value={code}
              height="100%"
              extensions={[python()]}
              onChange={(val) => setCode(val)}
              theme="light"
              basicSetup={{
                lineNumbers: true,
                highlightActiveLineGutter: true,
                bracketMatching: true,
                autocompletion: true,
              }}
            />
          </div>
        </div>

        {/* Output & Results Panel */}
        <div
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid var(--mb-color-border-card)",
            borderRadius: "var(--mb-radius-card)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "var(--mb-shadow-card)",
          }}
        >
          {/* Output Header with Tabs */}
          <div
            style={{
              padding: "0.375rem 0.75rem",
              backgroundColor: "#f8fafc",
              borderBottom: "1px solid var(--mb-color-border-card)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                style={{
                  padding: "0.25rem 0.625rem",
                  borderRadius: "4px",
                  border: "none",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  backgroundColor: activeTab === "preview" ? "#ffffff" : "transparent",
                  color: activeTab === "preview" ? "var(--mb-color-brand)" : "var(--mb-color-text-muted)",
                  boxShadow: activeTab === "preview" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                }}
              >
                DataFrame Preview {output?.table_preview ? `(${output.table_preview.row_count})` : ""}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("stdout")}
                style={{
                  padding: "0.25rem 0.625rem",
                  borderRadius: "4px",
                  border: "none",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  backgroundColor: activeTab === "stdout" ? "#ffffff" : "transparent",
                  color: activeTab === "stdout" ? "var(--mb-color-brand)" : "var(--mb-color-text-muted)",
                  boxShadow: activeTab === "stdout" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
                }}
              >
                Stdout Log
              </button>

              {output?.plot_base64 && (
                <button
                  type="button"
                  onClick={() => setActiveTab("plot")}
                  style={{
                    padding: "0.25rem 0.625rem",
                    borderRadius: "4px",
                    border: "none",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    backgroundColor: activeTab === "plot" ? "#ffffff" : "transparent",
                    color: activeTab === "plot" ? "var(--mb-color-brand)" : "var(--mb-color-text-muted)",
                  }}
                >
                  Matplotlib Plot
                </button>
              )}
            </div>

            {/* Save as Derived Table Button */}
            {output?.table_preview && (
              <button
                type="button"
                onClick={() => setShowSaveModal(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  backgroundColor: "rgba(136, 191, 77, 0.15)",
                  color: "var(--mb-color-success)",
                  border: "1px solid rgba(136, 191, 77, 0.3)",
                  borderRadius: "var(--mb-radius-btn)",
                  padding: "0.25rem 0.625rem",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <Sparkles size={12} />
                Save as Derived Table
              </button>
            )}
          </div>

          {/* Output Content Area */}
          <div style={{ flex: 1, overflow: "auto", padding: "0.875rem" }}>
            {output?.error && (
              <div
                style={{
                  backgroundColor: "var(--mb-color-error-bg)",
                  color: "#dc2626",
                  padding: "0.75rem",
                  borderRadius: "6px",
                  fontSize: "0.75rem",
                  fontFamily: "var(--mb-font-mono)",
                  whiteSpace: "pre-wrap",
                  marginBottom: "0.75rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontWeight: 700, marginBottom: "0.25rem" }}>
                  <AlertCircle size={14} /> Execution Error
                </div>
                {output.error}
              </div>
            )}

            {activeTab === "preview" && output?.table_preview && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--mb-color-text-secondary)" }}>
                    Variable: <code style={{ color: "var(--mb-color-brand)" }}>{output.table_preview.var_name}</code>
                  </span>
                  <span style={{ fontSize: "0.6875rem", color: "var(--mb-color-text-muted)" }}>
                    Showing first {output.table_preview.rows.length} of {output.table_preview.row_count} rows
                  </span>
                </div>

                <div style={{ overflowX: "auto", border: "1px solid var(--mb-color-border-card)", borderRadius: "4px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                    <thead>
                      <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                        {output.table_preview.columns.map((c) => (
                          <th key={c} style={{ padding: "0.5rem 0.75rem", textAlign: "left", fontWeight: 600, color: "#64748b" }}>
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {output.table_preview.rows.map((row, rIdx) => (
                        <tr key={rIdx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          {row.map((val, cIdx) => (
                            <td key={cIdx} style={{ padding: "0.4rem 0.75rem", color: "#334155" }}>
                              {String(val)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === "stdout" && (
              <pre
                style={{
                  fontFamily: "var(--mb-font-mono)",
                  fontSize: "0.75rem",
                  color: "#334155",
                  whiteSpace: "pre-wrap",
                  margin: 0,
                }}
              >
                {output?.stdout || "No standard output. Run a script to see prints or table outputs."}
              </pre>
            )}

            {activeTab === "plot" && output?.plot_base64 && (
              <div style={{ textAlign: "center", padding: "1rem" }}>
                <img
                  src={`data:image/png;base64,${output.plot_base64}`}
                  alt="Rendered Matplotlib Chart"
                  style={{ maxWidth: "100%", maxHeight: "400px", borderRadius: "6px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}
                />
              </div>
            )}

            {!output && (
              <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#94a3b8", fontSize: "0.8125rem" }}>
                <TableIcon size={32} style={{ margin: "0 auto 0.5rem auto", opacity: 0.5 }} />
                Click <strong>"Run Script"</strong> to inspect and dissect your dashboard data.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save Derived Table Modal */}
      {showSaveModal && (
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
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--mb-color-text-primary)", marginBottom: "0.5rem" }}>
              Save as Derived Table (Model)
            </h3>
            <p style={{ fontSize: "0.8125rem", color: "var(--mb-color-text-muted)", marginBottom: "1rem" }}>
              Materialize this DataFrame as a first-class table for building visual cards on this dashboard.
            </p>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.25rem" }}>
                Target DataFrame Variable:
              </label>
              <select
                value={selectedVar}
                onChange={(e) => setSelectedVar(e.target.value)}
                style={{ width: "100%", padding: "0.4rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8125rem" }}
              >
                {output?.detected_dataframes.map((dfName) => (
                  <option key={dfName} value={dfName}>
                    {dfName}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.25rem" }}>
                New Table Name:
              </label>
              <input
                type="text"
                value={derivedName}
                onChange={(e) => setDerivedName(e.target.value)}
                placeholder="e.g. monthly_brand_summary"
                style={{ width: "100%", padding: "0.4rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8125rem" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                disabled={isSaving}
                style={{ padding: "0.375rem 0.875rem", borderRadius: "4px", border: "1px solid #cbd5e1", background: "#ffffff", fontSize: "0.8125rem" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDerived}
                disabled={isSaving || !derivedName.trim()}
                style={{
                  padding: "0.375rem 0.875rem",
                  borderRadius: "4px",
                  border: "none",
                  backgroundColor: "var(--mb-color-brand)",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: "0.8125rem",
                  cursor: isSaving ? "not-allowed" : "pointer",
                }}
              >
                {isSaving ? "Saving Table..." : "Materialize Table"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
