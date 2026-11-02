import React from "react";
import styles from "./SmartScalar.module.css";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import type { SmartScalarItem } from "../../../types/dashboard";

export interface SmartScalarProps {
  data?: Partial<SmartScalarItem> | null;
  className?: string;
}

export const SmartScalar: React.FC<SmartScalarProps> = ({ data, className = "" }) => {
  if (!data) {
    return (
      <div className={`${styles.scalarContainer} ${className}`}>
        <div className={styles.mainValue}>-</div>
        <div className={styles.subLabel}>No metric data</div>
      </div>
    );
  }

  const formattedValue = data.formatted_value || (typeof data.current_value === "number" ? data.current_value.toLocaleString() : "0");
  const title = data.title || "Metric";
  const pct = typeof data.percent_change === "number" ? data.percent_change : 0;
  const isFavorable = data.is_favorable ?? true;
  const compLabel = data.comparison_label || "vs baseline";

  const isUp = pct > 0;
  const isDown = pct < 0;

  const isGood = isFavorable ? isUp : isDown;
  const isBad = isFavorable ? isDown : isUp;

  let badgeClass = styles.neutral;
  if (pct !== 0) {
    badgeClass = isGood ? styles.positive : isBad ? styles.negative : styles.neutral;
  }

  const sign = pct > 0 ? "+" : "";

  return (
    <div className={`${styles.scalarContainer} ${className}`}>
      <div className={styles.mainValue}>{formattedValue}</div>
      <div className={styles.subLabel}>{title}</div>
      <div className={styles.comparisonRow}>
        <span className={`${styles.trendBadge} ${badgeClass}`}>
          {isUp && <ArrowUpRight size={13} />}
          {isDown && <ArrowDownRight size={13} />}
          {!isUp && !isDown && <Minus size={13} />}
          {sign}{pct.toFixed(1)}%
        </span>
        <span className={styles.comparisonText}>{compLabel}</span>
      </div>
    </div>
  );
};
