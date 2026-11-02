import React from "react";
import { formatCurrencyCompact } from "../CartesianChart/echarts-utils";

export interface ProgressBarProps {
  current: number;
  goal: number;
  label?: string;
  unit?: string;
  color?: string;
  isCurrency?: boolean;
  className?: string;
  height?: number | string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  current,
  goal,
  label = "Monthly Volume Target",
  unit = "",
  color = "var(--mb-color-brand)",
  isCurrency = false,
  className = "",
}) => {
  const percentage = Math.min(Math.max((current / (goal || 1)) * 100, 0), 100);
  const formattedCurrent = isCurrency ? formatCurrencyCompact(current) : `${current.toLocaleString()}${unit}`;
  const formattedGoal = isCurrency ? formatCurrencyCompact(goal) : `${goal.toLocaleString()}${unit}`;

  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        height: "100%",
        padding: "0.5rem 0",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.5rem" }}>
        <div>
          <span style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--mb-color-text-primary)" }}>
            {formattedCurrent}
          </span>
          <span style={{ fontSize: "0.8125rem", color: "var(--mb-color-text-muted)", marginLeft: "0.375rem" }}>
            / {formattedGoal}
          </span>
        </div>
        <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--mb-color-text-primary)" }}>
          {percentage.toFixed(1)}%
        </span>
      </div>

      {/* Progress Track */}
      <div
        style={{
          width: "100%",
          height: "14px",
          backgroundColor: "#f1f5f9",
          borderRadius: "9999px",
          overflow: "hidden",
          position: "relative",
          border: "1px solid #e2e8f0",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${percentage}%`,
            backgroundColor: color,
            borderRadius: "9999px",
            transition: "width 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--mb-color-text-subtle)", fontWeight: 500 }}>
          {label}
        </span>
        <span style={{ fontSize: "0.75rem", color: "var(--mb-color-text-subtle)" }}>
          {percentage >= 100 ? "Goal Exceeded" : `${(100 - percentage).toFixed(1)}% remaining`}
        </span>
      </div>
    </div>
  );
};
