import React, { useState, useEffect, useRef } from "react";
import styles from "./SmartScalar.module.css";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import type { SmartScalarItem } from "../../../types/dashboard";
import { getScalarSizeTier, compactifyValue } from "./sizing";

export interface SmartScalarProps {
  data?: Partial<SmartScalarItem> | null;
  className?: string;
  isZoomed?: boolean;
}

export const SmartScalar: React.FC<SmartScalarProps> = ({ data, className = "", isZoomed = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateSize();
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  if (!data) {
    return (
      <div ref={containerRef} className={`${styles.scalarContainer} ${className}`}>
        <div className={styles.mainValue}>-</div>
        <div className={styles.subLabel}>No metric data</div>
      </div>
    );
  }

  const rawFormatted = data.formatted_value || (typeof data.current_value === "number" ? data.current_value.toLocaleString() : "0");
  const title = data.title || "Metric";
  const pct = typeof data.percent_change === "number" ? data.percent_change : 0;
  const isFavorable = data.is_favorable ?? true;
  const compLabel = data.comparison_label || "vs baseline";

  // Tier calculation (Tier 600 in zoom or when dimensions are large)
  const tier = isZoomed
    ? getScalarSizeTier(800, 400)
    : getScalarSizeTier(dimensions.width || 300, dimensions.height || 160);

  // Auto-compactify if space is constrained
  const shouldCompact = !isZoomed && (tier.size <= 250 || (rawFormatted.length > 9 && (dimensions.width || 300) < 280));
  const displayValue = shouldCompact ? compactifyValue(rawFormatted) : rawFormatted;
  const isCompact = displayValue !== rawFormatted;

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
    <div
      ref={containerRef}
      className={`${styles.scalarContainer} ${isZoomed ? styles.zoomedContainer : ""} ${className}`}
      style={{ gap: `${tier.gap}px` }}
    >
      <div
        className={styles.mainValue}
        style={{ fontSize: `${tier.valueFontSize}px` }}
        title={isCompact ? rawFormatted : undefined}
      >
        {displayValue}
      </div>

      <div
        className={styles.subLabel}
        style={{ fontSize: `${tier.titleFontSize}px` }}
      >
        {title}
      </div>

      <div className={styles.comparisonRow}>
        <span
          className={`${styles.trendBadge} ${badgeClass}`}
          style={{ fontSize: `${tier.badgeFontSize}px` }}
        >
          {isUp && <ArrowUpRight size={tier.symbolSize} />}
          {isDown && <ArrowDownRight size={tier.symbolSize} />}
          {!isUp && !isDown && <Minus size={tier.symbolSize} />}
          {sign}{pct.toFixed(1)}%
        </span>
        <span className={styles.comparisonText}>{compLabel}</span>
      </div>
    </div>
  );
};
