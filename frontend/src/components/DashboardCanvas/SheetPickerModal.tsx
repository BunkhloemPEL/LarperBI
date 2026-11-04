import React, { useMemo, useState } from "react";
import { FileSpreadsheet, X, Check, AlertTriangle } from "lucide-react";
import styles from "./SheetPickerModal.module.css";
import type { SheetPreview } from "../../types/larper";

export interface SheetPickerModalProps {
  filename: string;
  sheets: SheetPreview[];
  isImporting: boolean;
  onCancel: () => void;
  onConfirm: (sheets: string[]) => void;
}

export const SheetPickerModal: React.FC<SheetPickerModalProps> = ({
  filename,
  sheets,
  isImporting,
  onCancel,
  onConfirm,
}) => {
  const usableSheets = useMemo(
    () => sheets.filter((sheet) => !sheet.is_empty && !sheet.error),
    [sheets]
  );
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(usableSheets.map((sheet) => sheet.name))
  );
  const [activeName, setActiveName] = useState<string>(
    usableSheets[0]?.name ?? sheets[0]?.name ?? ""
  );

  const activeSheet = sheets.find((sheet) => sheet.name === activeName) ?? sheets[0];
  const allSelected =
    usableSheets.length > 0 && usableSheets.every((sheet) => selected.has(sheet.name));

  const toggleSheet = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(usableSheets.map((sheet) => sheet.name)));
  };

  return (
    <div
      className={styles.backdrop}
      onMouseDown={() => {
        if (!isImporting) onCancel();
      }}
    >
      <div className={styles.modal} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleBlock}>
            <div className={styles.title}>
              <FileSpreadsheet size={16} color="var(--mb-color-brand)" />
              Select sheets
            </div>
            <div className={styles.subtitle}>{filename}</div>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onCancel}
            disabled={isImporting}
            aria-label="Close sheet picker"
          >
            <X size={16} />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.sheetList}>
            <div className={`${styles.sheetRow} ${styles.selectAllRow}`}>
              <button
                type="button"
                role="checkbox"
                aria-checked={allSelected}
                aria-label="Select all sheets"
                className={`${styles.checkbox} ${allSelected ? styles.checkboxChecked : ""}`}
                onClick={toggleAll}
                disabled={usableSheets.length === 0 || isImporting}
              >
                {allSelected && <Check size={10} strokeWidth={3} />}
              </button>
              <span className={styles.sheetName}>Select all sheets</span>
            </div>

            {sheets.map((sheet) => {
              const disabled = sheet.is_empty || !!sheet.error;
              const checked = selected.has(sheet.name);
              return (
                <div
                  key={sheet.name}
                  className={`${styles.sheetRow} ${
                    sheet.name === activeName ? styles.sheetRowActive : ""
                  }`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveName(sheet.name)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setActiveName(sheet.name);
                    }
                  }}
                  title={sheet.error ?? (sheet.is_empty ? "This sheet has no data rows" : sheet.name)}
                >
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    aria-label={`Select ${sheet.name}`}
                    className={`${styles.checkbox} ${checked ? styles.checkboxChecked : ""} ${
                      disabled ? styles.checkboxDisabled : ""
                    }`}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!disabled) toggleSheet(sheet.name);
                    }}
                    disabled={disabled || isImporting}
                  >
                    {checked && !disabled && <Check size={10} strokeWidth={3} />}
                  </button>
                  <span className={styles.sheetName}>{sheet.name}</span>
                  <span className={styles.sheetMeta}>
                    {sheet.error ? (
                      <AlertTriangle size={12} />
                    ) : sheet.is_empty ? (
                      "empty"
                    ) : (
                      `${sheet.columns.length} col${sheet.columns.length === 1 ? "" : "s"}`
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          <div className={styles.previewPane}>
            {activeSheet ? (
              activeSheet.error ? (
                <div className={styles.previewEmpty}>
                  <AlertTriangle size={18} />
                  <span>Could not read this sheet: {activeSheet.error}</span>
                </div>
              ) : activeSheet.columns.length === 0 ? (
                <div className={styles.previewEmpty}>No columns found in this sheet.</div>
              ) : (
                <>
                  <div className={styles.previewHeader}>
                    <span className={styles.previewTitle}>{activeSheet.name}</span>
                    <span className={styles.previewMeta}>
                      {activeSheet.columns.length} columns · preview
                    </span>
                  </div>
                  <div className={styles.tableScroll}>
                    <table className={styles.previewTable}>
                      <thead>
                        <tr>
                          {activeSheet.columns.map((column) => (
                            <th key={column}>{column}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {activeSheet.preview_rows.length === 0 ? (
                          <tr>
                            <td colSpan={activeSheet.columns.length} className={styles.noRows}>
                              No data rows
                            </td>
                          </tr>
                        ) : (
                          activeSheet.preview_rows.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                              {activeSheet.columns.map((column, colIndex) => (
                                <td key={column}>
                                  {row[colIndex] === null || row[colIndex] === undefined
                                    ? "null"
                                    : String(row[colIndex])}
                                </td>
                              ))}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )
            ) : (
              <div className={styles.previewEmpty}>No sheets found in this workbook.</div>
            )}
          </div>
        </div>

        <div className={styles.footer}>
          <span className={styles.selectionSummary}>
            {selected.size} of {usableSheets.length} sheet
            {usableSheets.length === 1 ? "" : "s"} selected
          </span>
          <div className={styles.footerActions}>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={onCancel}
              disabled={isImporting}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => onConfirm(Array.from(selected))}
              disabled={isImporting || selected.size === 0}
            >
              {isImporting
                ? "Importing…"
                : `Import ${selected.size} sheet${selected.size === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
