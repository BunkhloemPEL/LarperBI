import React, { useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import styles from "./TableInteractive.module.css";
import { Search, ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react";
import type { MerchantItem } from "../../../types/dashboard";

export interface TableInteractiveProps {
  data: MerchantItem[];
  page: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (newPage: number) => void;
  sortBy: string;
  sortDesc: boolean;
  onSortChange: (column: string) => void;
  search: string;
  onSearchChange: (val: string) => void;
  riskFilter: string;
  onRiskFilterChange: (val: string) => void;
  isLoading?: boolean;
}

export const TableInteractive: React.FC<TableInteractiveProps> = ({
  data,
  page,
  totalPages,
  totalCount,
  onPageChange,
  sortBy,
  sortDesc,
  onSortChange,
  search,
  onSearchChange,
  riskFilter,
  onRiskFilterChange,
  isLoading = false,
}) => {
  const columns = useMemo<ColumnDef<MerchantItem>[]>(
    () => [
      {
        accessorKey: "merchant_id",
        header: "Merchant ID",
        cell: (info) => (
          <span className={styles.tableCellBold}>#{info.getValue<number>()}</span>
        ),
      },
      {
        accessorKey: "merchant_city",
        header: "Location",
        cell: (info) => {
          const row = info.row.original;
          return `${row.merchant_city}, ${row.merchant_state}`;
        },
      },
      {
        accessorKey: "mcc_desc",
        header: "Category (MCC)",
        cell: (info) => info.getValue<string>(),
      },
      {
        accessorKey: "total_amount",
        header: "Total Volume",
        cell: (info) => (
          <div className={styles.tableCellRight}>
            ${info.getValue<number>().toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        ),
      },
      {
        accessorKey: "tx_count",
        header: "Transactions",
        cell: (info) => (
          <div className={styles.tableCellRight}>
            {info.getValue<number>().toLocaleString()}
          </div>
        ),
      },
      {
        accessorKey: "fraud_amount",
        header: "Fraud Losses",
        cell: (info) => (
          <div className={`${styles.tableCellRight} ${info.getValue<number>() > 0 ? styles.tableCellBold : ""}`} style={{ color: info.getValue<number>() > 0 ? "#dc2626" : undefined }}>
            ${info.getValue<number>().toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        ),
      },
      {
        accessorKey: "fraud_rate_pct",
        header: "Fraud Rate",
        cell: (info) => (
          <div className={styles.tableCellRight}>
            {info.getValue<number>().toFixed(2)}%
          </div>
        ),
      },
      {
        accessorKey: "risk_level",
        header: "Risk Tier",
        cell: (info) => {
          const risk = info.getValue<string>();
          let badgeClass = styles.badgeLow;
          if (risk === "CRITICAL") badgeClass = styles.badgeCritical;
          else if (risk === "HIGH") badgeClass = styles.badgeHigh;
          else if (risk === "MEDIUM") badgeClass = styles.badgeMedium;

          return <span className={`${styles.riskBadge} ${badgeClass}`}>{risk}</span>;
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
  });

  return (
    <div className={styles.tableWrapper}>
      {/* Search & Filter Toolbar */}
      <div className={styles.tableToolbar}>
        <div className={styles.searchContainer}>
          <Search size={14} color="#94a3b8" />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search merchant, city, category..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Risk:</span>
          <select
            className={styles.riskFilterSelect}
            value={riskFilter}
            onChange={(e) => onRiskFilterChange(e.target.value)}
          >
            <option value="All">All Risk Tiers</option>
            <option value="CRITICAL">Critical Risk</option>
            <option value="HIGH">High Risk</option>
            <option value="MEDIUM">Medium Risk</option>
            <option value="LOW">Low Risk</option>
          </select>
        </div>
      </div>

      {/* Table Body */}
      <div className={styles.scrollArea}>
        <table className={styles.tableRoot}>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const id = header.column.id;
                  const isSorted = sortBy === id;
                  return (
                    <th
                      key={header.id}
                      className={`${styles.tableHeaderCell} ${styles.sortableHeader}`}
                      onClick={() => onSortChange(id)}
                    >
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <ArrowUpDown
                          size={11}
                          color={isSorted ? "#509ee3" : "#cbd5e1"}
                          style={{
                            transform: isSorted && sortDesc ? "rotate(180deg)" : undefined,
                            transition: "transform 0.15s ease",
                          }}
                        />
                      </div>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>
                  Loading merchant forensic records...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>
                  No merchants matching criteria.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className={styles.tableBodyRow}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className={styles.tableCell}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className={styles.paginationFooter}>
        <span>
          Showing <strong>{data.length}</strong> of <strong>{totalCount.toLocaleString()}</strong> merchants
        </span>
        <div className={styles.paginationControls}>
          <button
            type="button"
            className={styles.pageBtn}
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || isLoading}
          >
            <ChevronLeft size={14} />
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className={styles.pageBtn}
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages || isLoading}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
