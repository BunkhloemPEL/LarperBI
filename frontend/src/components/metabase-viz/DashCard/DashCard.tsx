import React, { type ReactNode } from "react";
import styles from "./DashCard.module.css";
import { Info, Download, GripVertical } from "lucide-react";
import { CardSkeleton } from "../common/CardSkeleton";
export interface DashCardProps {
  title?: string;
  description?: string;
  className?: string;
  children: ReactNode;
  onExportCsv?: () => void;
  isLoading?: boolean;
  isRevalidating?: boolean;
  actions?: ReactNode;
  vizType?: string;
}

export const DashCard: React.FC<DashCardProps> = ({
  title,
  description,
  className = "",
  children,
  onExportCsv,
  isLoading = false,
  isRevalidating = false,
  actions,
  vizType = "bar",
}) => {
  return (
    <div className={`${styles.cardRoot} ${className}`}>
      {(title || description) && (
        <div className={`${styles.cardHeader} card-drag-handle`}>
          <div className={`${styles.titleGroup} card-drag-handle`}>
            <GripVertical size={13} color="#94a3b8" style={{ cursor: "grab", flexShrink: 0 }} />
            <h3 className={styles.cardTitle}>{title}</h3>
            {description && (
              <span className={styles.infoTooltip} title={description} data-dontdrag="true">
                <Info size={14} />
              </span>
            )}
          </div>
          <div className={styles.actionsPanel} data-dontdrag="true">
            {isRevalidating && (
              <span className={styles.revalidatingSpinner} title="Updating card data..." />
            )}
            {actions}
            {onExportCsv && (
              <button
                type="button"
                data-dontdrag="true"
                onClick={onExportCsv}
                title="Export Data"
                className={styles.actionBtn}
              >
                <Download size={13} />
              </button>
            )}
          </div>
        </div>
      )}
      <div className={styles.cardContent}>
        {isLoading ? <CardSkeleton vizType={vizType} /> : children}
      </div>
    </div>
  );
};
