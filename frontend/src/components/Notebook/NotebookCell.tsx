import React, { useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { vscodeLight } from "@uiw/codemirror-theme-vscode";
import {
  Play,
  Trash2,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Check,
  AlertTriangle,
  RotateCw,
} from "lucide-react";
import styles from "./Notebook.module.css";
import type { NotebookCellItem } from "../../types/larper";

export interface NotebookCellProps {
  cell: NotebookCellItem;
  isActive: boolean;
  isExecuting?: boolean;
  onFocus: () => void;
  onSourceChange: (newSource: string) => void;
  onRunCell: () => void;
  onDeleteCell: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onSaveDerivedTable: (varName: string) => void;
  onTypeChange: (newType: "code" | "markdown") => void;
}

export const NotebookCell: React.FC<NotebookCellProps> = ({
  cell,
  isActive,
  isExecuting = false,
  onFocus,
  onSourceChange,
  onRunCell,
  onDeleteCell,
  onMoveUp,
  onMoveDown,
  onSaveDerivedTable,
  onTypeChange,
}) => {
  const [isEditingMarkdown, setIsEditingMarkdown] = useState<boolean>(cell.cell_type === "markdown" && !cell.source.trim());

  const durationStr =
    typeof cell.duration_ms === "number"
      ? cell.duration_ms >= 1000
        ? `${(cell.duration_ms / 1000).toFixed(2)}s`
        : `${cell.duration_ms}ms`
      : null;

  return (
    <div
      className={`${styles.cellCard} ${isActive ? styles.cellFocused : ""}`}
      onClick={onFocus}
    >
      {/* Left Gutter: Run Button & Execution Status (VS Code Style) */}
      <div className={styles.leftGutter}>
        {cell.cell_type === "code" ? (
          <>
            <button
              type="button"
              onClick={onRunCell}
              disabled={isExecuting}
              title="Execute Cell (Shift+Enter)"
              className={styles.playBtn}
            >
              {isExecuting ? (
                <RotateCw size={12} className="spin" style={{ animation: "spin 1s linear infinite" }} />
              ) : (
                <Play size={11} fill="currentColor" />
              )}
            </button>

            <div className={styles.execStatus}>
              {cell.execution_count !== undefined && cell.execution_count !== null && (
                <span className={styles.executionCountText}>[{cell.execution_count}]</span>
              )}
              {durationStr && !isExecuting && (
                <span className={styles.durationBadge} title={`Execution duration: ${durationStr}`}>
                  <Check size={10} strokeWidth={3} />
                  {durationStr}
                </span>
              )}
            </div>
          </>
        ) : (
          <div style={{ color: "#94a3b8", fontSize: "0.6875rem", fontWeight: 700 }}>
            MD
          </div>
        )}
      </div>

      {/* Center Body: Top Bar, Editor, Outputs */}
      <div className={styles.cellBody}>
        {/* Top Mini Bar with Cell Actions */}
        <div className={styles.cellTopBar}>

          <div className={styles.cellActions}>
            <select
              value={cell.cell_type}
              onChange={(e) => onTypeChange(e.target.value as "code" | "markdown")}
              style={{
                fontSize: "0.6875rem",
                padding: "0.15rem 0.35rem",
                borderRadius: "3px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#475569",
              }}
            >
              <option value="code">Code</option>
              <option value="markdown">Markdown</option>
            </select>

            <button
              type="button"
              onClick={onMoveUp}
              title="Move Cell Up"
              className={styles.cellActionBtn}
            >
              <ChevronUp size={13} />
            </button>

            <button
              type="button"
              onClick={onMoveDown}
              title="Move Cell Down"
              className={styles.cellActionBtn}
            >
              <ChevronDown size={13} />
            </button>

            <button
              type="button"
              onClick={onDeleteCell}
              title="Delete Cell"
              className={styles.cellActionBtn}
              style={{ color: "#ef4444" }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Editor Area */}
        {cell.cell_type === "code" ? (
          <div
            className={styles.editorContainer}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.shiftKey || e.metaKey)) {
                e.preventDefault();
                onRunCell();
              }
            }}
          >
            <CodeMirror
              value={cell.source}
              placeholder="# Enter Python code"
              extensions={[python()]}
              onChange={onSourceChange}
              theme={vscodeLight}
              autoFocus={isActive}
              basicSetup={{
                lineNumbers: true,
                highlightActiveLineGutter: true,
                bracketMatching: true,
                autocompletion: true,
                foldGutter: false,
              }}
            />
          </div>
        ) : isEditingMarkdown ? (
          <div
            className={styles.editorContainer}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.shiftKey || e.metaKey)) {
                e.preventDefault();
                setIsEditingMarkdown(false);
              }
            }}
          >
            <textarea
              value={cell.source}
              placeholder="Type Markdown notes..."
              onChange={(e) => onSourceChange(e.target.value)}
              onBlur={() => setIsEditingMarkdown(false)}
              autoFocus
              style={{
                width: "100%",
                minHeight: "70px",
                padding: "0.5rem",
                border: "1px solid #cbd5e1",
                borderRadius: "4px",
                outline: "none",
                fontFamily: "var(--mb-font-sans)",
                fontSize: "0.875rem",
                resize: "vertical",
              }}
            />
          </div>
        ) : (
          <div
            className={styles.markdownContainer}
            onDoubleClick={() => setIsEditingMarkdown(true)}
            title="Double-click to edit Markdown notes"
          >
            <div style={{ whiteSpace: "pre-wrap" }}>
              {cell.source || "Double-click to type Markdown notes..."}
            </div>
          </div>
        )}

        {/* Cell Output Area (Directly underneath) */}
        {cell.outputs && cell.outputs.length > 0 && (
          <div className={styles.cellOutputs}>
            {cell.outputs.map((out, oIdx) => (
              <div key={oIdx} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {/* Standard Output (stdout/stderr) */}
                {out.text && (
                  <pre className={styles.stdoutBox}>{out.text}</pre>
                )}

                {/* Expression Return Value (e.g. 84 or tuples) */}
                {out.result_text && (
                  <pre className={styles.resultBox}>
                    <span style={{ color: "#d84315", fontWeight: 700, marginRight: "8px" }}>
                      Out [{cell.execution_count}]:
                    </span>
                    {out.result_text}
                  </pre>
                )}

                {/* Error Traceback Callout */}
                {out.error && (
                  <div className={styles.errorBox}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontWeight: 700, marginBottom: "0.25rem" }}>
                      <AlertTriangle size={14} /> Execution Error
                    </div>
                    {out.error}
                  </div>
                )}

                {/* Interactive DataFrame Table (ONLY when cell evaluated to a DataFrame!) */}
                {out.table_preview && (
                  <div className={styles.dataViewer}>
                    <div className={styles.dataViewerHeader}>
                      <span style={{ fontWeight: 600, color: "#334155" }}>
                        DataFrame: <code style={{ color: "#0078d4" }}>{out.table_preview.var_name}</code> ({out.table_preview.row_count.toLocaleString()} rows, {out.table_preview.columns.length} columns)
                      </span>

                      <button
                        type="button"
                        onClick={() => onSaveDerivedTable(out.table_preview?.var_name || "df_summary")}
                        className={styles.saveDerivedBtn}
                        title="Materialize this DataFrame as a first-class table in the dashboard catalog"
                      >
                        <Sparkles size={11} />
                        Save as Derived Table
                      </button>
                    </div>

                    <div style={{ overflowX: "auto" }}>
                      <table className={styles.dataViewerTable}>
                        <thead>
                          <tr>
                            <th style={{ width: "40px", color: "#94a3b8" }}>#</th>
                            {out.table_preview.columns.map((col) => (
                              <th key={col}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {out.table_preview.rows.map((row, rIdx) => (
                            <tr key={rIdx}>
                              <td style={{ color: "#94a3b8", fontSize: "0.6875rem" }}>{rIdx}</td>
                              {row.map((val, cIdx) => (
                                <td key={cIdx}>{String(val)}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Matplotlib Inline Plot Output */}
                {out.plot_base64 && (
                  <div style={{ padding: "0.5rem 0" }}>
                    <img
                      src={`data:image/png;base64,${out.plot_base64}`}
                      alt="Inline Matplotlib Plot"
                      style={{
                        maxWidth: "100%",
                        maxHeight: "420px",
                        borderRadius: "4px",
                        border: "1px solid #e2e8f0",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
