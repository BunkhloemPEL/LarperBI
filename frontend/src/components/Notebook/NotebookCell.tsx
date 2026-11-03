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
  onSaveDerivedTable: (varName: string, source: string) => void;
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
  const [isEditingMarkdown, setIsEditingMarkdown] = useState<boolean>(
    cell.cell_type === "markdown" && !cell.source.trim()
  );

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
      {/* Left gutter: run + execution status */}
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
                <RotateCw
                  size={12}
                  style={{ animation: "spin 1s linear infinite" }}
                />
              ) : (
                <Play size={11} fill="currentColor" />
              )}
            </button>

            <div className={styles.execStatus}>
              {cell.execution_count !== undefined && cell.execution_count !== null && (
                <span className={styles.execPill}>In [{cell.execution_count}]</span>
              )}
              {durationStr && !isExecuting && (
                <span className={styles.durationBadge} title={`Execution duration: ${durationStr}`}>
                  <Check size={9} strokeWidth={3} />
                  {durationStr}
                </span>
              )}
            </div>
          </>
        ) : (
          <span style={{ color: "var(--mb-color-text-subtle)", fontSize: "0.625rem", fontWeight: 700 }}>
            MD
          </span>
        )}
      </div>

      {/* Cell body */}
      <div className={styles.cellBody}>
        <div className={styles.cellTopBar}>
          <span className={styles.cellTypeLabel}>
            {cell.cell_type === "code" ? "Python" : "Markdown"}
          </span>

          <div className={styles.cellActions}>
            <select
              className={styles.cellTypeSelect}
              value={cell.cell_type}
              onChange={(e) => onTypeChange(e.target.value as "code" | "markdown")}
              title="Change cell type"
            >
              <option value="code">Code</option>
              <option value="markdown">Markdown</option>
            </select>

            <button type="button" onClick={onMoveUp} title="Move Cell Up" className={styles.cellActionBtn}>
              <ChevronUp size={13} />
            </button>
            <button type="button" onClick={onMoveDown} title="Move Cell Down" className={styles.cellActionBtn}>
              <ChevronDown size={13} />
            </button>
            <button
              type="button"
              onClick={onDeleteCell}
              title="Delete Cell"
              className={`${styles.cellActionBtn} ${styles.cellActionBtnDanger}`}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

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
            <div className={styles.editorBox}>
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
              className={styles.markdownEditor}
              value={cell.source}
              placeholder="Type Markdown notes..."
              onChange={(e) => onSourceChange(e.target.value)}
              onBlur={() => setIsEditingMarkdown(false)}
              autoFocus
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

        {cell.outputs && cell.outputs.length > 0 && (
          <div className={styles.cellOutputs}>
            {cell.outputs.map((out, oIdx) => (
              <div key={oIdx} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {out.text && <pre className={styles.stdoutBox}>{out.text}</pre>}

                {out.result_text && (
                  <pre className={styles.resultBox}>
                    <span className={styles.resultLabel}>Out [{cell.execution_count}]:</span>
                    {out.result_text}
                  </pre>
                )}

                {out.error && (
                  <div className={styles.errorBox}>
                    <div className={styles.errorTitle}>
                      <AlertTriangle size={13} /> Execution Error
                    </div>
                    {out.error}
                  </div>
                )}

                {out.table_preview && (
                  <div className={styles.dataViewer}>
                    <div className={styles.dataViewerHeader}>
                      <span>
                        DataFrame:{" "}
                        <code style={{ color: "var(--mb-color-brand)" }}>{out.table_preview.var_name}</code>{" "}
                        ({out.table_preview.row_count.toLocaleString()} rows,{" "}
                        {out.table_preview.columns.length} columns)
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onSaveDerivedTable(out.table_preview?.var_name || "df_summary", cell.source)
                        }
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
                            <th style={{ width: "36px", color: "var(--mb-color-text-subtle)" }}>#</th>
                            {out.table_preview.columns.map((col) => (
                              <th key={col}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {out.table_preview.rows.map((row, rIdx) => (
                            <tr key={rIdx}>
                              <td style={{ color: "var(--mb-color-text-subtle)", fontSize: "0.625rem" }}>
                                {rIdx}
                              </td>
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

                {out.plot_base64 && (
                  <div style={{ padding: "0.25rem 0" }}>
                    <img
                      src={`data:image/png;base64,${out.plot_base64}`}
                      alt="Inline Matplotlib Plot"
                      style={{
                        maxWidth: "100%",
                        maxHeight: "420px",
                        borderRadius: "6px",
                        border: "1px solid var(--mb-color-border-card)",
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
