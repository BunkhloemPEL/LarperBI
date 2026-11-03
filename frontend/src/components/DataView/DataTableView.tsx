import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Table2,
  AlertCircle,
  ChevronDown,
  Filter,
  Check,
  X,
} from "lucide-react";
import styles from "./DataTableView.module.css";
import { fetchTableRows, fetchDistinctColumnValues } from "../../services/api";
import type { TableItem, TableRowsResponse } from "../../types/larper";

export interface DataTableViewProps {
  dashboardId: string;
  tables: TableItem[];
}

interface ColumnFilter {
  column: string;
  values: string[];
}

interface FilterMenuState {
  column: string;
  left: number;
  top: number;
}

const PAGE_SIZES = [25, 50, 100, 250];

export const DataTableView: React.FC<DataTableViewProps> = ({ dashboardId, tables }) => {
  const [selectedTableId, setSelectedTableId] = useState<string>(tables[0]?.id || "");
  const [searchInput, setSearchInput] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [columnFilters, setColumnFilters] = useState<ColumnFilter[]>([]);
  const [data, setData] = useState<TableRowsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState<number>(0);

  // Column filter menu state
  const [filterMenu, setFilterMenu] = useState<FilterMenuState | null>(null);
  const [menuValues, setMenuValues] = useState<string[]>([]);
  const [menuSelected, setMenuSelected] = useState<string[]>([]);
  const [menuSearch, setMenuSearch] = useState<string>("");
  const [menuLoading, setMenuLoading] = useState<boolean>(false);
  const [menuError, setMenuError] = useState<string | null>(null);

  const selectedTable = useMemo(
    () => tables.find((t) => t.id === selectedTableId) || tables[0],
    [tables, selectedTableId]
  );

  useEffect(() => {
    if (!tables.some((t) => t.id === selectedTableId)) {
      setSelectedTableId(tables[0]?.id || "");
      setPage(1);
      setSortColumn(null);
      setColumnFilters([]);
      setData(null);
    }
  }, [tables, selectedTableId]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setSearch((prev) => {
        const next = searchInput.trim();
        if (next !== prev) setPage(1);
        return next;
      });
    }, 300);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  const load = useCallback(async () => {
    if (!selectedTableId) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchTableRows(dashboardId, selectedTableId, {
        page,
        pageSize,
        search,
        sortColumn,
        sortDir,
        filters: columnFilters,
      });
      setData(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [dashboardId, selectedTableId, page, pageSize, search, sortColumn, sortDir, columnFilters, reloadToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDir("asc");
    }
    setPage(1);
  };

  const findFilter = (column: string): string[] | null => {
    const found = columnFilters.find((f) => f.column === column);
    return found ? found.values : null;
  };

  const openFilterMenu = async (column: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.right - 260, window.innerWidth - 268));
    const top = Math.min(rect.bottom + 2, Math.max(8, window.innerHeight - 428));
    setFilterMenu({ column, left, top });
    setMenuSearch("");
    setMenuError(null);
    setMenuValues([]);
    setMenuSelected(findFilter(column) || []);
    setMenuLoading(true);
    try {
      const values = await fetchDistinctColumnValues(dashboardId, selectedTableId, column);
      const strings = values.map((v) => String(v));
      setMenuValues(strings);
      setMenuSelected(findFilter(column) || strings);
    } catch (err: unknown) {
      setMenuError(err instanceof Error ? err.message : String(err));
    } finally {
      setMenuLoading(false);
    }
  };

  const closeMenu = () => setFilterMenu(null);

  const toggleMenuValue = (value: string) => {
    setMenuSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const applyMenuFilter = () => {
    if (!filterMenu) return;
    const remaining = columnFilters.filter((f) => f.column !== filterMenu.column);
    const allSelected = menuValues.length > 0 && menuSelected.length === menuValues.length;
    if (!allSelected && menuSelected.length > 0 && menuValues.length > 0) {
      remaining.push({ column: filterMenu.column, values: menuSelected });
    }
    setColumnFilters(remaining);
    setPage(1);
    closeMenu();
  };

  const clearColumnFilter = () => {
    if (!filterMenu) return;
    setColumnFilters((prev) => prev.filter((f) => f.column !== filterMenu.column));
    setPage(1);
    closeMenu();
  };

  const applyMenuSort = (direction: "asc" | "desc") => {
    if (!filterMenu) return;
    setSortColumn(filterMenu.column);
    setSortDir(direction);
    setPage(1);
    closeMenu();
  };

  const clearAllFilters = () => {
    setColumnFilters([]);
    setSearchInput("");
    setSearch("");
    setPage(1);
  };

  const switchTable = (tableId: string) => {
    setSelectedTableId(tableId);
    setPage(1);
    setSortColumn(null);
    setSortDir("asc");
    setColumnFilters([]);
    setSearchInput("");
    setSearch("");
  };

  const numericColumns = useMemo(() => {
    const set = new Set<string>();
    (data?.columns || selectedTable?.columns || []).forEach((c) => {
      if (c.semantic_type === "measure") set.add(c.name);
    });
    return set;
  }, [data, selectedTable]);

  if (tables.length === 0) {
    return (
      <div className={styles.card} style={{ position: "relative", height: "480px" }}>
        <div className={styles.centerState}>
          <Table2 size={28} color="var(--mb-color-brand)" />
          <div style={{ fontWeight: 600, color: "#111827" }}>No tables yet</div>
          <div>Upload a CSV or create a table in Data Model to browse rows here.</div>
        </div>
      </div>
    );
  }

  const columns = data?.columns || selectedTable?.columns || [];
  const rows = data?.rows || [];
  const totalCount = data?.total_count ?? 0;
  const totalPages = data?.total_pages ?? 1;
  const firstRow = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, totalCount);
  const isFiltered = !!search || columnFilters.length > 0;
  const menuFilteredValues = menuValues.filter((v) =>
    v.toLowerCase().includes(menuSearch.toLowerCase())
  );
  const activeMenuFilter = filterMenu ? findFilter(filterMenu.column) : null;

  return (
    <div className={styles.container}>
      <div className={styles.card}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Search size={13} color="#6b7280" />
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Search across all columns..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        <select
          className={styles.pageSizeSelect}
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
          title="Rows per page"
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size} / page
            </option>
          ))}
        </select>

        <button
          type="button"
          className={styles.toolbarBtn}
          onClick={() => setReloadToken((n) => n + 1)}
          disabled={isLoading}
          title="Reload rows"
        >
          <RefreshCw size={12} className={isLoading ? styles.spinner : undefined} />
          Reload
        </button>

        {isFiltered && (
          <button
            type="button"
            className={styles.clearFiltersBtn}
            onClick={clearAllFilters}
            title="Clear search and all column filters"
          >
            <X size={11} />
            Clear filters{columnFilters.length > 0 ? ` (${columnFilters.length})` : ""}
          </button>
        )}

        <span className={styles.rowSummary}>
          {totalCount === 0
            ? "0 rows"
            : `Showing ${firstRow.toLocaleString()}–${lastRow.toLocaleString()} of ${totalCount.toLocaleString()}${
                isFiltered ? ` (filtered from ${(data?.unfiltered_count ?? 0).toLocaleString()})` : ""
              }`}
        </span>
      </div>

      {/* Grid */}
      <div className={styles.gridArea}>
        {error ? (
          <div className={styles.centerState}>
            <AlertCircle size={22} color="#dc2626" />
            <div style={{ color: "#b91c1c", maxWidth: "520px" }}>{error}</div>
            <button type="button" className={styles.toolbarBtn} onClick={() => setReloadToken((n) => n + 1)}>
              Retry
            </button>
          </div>
        ) : !data && isLoading ? (
          <div className={styles.centerState}>
            <RefreshCw size={20} className={styles.spinner} />
            Loading rows...
          </div>
        ) : rows.length === 0 ? (
          <div className={styles.centerState}>
            <div style={{ fontWeight: 600, color: "#111827" }}>
              {isFiltered ? "No matching rows" : "Table is empty"}
            </div>
            <div>{isFiltered ? "Adjust or clear the filters." : "This table has no rows yet."}</div>
          </div>
        ) : (
          <div className={styles.scrollArea}>
            <table className={styles.grid}>
              <thead>
                <tr>
                  <th className={styles.cornerCell}>#</th>
                  {columns.map((col) => {
                    const isSorted = sortColumn === col.name;
                    const isFilteredColumn = !!findFilter(col.name);
                    return (
                      <th key={col.name}>
                        <div className={styles.headerCell}>
                          <span
                            className={styles.headerLabel}
                            onClick={() => handleSort(col.name)}
                            title={`Sort by ${col.name}`}
                          >
                            <span className={styles.headerLabelText}>{col.name}</span>
                            {isSorted &&
                              (sortDir === "asc" ? (
                                <ArrowUp size={11} color="var(--mb-color-brand)" />
                              ) : (
                                <ArrowDown size={11} color="var(--mb-color-brand)" />
                              ))}
                          </span>
                          <button
                            type="button"
                            className={`${styles.filterBtn} ${isFilteredColumn ? styles.filterBtnActive : ""}`}
                            onClick={(e) => openFilterMenu(col.name, e)}
                            title={`Filter ${col.name}`}
                            aria-label={`Filter ${col.name}`}
                          >
                            {isFilteredColumn ? <Filter size={10} /> : <ChevronDown size={10} />}
                          </button>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx}>
                    <td className={styles.rowIndexCell}>{(page - 1) * pageSize + idx + 1}</td>
                    {columns.map((col) => {
                      const value = row[col.name];
                      const isNull = value === null || value === undefined;
                      return (
                        <td
                          key={col.name}
                          className={numericColumns.has(col.name) ? styles.numericCell : undefined}
                          title={isNull ? "null" : String(value)}
                        >
                          {isNull ? <span className={styles.nullValue}>null</span> : String(value)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Attached status / pagination bar */}
      <div className={styles.statusBar}>
        <span>
          Page {page} of {totalPages}
        </span>
        <div className={styles.pager}>
          <button
            type="button"
            className={styles.pagerBtn}
            onClick={() => setPage(1)}
            disabled={page <= 1 || isLoading}
            title="First page"
          >
            <ChevronsLeft size={13} />
          </button>
          <button
            type="button"
            className={styles.pagerBtn}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || isLoading}
            title="Previous page"
          >
            <ChevronLeft size={13} />
          </button>
          <span className={styles.pageIndicator}>
            {page} / {totalPages}
          </span>
          <button
            type="button"
            className={styles.pagerBtn}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || isLoading}
            title="Next page"
          >
            <ChevronRight size={13} />
          </button>
          <button
            type="button"
            className={styles.pagerBtn}
            onClick={() => setPage(totalPages)}
            disabled={page >= totalPages || isLoading}
            title="Last page"
          >
            <ChevronsRight size={13} />
          </button>
        </div>
      </div>

      {/* Excel-style sheet tabs */}
      <div className={styles.sheetBar} role="tablist" aria-label="Tables">
        {tables.map((t) => {
          const isActive = t.id === selectedTableId;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              title={`${t.display_name} (${t.row_count.toLocaleString()} rows)`}
              className={`${styles.sheetTab} ${isActive ? styles.sheetTabActive : ""}`}
              onClick={() => switchTable(t.id)}
            >
              {t.display_name}
              {t.role === "helper" && <span className={styles.sheetHelperDot} title="Helper table" />}
            </button>
          );
        })}
      </div>
      </div>

      {/* Column filter menu */}
      {filterMenu && (
        <>
          <div className={styles.menuBackdrop} onMouseDown={closeMenu} />
          <div className={styles.filterMenu} style={{ left: filterMenu.left, top: filterMenu.top }}>
            <div className={styles.menuTitle}>
              <span>{filterMenu.column}</span>
              <button
                type="button"
                onClick={closeMenu}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "#6b7280" }}
                aria-label="Close filter"
              >
                <X size={13} />
              </button>
            </div>

            <button type="button" className={styles.menuSortBtn} onClick={() => applyMenuSort("asc")}>
              <ArrowUp size={12} /> Sort Ascending
            </button>
            <button type="button" className={styles.menuSortBtn} onClick={() => applyMenuSort("desc")}>
              <ArrowDown size={12} /> Sort Descending
            </button>

            <div className={styles.menuDivider} />

            <div className={styles.menuSearch}>
              <Search size={11} color="#6b7280" />
              <input
                type="text"
                placeholder="Search values..."
                value={menuSearch}
                onChange={(e) => setMenuSearch(e.target.value)}
                autoFocus
              />
            </div>

            <div className={styles.menuActions}>
              <button
                type="button"
                className={styles.linkBtn}
                onClick={() => setMenuSelected(menuValues)}
                disabled={menuLoading}
              >
                Select All
              </button>
              <button
                type="button"
                className={styles.linkBtn}
                onClick={() => setMenuSelected([])}
                disabled={menuLoading}
              >
                Clear
              </button>
            </div>

            <div className={styles.valueList}>
              {menuLoading ? (
                <div className={styles.menuEmpty}>Loading values...</div>
              ) : menuError ? (
                <div className={styles.menuEmpty} style={{ color: "#b91c1c" }}>
                  {menuError}
                </div>
              ) : menuFilteredValues.length === 0 ? (
                <div className={styles.menuEmpty}>No matching values</div>
              ) : (
                menuFilteredValues.map((value) => {
                  const checked = menuSelected.includes(value);
                  return (
                    <div
                      key={value}
                      className={styles.valueRow}
                      onClick={() => toggleMenuValue(value)}
                      role="checkbox"
                      aria-checked={checked}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleMenuValue(value);
                        }
                      }}
                    >
                      <span className={`${styles.checkbox} ${checked ? styles.checkboxChecked : ""}`}>
                        {checked && <Check size={9} />}
                      </span>
                      <span className={styles.valueText} title={value}>
                        {value}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            <div className={styles.menuFooter}>
              {activeMenuFilter && (
                <button type="button" className={styles.menuBtn} onClick={clearColumnFilter}>
                  Clear Filter
                </button>
              )}
              <button type="button" className={styles.menuBtn} onClick={closeMenu}>
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.menuBtn} ${styles.menuBtnPrimary}`}
                onClick={applyMenuFilter}
                disabled={menuLoading}
              >
                Apply
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
