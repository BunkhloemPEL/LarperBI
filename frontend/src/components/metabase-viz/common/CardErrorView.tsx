import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export interface CardErrorViewProps {
  error: string;
  onRetry?: () => void;
}

export const CardErrorView: React.FC<CardErrorViewProps> = ({ error, onRetry }) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        minHeight: 120,
        padding: "1.25rem",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          backgroundColor: "rgba(239, 140, 140, 0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "0.5rem",
          color: "#dc2626",
        }}
      >
        <AlertTriangle size={18} />
      </div>

      <div
        style={{
          fontSize: "0.8125rem",
          fontWeight: 700,
          color: "var(--mb-color-text-primary)",
          marginBottom: "0.25rem",
        }}
      >
        Query execution error
      </div>

      <div
        style={{
          fontSize: "0.6875rem",
          color: "#64748b",
          maxWidth: 280,
          lineHeight: 1.35,
          marginBottom: onRetry ? "0.75rem" : 0,
          wordBreak: "break-word",
          fontFamily: "monospace",
          backgroundColor: "#f8fafc",
          padding: "0.375rem 0.5rem",
          borderRadius: "4px",
          border: "1px solid #e2e8f0",
        }}
      >
        {error}
      </div>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
            padding: "0.25rem 0.625rem",
            fontSize: "0.75rem",
            fontWeight: 600,
            borderRadius: "4px",
            border: "1px solid #cbd5e1",
            backgroundColor: "#ffffff",
            color: "var(--mb-color-text-primary)",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--mb-color-brand)";
            e.currentTarget.style.color = "var(--mb-color-brand)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#cbd5e1";
            e.currentTarget.style.color = "var(--mb-color-text-primary)";
          }}
        >
          <RefreshCw size={11} />
          Retry Query
        </button>
      )}
    </div>
  );
};
