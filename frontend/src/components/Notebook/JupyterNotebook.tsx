import React, { useState, useEffect, useCallback } from "react";
import {
  Play,
  RotateCcw,
  Save,
  Plus,
  Type,
  Code,
  Database,
  Check,
  Terminal,
  Eraser,
} from "lucide-react";
import styles from "./Notebook.module.css";
import { NotebookCell } from "./NotebookCell";
import {
  fetchNotebook,
  saveNotebookData,
  executeNotebookCell,
  restartKernel,
  saveDerivedTable,
} from "../../services/api";
import type {
  NotebookData,
  NotebookCellItem,
  CellOutputItem,
  TableItem,
} from "../../types/larper";

export interface JupyterNotebookProps {
  dashboardId: string;
  tables: TableItem[];
  onTableCreated: () => void;
}

const DEFAULT_NOTEBOOK: NotebookData = {
  cells: [
    {
      id: "cell_1",
      cell_type: "markdown",
      source: "### Exploratory Data Analysis & Transformation\nExplore raw dashboard tables with **Polars**, inspect distributions, and export curated datasets as **Derived Models**.",
      outputs: [],
      execution_count: null,
    },
    {
      id: "cell_2",
      cell_type: "code",
      source: "# Inspect pre-loaded dataset dimensions\nprint(\"Primary DataFrame Shape:\", df.shape)\nprint(\"Columns:\", df.columns)",
      outputs: [],
      execution_count: null,
    },
    {
      id: "cell_3",
      cell_type: "code",
      source: "# Example: evaluate an expression to view data\ndf.head(5)",
      outputs: [],
      execution_count: null,
    },
  ],
};

export const JupyterNotebook: React.FC<JupyterNotebookProps> = ({
  dashboardId,
  tables,
  onTableCreated,
}) => {
  const [notebook, setNotebook] = useState<NotebookData>(DEFAULT_NOTEBOOK);
  const [activeCellId, setActiveCellId] = useState<string>("cell_2");
  const [executingCellId, setExecutingCellId] = useState<string | null>(null);
  const [isKernelBusy, setIsKernelBusy] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Materialize derived table state
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false);
  const [targetVarName, setTargetVarName] = useState<string>("");
  const [targetVarCode, setTargetVarCode] = useState<string>("");
  const [derivedTableName, setDerivedTableName] = useState<string>("");
  const [isSavingTable, setIsSavingTable] = useState<boolean>(false);

  // Load Notebook on mount
  useEffect(() => {
    fetchNotebook(dashboardId)
      .then((data) => {
        if (data.cells && data.cells.length > 0) {
          setNotebook(data);
          if (!activeCellId) {
            setActiveCellId(data.cells[0].id);
          }
        }
      })
      .catch(() => {});
  }, [dashboardId]);

  // Execute a single cell
  const handleRunCell = useCallback(
    async (cellId: string) => {
      const cell = notebook.cells.find((c) => c.id === cellId);
      if (!cell || cell.cell_type !== "code") return;

      setIsKernelBusy(true);
      setExecutingCellId(cellId);
      try {
        const res = await executeNotebookCell(dashboardId, cell.id, cell.source);

        const newOutputs: CellOutputItem[] = [];
        if (res.stdout) {
          newOutputs.push({ output_type: "stream", text: res.stdout });
        }
        if (res.result_text) {
          newOutputs.push({ output_type: "execute_result", result_text: res.result_text });
        }
        if (res.table_preview) {
          newOutputs.push({
            output_type: "execute_result",
            table_preview: res.table_preview,
          });
        }
        if (res.plot_base64) {
          newOutputs.push({
            output_type: "display_data",
            plot_base64: res.plot_base64,
          });
        }
        if (res.error) {
          newOutputs.push({ output_type: "error", error: res.error });
        }

        const updatedCells = notebook.cells.map((c) => {
          if (c.id === cellId) {
            return {
              ...c,
              execution_count: res.execution_count,
              duration_ms: res.duration_ms,
              outputs: newOutputs,
            };
          }
          return c;
        });

        const newNotebook = { cells: updatedCells };
        setNotebook(newNotebook);
        saveNotebookData(dashboardId, newNotebook).catch(() => {});
      } catch (err: unknown) {
        console.error("Execution error:", err);
      } finally {
        setIsKernelBusy(false);
        setExecutingCellId(null);
      }
    },
    [dashboardId, notebook]
  );

  // Run all cells sequentially
  const handleRunAll = async () => {
    setIsKernelBusy(true);
    for (const cell of notebook.cells) {
      if (cell.cell_type === "code") {
        await handleRunCell(cell.id);
      }
    }
    setIsKernelBusy(false);
  };

  // Clear all outputs
  const handleClearAllOutputs = () => {
    const updated = {
      cells: notebook.cells.map((c) => ({ ...c, outputs: [], execution_count: null, duration_ms: null })),
    };
    setNotebook(updated);
    saveNotebookData(dashboardId, updated).catch(() => {});
  };

  // Restart Kernel
  const handleRestartKernel = async () => {
    if (!confirm("Restart Python kernel? All in-memory variables will be cleared.")) return;
    setIsKernelBusy(true);
    try {
      await restartKernel(dashboardId);
      setSaveStatus("Kernel restarted. Ready.");
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err: unknown) {
      alert(`Failed to restart kernel: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsKernelBusy(false);
    }
  };

  // Insert cell below specific index
  const handleInsertBelow = (index: number, type: "code" | "markdown") => {
    const newCell: NotebookCellItem = {
      id: `cell_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      cell_type: type,
      source: "",
      outputs: [],
      execution_count: null,
    };

    const nextCells = [...notebook.cells];
    nextCells.splice(index + 1, 0, newCell);

    const updated = { cells: nextCells };
    setNotebook(updated);
    setActiveCellId(newCell.id);
    saveNotebookData(dashboardId, updated).catch(() => {});
  };

  const handleAddCellAtBottom = (type: "code" | "markdown") => {
    handleInsertBelow(notebook.cells.length - 1, type);
  };

  const handleDeleteCell = (cellId: string) => {
    if (notebook.cells.length <= 1) return;
    const nextCells = notebook.cells.filter((c) => c.id !== cellId);
    const updated = { cells: nextCells };
    setNotebook(updated);
    if (activeCellId === cellId && nextCells[0]) {
      setActiveCellId(nextCells[0].id);
    }
    saveNotebookData(dashboardId, updated).catch(() => {});
  };

  const handleMoveCell = (cellId: string, direction: "up" | "down") => {
    const idx = notebook.cells.findIndex((c) => c.id === cellId);
    if (idx < 0) return;
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= notebook.cells.length) return;

    const nextCells = [...notebook.cells];
    const [moved] = nextCells.splice(idx, 1);
    nextCells.splice(targetIdx, 0, moved);

    const updated = { cells: nextCells };
    setNotebook(updated);
    saveNotebookData(dashboardId, updated).catch(() => {});
  };

  const handleSourceChange = (cellId: string, newSource: string) => {
    const nextCells = notebook.cells.map((c) => (c.id === cellId ? { ...c, source: newSource } : c));
    setNotebook({ cells: nextCells });
  };

  const handleCellTypeChange = (cellId: string, newType: "code" | "markdown") => {
    const nextCells = notebook.cells.map((c) => (c.id === cellId ? { ...c, cell_type: newType, outputs: [] } : c));
    const updated = { cells: nextCells };
    setNotebook(updated);
    saveNotebookData(dashboardId, updated).catch(() => {});
  };

  // Materialize Derived Table
  const handleOpenDerivedModal = (varName: string, source: string) => {
    setTargetVarName(varName);
    setTargetVarCode(source || "");
    setDerivedTableName(`${varName}_summary`);
    setShowSaveModal(true);
  };

  const handleSaveDerived = async () => {
    if (!derivedTableName.trim() || !targetVarName) return;
    setIsSavingTable(true);
    try {
      await saveDerivedTable(dashboardId, derivedTableName.trim(), targetVarName, targetVarCode || undefined);
      setSaveStatus(`Table '${derivedTableName}' materialized successfully!`);
      setShowSaveModal(false);
      onTableCreated();
      setTimeout(() => setSaveStatus(null), 3500);
    } catch (err: unknown) {
      alert(`Failed to save derived table: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSavingTable(false);
    }
  };

  return (
    <div className={styles.notebookContainer}>
      {/* Notebook header toolbar */}
      <div className={styles.notebookToolbar}>
        <div className={styles.notebookTitleBlock}>
          <div className={styles.notebookTitle}>
            <Terminal size={14} color="var(--mb-color-brand)" />
            Notebook
          </div>
          <div className={styles.notebookSubtitle}>
            Python 3.9+ · Polars · {tables.length} table{tables.length === 1 ? "" : "s"} loaded
          </div>
        </div>

        <div className={styles.toolbarGroup}>
          <button
            type="button"
            onClick={() => handleAddCellAtBottom("code")}
            className={styles.toolBtn}
            title="Add a new Code cell"
          >
            <Code size={12} />
            Code
          </button>

          <button
            type="button"
            onClick={() => handleAddCellAtBottom("markdown")}
            className={styles.toolBtn}
            title="Add a new Markdown text cell"
          >
            <Type size={12} />
            Markdown
          </button>

          <button
            type="button"
            onClick={() => activeCellId && handleRunCell(activeCellId)}
            disabled={isKernelBusy || !activeCellId}
            className={`${styles.toolBtn} ${styles.toolBtnPrimary}`}
            title="Run active cell (Shift+Enter)"
          >
            <Play size={10} fill="#ffffff" />
            Run
          </button>

          <button
            type="button"
            onClick={handleRunAll}
            disabled={isKernelBusy}
            className={styles.toolBtn}
            title="Run all notebook cells sequentially"
          >
            <Play size={10} fill="currentColor" />
            Run All
          </button>

          <button
            type="button"
            onClick={handleClearAllOutputs}
            className={styles.toolBtn}
            title="Clear all cell outputs"
          >
            <Eraser size={11} />
            Clear
          </button>

          <button
            type="button"
            onClick={handleRestartKernel}
            disabled={isKernelBusy}
            className={styles.toolBtn}
            title="Restart Python kernel and clear variables"
          >
            <RotateCcw size={11} />
            Restart
          </button>

          <button
            type="button"
            onClick={() => {
              saveNotebookData(dashboardId, notebook);
              setSaveStatus("Notebook saved.");
              setTimeout(() => setSaveStatus(null), 2500);
            }}
            className={styles.toolBtn}
            title="Save notebook changes"
          >
            <Save size={11} />
            Save
          </button>
        </div>

        {/* Kernel status, loaded tables, save confirmation */}
        <div className={styles.notebookStatus}>
          {saveStatus && (
            <span className={styles.saveStatus}>
              <Check size={12} /> {saveStatus}
            </span>
          )}

          <span className={styles.kernelBadge}>
            <span className={`${styles.kernelDot} ${isKernelBusy ? styles.kernelDotBusy : ""}`} />
            {isKernelBusy ? "Kernel: busy" : "Kernel: idle"}
          </span>

          {tables.map((t) => (
            <span key={t.id} className={styles.tableChip} title={t.display_name}>
              <Database size={10} />
              {t.display_name}
            </span>
          ))}
        </div>
      </div>

      {/* Cells Sequence Area */}
      <div className={styles.cellsArea}>
        {notebook.cells.map((cell, idx) => (
          <div key={cell.id} className={styles.cellWrapper}>
            <NotebookCell
              cell={cell}
              isActive={cell.id === activeCellId}
              isExecuting={executingCellId === cell.id}
              onFocus={() => setActiveCellId(cell.id)}
              onSourceChange={(val) => handleSourceChange(cell.id, val)}
              onRunCell={() => handleRunCell(cell.id)}
              onDeleteCell={() => handleDeleteCell(cell.id)}
              onMoveUp={() => handleMoveCell(cell.id, "up")}
              onMoveDown={() => handleMoveCell(cell.id, "down")}
              onSaveDerivedTable={handleOpenDerivedModal}
              onTypeChange={(t) => handleCellTypeChange(cell.id, t)}
            />

            {/* VS Code Centered Hover Separator Bar between cells */}
            <div className={styles.insertDivider}>
              <div className={styles.dividerLine} />
              <div className={styles.insertBtns}>
                <button
                  type="button"
                  onClick={() => handleInsertBelow(idx, "code")}
                  className={styles.insertPillBtn}
                  title="Insert Code Cell below"
                >
                  <Plus size={10} /> Code
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertBelow(idx, "markdown")}
                  className={styles.insertPillBtn}
                  title="Insert Markdown Cell below"
                >
                  <Plus size={10} /> Markdown
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Save as Derived Table Modal */}
      {showSaveModal && (
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
            <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--mb-color-text-primary)", marginBottom: "0.5rem" }}>
              Materialize DataFrame to Dashboard Catalog
            </h3>
            <p style={{ fontSize: "0.8125rem", color: "var(--mb-color-text-muted)", marginBottom: "1rem" }}>
              Saves <code style={{ color: "var(--mb-color-brand)" }}>{targetVarName}</code> from this active kernel session into a queryable Parquet table.
            </p>

            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "0.25rem" }}>
                Derived Table Display Name:
              </label>
              <input
                type="text"
                value={derivedTableName}
                onChange={(e) => setDerivedTableName(e.target.value)}
                placeholder="e.g. channel_monthly_summary"
                style={{ width: "100%", padding: "0.4rem", borderRadius: "4px", border: "1px solid #cbd5e1", fontSize: "0.8125rem" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                disabled={isSavingTable}
                style={{ padding: "0.375rem 0.875rem", borderRadius: "4px", border: "1px solid #cbd5e1", background: "#ffffff", fontSize: "0.8125rem" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDerived}
                disabled={isSavingTable || !derivedTableName.trim()}
                style={{
                  padding: "0.375rem 1rem",
                  borderRadius: "4px",
                  border: "none",
                  backgroundColor: "var(--mb-color-brand)",
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: "0.8125rem",
                  cursor: isSavingTable ? "not-allowed" : "pointer",
                }}
              >
                {isSavingTable ? "Saving..." : "Materialize Table"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
