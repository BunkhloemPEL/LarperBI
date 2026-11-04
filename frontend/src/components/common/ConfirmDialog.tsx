import React, { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import styles from "./ConfirmDialog.module.css";

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isBusy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  isBusy = false,
  onCancel,
  onConfirm,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isBusy) onCancel();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, isBusy, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className={styles.backdrop}
      onMouseDown={() => {
        if (!isBusy) onCancel();
      }}
    >
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.iconWrap}>
            <AlertTriangle size={16} />
          </div>
          <div className={styles.headerText}>
            <div id="confirm-dialog-title" className={styles.title}>
              {title}
            </div>
            {message && <p className={styles.message}>{message}</p>}
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onCancel}
            disabled={isBusy}
            aria-label="Close confirmation dialog"
          >
            <X size={15} />
          </button>
        </div>

        <div className={styles.footer}>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={onCancel}
            disabled={isBusy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={styles.destructiveBtn}
            onClick={onConfirm}
            disabled={isBusy}
          >
            {isBusy ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
