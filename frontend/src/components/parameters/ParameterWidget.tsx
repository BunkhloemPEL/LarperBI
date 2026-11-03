import React, { useState, useEffect, useRef } from "react";
import { Calendar, Tag, Search, X, Check, Filter } from "lucide-react";
import styles from "./ParameterWidget.module.css";
import { fetchDistinctColumnValues } from "../../services/api";
import type { FilterItem } from "../../types/larper";

export interface ParameterWidgetProps {
  dashboardId: string;
  filter: FilterItem;
  currentValue: unknown;
  onChange: (filterId: string, value: unknown) => void;
  onDeleteFilter?: (filterId: string) => void;
  isEditing?: boolean;
}

export const ParameterWidget: React.FC<ParameterWidgetProps> = ({
  dashboardId,
  filter,
  currentValue,
  onChange,
  onDeleteFilter,
  isEditing = false,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [distinctValues, setDistinctValues] = useState<(string | number | boolean)[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Load distinct values for category filters
  useEffect(() => {
    if (isOpen && filter.filter_type === "category" && distinctValues.length === 0) {
      fetchDistinctColumnValues(dashboardId, filter.table_id, filter.column_name)
        .then((vals) => setDistinctValues(vals))
        .catch((err) => console.error("Error loading distinct values:", err));
    }
  }, [isOpen, dashboardId, filter, distinctValues.length]);

  const hasValue = currentValue !== undefined && currentValue !== null && currentValue !== "" && !(Array.isArray(currentValue) && currentValue.length === 0);

  // Format label text
  let displayValueStr = "All";
  if (Array.isArray(currentValue) && currentValue.length > 0) {
    displayValueStr = currentValue.length === 1 ? String(currentValue[0]) : `${currentValue.length} selected`;
  } else if (typeof currentValue === "string" || typeof currentValue === "number") {
    displayValueStr = String(currentValue);
  } else if (currentValue && typeof currentValue === "object" && "start" in currentValue) {
    const range = currentValue as { start?: string; end?: string };
    displayValueStr = `${range.start || "Any"} ~ ${range.end || "Any"}`;
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(filter.id, null);
  };

  const handleToggleCategory = (val: string | number | boolean) => {
    const strVal = String(val);
    const existing = Array.isArray(currentValue) ? [...currentValue] : [];
    const idx = existing.indexOf(strVal);
    if (idx >= 0) {
      existing.splice(idx, 1);
    } else {
      existing.push(strVal);
    }
    onChange(filter.id, existing.length > 0 ? existing : null);
  };

  const filteredValues = distinctValues.filter((v) =>
    String(v).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const Icon = filter.filter_type === "date_range" ? Calendar : filter.filter_type === "category" ? Tag : Filter;

  return (
    <div style={{ position: "relative" }} ref={popoverRef}>
      {/* Parameter Pill Button */}
      <div
        className={`${styles.filterPill} ${hasValue ? styles.pillActive : ""}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Icon size={13} color={hasValue ? "var(--mb-color-brand)" : "#94a3b8"} />
        <span className={styles.pillLabel}>{filter.name}:</span>
        <span className={styles.pillValue}>{displayValueStr}</span>

        {hasValue && (
          <button
            type="button"
            className={styles.clearBtn}
            onClick={handleClear}
            title="Clear filter value"
          >
            <X size={12} />
          </button>
        )}

        {isEditing && onDeleteFilter && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteFilter(filter.id);
            }}
            title="Remove Filter"
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              marginLeft: "4px",
              padding: "2px",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#dc2626")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className={styles.popover}>
          {filter.filter_type === "category" && (
            <>
              <div className={styles.popoverHeader}>
                <Search size={12} color="#94a3b8" />
                <input
                  type="text"
                  placeholder="Search values..."
                  className={styles.popoverInput}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoFocus
                />
              </div>

              <div className={styles.popoverList}>
                {filteredValues.map((v) => {
                  const strVal = String(v);
                  const isChecked = Array.isArray(currentValue) && currentValue.includes(strVal);
                  return (
                    <div
                      key={strVal}
                      className={`${styles.popoverItem} ${isChecked ? styles.popoverItemActive : ""}`}
                      onClick={() => handleToggleCategory(v)}
                    >
                      <div
                        style={{
                          width: "14px",
                          height: "14px",
                          borderRadius: "3px",
                          border: isChecked ? "none" : "1px solid #cbd5e1",
                          backgroundColor: isChecked ? "var(--mb-color-brand)" : "#ffffff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {isChecked && <Check size={10} color="#ffffff" />}
                      </div>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {strVal}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className={styles.popoverFooter}>
                <button
                  type="button"
                  className={styles.footerAction}
                  onClick={() => onChange(filter.id, distinctValues.map((v) => String(v)))}
                >
                  Select All
                </button>
                <button
                  type="button"
                  className={styles.footerAction}
                  style={{ color: "#dc2626" }}
                  onClick={() => onChange(filter.id, null)}
                >
                  Clear
                </button>
              </div>
            </>
          )}

          {filter.filter_type === "date_range" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--mb-color-text-secondary)", marginBottom: "0.25rem" }}>
                Date Range Presets
              </div>
              <button
                type="button"
                className={styles.popoverItem}
                onClick={() => {
                  onChange(filter.id, { start: "2019-01-01", end: "2019-10-31" });
                  setIsOpen(false);
                }}
              >
                2019 Year-to-Date
              </button>
              <button
                type="button"
                className={styles.popoverItem}
                onClick={() => {
                  onChange(filter.id, { start: "2018-01-01", end: "2018-12-31" });
                  setIsOpen(false);
                }}
              >
                Full Year 2018
              </button>
              <button
                type="button"
                className={styles.popoverItem}
                onClick={() => {
                  onChange(filter.id, { start: "2010-01-01", end: "2019-10-31" });
                  setIsOpen(false);
                }}
              >
                All History (2010-2019)
              </button>

              <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "0.5rem", marginTop: "0.25rem" }}>
                <span style={{ fontSize: "0.6875rem", color: "#64748b", fontWeight: 600 }}>Custom Range:</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.375rem", marginTop: "0.25rem" }}>
                  <input
                    type="date"
                    style={{ fontSize: "0.6875rem", padding: "0.25rem", borderRadius: "4px", border: "1px solid #cbd5e1" }}
                    onChange={(e) => {
                      const cur = (currentValue as { start?: string; end?: string }) || {};
                      onChange(filter.id, { ...cur, start: e.target.value });
                    }}
                  />
                  <input
                    type="date"
                    style={{ fontSize: "0.6875rem", padding: "0.25rem", borderRadius: "4px", border: "1px solid #cbd5e1" }}
                    onChange={(e) => {
                      const cur = (currentValue as { start?: string; end?: string }) || {};
                      onChange(filter.id, { ...cur, end: e.target.value });
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {filter.filter_type === "text" && (
            <div style={{ padding: "0.25rem" }}>
              <input
                type="text"
                placeholder="Search text..."
                value={typeof currentValue === "string" ? currentValue : ""}
                onChange={(e) => onChange(filter.id, e.target.value || null)}
                style={{ width: "100%", padding: "0.375rem", fontSize: "0.8125rem", borderRadius: "4px", border: "1px solid #cbd5e1" }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
