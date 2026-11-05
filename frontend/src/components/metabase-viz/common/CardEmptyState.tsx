import React from "react";
import { SearchX, RotateCcw } from "lucide-react";

export interface CardEmptyStateProps {
  isFiltered?: boolean;
  onResetFilters?: () => void;
  message?: string;
}

export const CardEmptyState: React.FC<CardEmptyStateProps> = ({
  isFiltered = false,
  onResetFilters,
  message,
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        minHeight: 120,
        padding: "1.5rem",
        textAlign: "center",
        color: "var(--mb-color-text-muted)",
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: "50%",
          backgroundColor: "var(--mb-color-bg-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "0.625rem",
          color: "var(--mb-color-text-subtle)",
        }}
      >
        <SearchX size={20} />
      </div>

      <div
        style={{
          fontSize: "0.875rem",
          fontWeight: 600,
          color: "var(--mb-color-text-secondary)",
          marginBottom: "0.25rem",
        }}
      >
        {isFiltered ? "No matching results" : "No data available"}
      </div>

      <div
        style={{
          fontSize: "0.75rem",
          color: "var(--mb-color-text-subtle)",
          maxWidth: 240,
          lineHeight: 1.4,
          marginBottom: isFiltered && onResetFilters ? "0.75rem" : 0,
        }}
      >
        {message ||
          (isFiltered
            ? "Your active filters produced no records. Try clearing filters to view baseline results."
            : "This card has no data rows to visualize.")}
      </div>

      {isFiltered && onResetFilters && (
        <button
          type="button"
          onClick={onResetFilters}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
            padding: "0.25rem 0.625rem",
            fontSize: "0.75rem",
            fontWeight: 600,
            borderRadius: "4px",
            border: "1px solid var(--mb-color-border-card)",
            backgroundColor: "#ffffff",
            color: "var(--mb-color-brand)",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--mb-color-brand)";
            e.currentTarget.style.backgroundColor = "rgba(80, 158, 227, 0.08)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--mb-color-border-card)";
            e.currentTarget.style.backgroundColor = "#ffffff";
          }}
        >
          <RotateCcw size={11} />
          Reset Filters
        </button>
      )}
    </div>
  );
};
