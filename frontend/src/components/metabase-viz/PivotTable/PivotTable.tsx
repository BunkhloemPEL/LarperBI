import React, { useMemo } from "react";
import styles from "./PivotTable.module.css";
import { formatCurrencyCompact } from "../CartesianChart/echarts-utils";

export interface PivotMatrixData {
  rowDimensionTitle: string;
  colDimensionTitle: string;
  rows: string[];
  columns: string[];
  values: number[][]; // values[rowIndex][colIndex]
}

export interface PivotTableProps {
  data: PivotMatrixData;
  isCurrency?: boolean;
  showHeatmap?: boolean;
  height?: number | string;
  className?: string;
}

export const PivotTable: React.FC<PivotTableProps> = ({
  data,
  isCurrency = true,
  showHeatmap = true,
  className = "",
}) => {
  const { rowDimensionTitle, colDimensionTitle, rows, columns, values } = data;

  // Compute row totals, column totals, and grand total
  const { rowTotals, colTotals, grandTotal, maxVal } = useMemo(() => {
    const rTotals: number[] = [];
    const cTotals: number[] = new Array(columns.length).fill(0);
    let gTotal = 0;
    let mVal = 0;

    for (let r = 0; r < rows.length; r++) {
      let rSum = 0;
      for (let c = 0; c < columns.length; c++) {
        const val = values[r]?.[c] ?? 0;
        rSum += val;
        cTotals[c] += val;
        if (val > mVal) mVal = val;
      }
      rTotals.push(rSum);
      gTotal += rSum;
    }

    return { rowTotals: rTotals, colTotals: cTotals, grandTotal: gTotal, maxVal: mVal || 1 };
  }, [rows, columns, values]);

  const formatCell = (val: number) => {
    return isCurrency ? formatCurrencyCompact(val) : val.toLocaleString();
  };

  return (
    <div className={`${styles.pivotContainer} ${className}`}>
      <table className={styles.pivotTable}>
        <thead>
          <tr>
            <th className={styles.cornerHeader}>
              {rowDimensionTitle} \ {colDimensionTitle}
            </th>
            {columns.map((col) => (
              <th key={col} className={styles.colHeader}>
                {col}
              </th>
            ))}
            <th className={styles.colHeader} style={{ background: "#edf2f7" }}>
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((rowName, rIdx) => {
            return (
              <tr key={rowName}>
                <td className={styles.rowHeader}>{rowName}</td>
                {columns.map((_, cIdx) => {
                  const val = values[rIdx]?.[cIdx] ?? 0;
                  const ratio = Math.min(val / maxVal, 1);
                  const bg = showHeatmap && val > 0 ? `rgba(80, 158, 227, ${0.05 + ratio * 0.28})` : undefined;

                  return (
                    <td key={cIdx} className={styles.dataCell} style={{ backgroundColor: bg }}>
                      {formatCell(val)}
                    </td>
                  );
                })}
                <td className={styles.totalCell}>{formatCell(rowTotals[rIdx] ?? 0)}</td>
              </tr>
            );
          })}
          {/* Summary / Total Row */}
          <tr className={styles.totalRow}>
            <td className={styles.totalHeader}>Total</td>
            {colTotals.map((cTot, cIdx) => (
              <td key={cIdx} className={styles.totalCell}>
                {formatCell(cTot)}
              </td>
            ))}
            <td className={styles.totalCell} style={{ background: "#e2e8f0" }}>
              {formatCell(grandTotal)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};
