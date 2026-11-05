# LarperBI Studio Product Review — Defect & Gap Backlog

## Data & Ingestion

### B-001 [bug] Ingestion rejects reference JSON files (.json unsupported)
- Severity: blocks work
- Scenario: Phase 1 (Onboarding)
- Steps:
  1. Open any dashboard in LarperBI.
  2. Drag and drop `mcc_codes.json` or `train_fraud_labels.json` onto the canvas dropzone, or upload via file picker.
  3. Observe upload dialog error.
- Expected: JSON reference/lookup maps are either accepted and parsed into 2-column key-value tables or converted cleanly.
- Actual: Server returns HTTP 400 with `{"detail":"Unsupported file type '.json'. Upload a CSV, XLSX, XLS, XLSB, or ODS file."}`.
- Evidence: `qa-evidence/p1_canvas_empty.png`, endpoint `POST /api/v1/dashboards/{id}/upload/inspect` returns HTTP 400.
- Suspected area: `LarperBI/backend/app/storage.py` (`inspect_upload` whitelist `EXCEL_EXTENSIONS | TEXT_EXTENSIONS`)
- Suggested test level: integration
- Confidence: confirmed

### B-008 [bug] Unquoted commas in CSV error column fail standard CSV parser
- Severity: data wrong
- Scenario: Phase 0 (Recon)
- Steps:
  1. Inspect `archive/transactions_data.csv` line 21233: `7500793,2010-01-07 12:07:00,1356,5480,$53.69,Swipe Transaction,83989,Colfax,WI,54730.0,5310,"Insufficient Balance,Technical Glitch"`.
  2. Read with a standard strict CSV parser where `quote` is auto-detected as empty.
  3. Parser encounters 13 tokens instead of 12.
- Expected: Parser respects double-quote boundaries for comma-separated string values.
- Actual: Throws column count mismatch error unless explicitly parsed with `quote='"'` or ragged line truncation enabled.
- Evidence: DuckDB auto-detect parser exception on line 21233 (`_duckdb.InvalidInputException: CSV Error on Line: 21233`).
- Suspected area: `archive/transactions_data.csv` and `LarperBI/backend/app/storage.py` (`_preview_text` uses `truncate_ragged_lines=True` which silently discards tokens if quotes fail).
- Suggested test level: unit
- Confidence: confirmed

---

## Query & Semantic Layer

### B-002 [bug] Timestamp date strings misclassified as dimension; date grain selector missing
- Severity: data wrong
- Scenario: S2
- Steps:
  1. Upload `transactions_100k.csv` (contains column `date` with timestamp format `"2010-01-01 00:01:00"`).
  2. Open Visual Card Builder and select chart type `Line / Area Chart`.
  3. Under Category / Dimension (X-Axis), select `date (dimension)`.
  4. Look for the Date Bucket dropdown (`year` / `month` / `day`).
- Expected: Timestamp strings are recognized as temporal dates, displaying the Date Bucket dropdown so users can aggregate spend trend by month or year.
- Actual: `pl.col(col).str.to_date(strict=False)` throws `ComputeError` on timestamps during profiling, falling back to `semantic_type: "dimension"`. Date Bucket dropdown is hidden, forcing the chart to group by raw second-level timestamps across 4.1M unique points.
- Evidence: `qa-evidence/s2_date_dimension_selected.png`, `qa-evidence/s2_date_grain_missing.png`, test `e2e/qa/confirmed_bugs.spec.ts:B-002`.
- Suspected area: `LarperBI/backend/app/storage.py` (`profile_dataframe` lines 34-42) and `LarperBI/frontend/src/components/CardBuilder/CardBuilderModal.tsx` line 428.
- Suggested test level: unit
- Confidence: confirmed

### B-003 [missing] Card Builder pickers do not expose columns from joined/linked tables
- Severity: blocks work
- Scenario: S3, S4, S6
- Steps:
  1. In Data Model view, establish relationships: `transactions.mcc` $\to$ `mcc_codes.mcc`, `transactions.card_id` $\to$ `cards_data.id`, `transactions.client_id` $\to$ `users_data.id`.
  2. Return to Canvas and open Card Builder.
  3. Select `transactions_100k` as the source table.
  4. Open Category / Dimension (X-Axis) dropdown.
- Expected: Columns from linked tables (e.g. `category_name` from `mcc_codes`, `card_brand` from `cards_data`, `current_age` from `users_data`) appear in dimension/measure pickers.
- Actual: Only primary table columns are listed (`id`, `date`, `amount`, etc.). Joined table columns are completely absent, making it impossible to build joined visuals (S3 Top 10 MCC descriptions, S4 Fraud by card brand, S6 Spend by age/income band) via the visual builder.
- Evidence: `qa-evidence/s3_joined_columns_missing.png`, `qa-evidence/s4_card_brand_missing.png`, test `e2e/qa/confirmed_bugs.spec.ts:B-003`.
- Suspected area: `LarperBI/frontend/src/components/CardBuilder/CardBuilderModal.tsx` (lines 420-425 map only `selectedTable?.columns`).
- Suggested test level: integration
- Confidence: confirmed

### B-009 [friction] Calculated column expression parser lacks string, date, and conditional logic
- Severity: annoying
- Scenario: S6
- Steps:
  1. Open Data Model view.
  2. Click `+ Column` on `users_data` table.
  3. Attempt to define an age bucket or formatted string expression (e.g. `case when current_age < 30 then 'Young' else 'Senior' end` or `substr(address, 1, 5)`).
  4. Click `Save Column`.
- Expected: Common row-level expressions (string manipulation, date extraction, conditional binning) succeed.
- Actual: Expression validator rejects anything other than basic arithmetic (`+ - * / % **`), `abs(x)`, or `round(x, n)` with `ValueError: Unsupported expression`.
- Evidence: `qa-evidence/s6_add_column_modal.png`, `LarperBI/backend/app/storage.py:_expr_from_ast` line 481.
- Suspected area: `LarperBI/backend/app/storage.py` (`_expr_from_ast`)
- Suggested test level: unit
- Confidence: confirmed

---

## Charts

### B-010 [missing] Hardcoded USD currency formatting with no negative-value layout support
- Severity: cosmetic
- Scenario: S1, Phase 3
- Steps:
  1. Place a SmartScalar or Cartesian chart measuring column `amount`.
  2. Filter or query rows with negative refund amounts (min `-$500.00`).
  3. Observe rendered metric.
- Expected: Formatted value handles negative signs cleanly (e.g. `-$77.00` or `($77.00)`) and supports international currencies.
- Actual: Formatted as `$-77.00` due to template string `f"${val:,.2f}"`. Dollar sign is hardcoded; non-USD currencies or custom currency symbols are not supported.
- Evidence: `qa-evidence/s1_total_spend_card.png`, `LarperBI/backend/app/query_engine.py` line 227.
- Suspected area: `LarperBI/backend/app/query_engine.py` (`execute_card_query`)
- Suggested test level: unit
- Confidence: confirmed

---

## Filters

### B-005 [friction] Category filter parameter popover limited to 100 values without search
- Severity: annoying
- Scenario: S5, Phase 3 (E1)
- Steps:
  1. Create a Category filter parameter on high-cardinality column `merchant_city` (contains thousands of unique cities) or `merchant_id`.
  2. Click the filter pill to open the popover checklist.
  3. In the popover search box, type a city name that is not alphabetically in the first 100 (e.g. "Seattle", "Zzyzx").
- Expected: Popover queries backend for matching values across the entire dataset.
- Actual: Backend endpoint `GET /tables/{table_id}/columns/{col}/distinct` hardcodes `.head(100)`. Search input only filters client-side within those 100 loaded items, displaying "No categories found".
- Evidence: `qa-evidence/e1_high_cardinality_popover.png`, `qa-evidence/e1_city_not_found.png`, test `e2e/qa/confirmed_bugs.spec.ts:B-005`.
- Suspected area: `LarperBI/backend/app/main.py:444` (`get_distinct_column_values`) and `LarperBI/frontend/src/components/parameters/ParameterWidget.tsx` line 83.
- Suggested test level: integration
- Confidence: confirmed

### B-007 [friction] Filter parameter pills are unsemantic divs lacking role button and keyboard access
- Severity: annoying
- Scenario: S5, Phase 3 (UX)
- Steps:
  1. Navigate to Canvas with an active filter parameter.
  2. Attempt to tab to the filter pill using keyboard navigation (`Tab` key) and activate it via `Enter` or `Space`.
  3. Inspect the DOM element of the pill.
- Expected: Filter pill is a semantic `<button>` or `<div role="button" tabIndex={0}>` with keyboard event listeners.
- Actual: Rendered as `<div className={styles.filterPill} onClick={...}>` without `role="button"`, `tabIndex`, or `onKeyDown`. Keyboard users and assistive technologies cannot focus or open filter popovers.
- Evidence: `qa-evidence/s5_filter_pill_rendered.png`, test `e2e/qa/confirmed_bugs.spec.ts:B-007`.
- Suspected area: `LarperBI/frontend/src/components/parameters/ParameterWidget.tsx` line 92.
- Suggested test level: e2e
- Confidence: confirmed

---

## Layout & Saving

### B-004 [missing] No URL routing or deep linking; page reload resets active dashboard
- Severity: annoying
- Scenario: S7
- Steps:
  1. Open a dashboard (e.g. `QA Kaggle Fraud Analytics`).
  2. Observe the browser URL bar: remains static at `http://127.0.0.1:5174/`.
  3. Press browser Refresh (`Cmd+R` / `F5`).
- Expected: Browser reloads the current active dashboard via URL route (e.g. `/dashboards/dash_8f2e94f5` or `?dashboard=dash_8f2e94f5`).
- Actual: Active workspace is cleared because `activeDashboardId` is stored only in React component state (`useState(null)`). The user is returned to the home dashboard gallery every time the page reloads.
- Evidence: `qa-evidence/s7_reloaded_home.png`, test `e2e/qa/confirmed_bugs.spec.ts:B-004`.
- Suspected area: `LarperBI/frontend/src/App.tsx` (missing React Router or browser History/query param sync).
- Suggested test level: e2e
- Confidence: confirmed

### B-011 [friction] Long card titles overflow card header action controls
- Severity: cosmetic
- Scenario: Phase 3 (E3)
- Steps:
  1. Create a card with a title longer than 80 characters.
  2. Observe the card header in the canvas.
- Expected: Title text is truncated with ellipsis (`text-overflow: ellipsis`) and header action icons (edit, maximize, delete) remain accessible on hover.
- Actual: Unbounded header text expands and pushes card header action buttons off-canvas or collides with drag handles.
- Evidence: `qa-evidence/e3_overflowing_title.png`.
- Suspected area: `LarperBI/frontend/src/components/metabase-viz/DashCard/DashCard.tsx` line 25 and `DashCard.module.css`.
- Suggested test level: e2e
- Confidence: confirmed

### B-012 [friction] Mobile viewport (375px) card reflow compresses visuals
- Severity: cosmetic
- Scenario: Phase 3 (E4)
- Steps:
  1. Open dashboard in mobile viewport (width: 375px).
  2. View Canvas.
- Expected: 18-column grid collapses to a responsive 1-column mobile stack.
- Actual: Cards maintain fixed 18-column fractional widths, compressing visuals into unreadable vertical columns.
- Evidence: `qa-evidence/e4_mobile_canvas_375px.png`.
- Suspected area: `LarperBI/frontend/src/components/grid/GridLayout.tsx` (needs `ResponsiveGridLayout` with breakpoint widths).
- Suggested test level: e2e
- Confidence: confirmed

---

## Errors & Edge Cases

### B-006 [bug] React Hook rules violation in CardBuilderModal (conditional hook execution)
- Severity: cosmetic
- Scenario: Phase 1
- Steps:
  1. Run `npm run lint` (`oxlint`) in `LarperBI/frontend`.
  2. Inspect diagnostics for `src/components/CardBuilder/CardBuilderModal.tsx`.
- Expected: Zero React Hook rule violations.
- Actual: 10 diagnostics of `error react-hooks(rules-of-hooks): React Hook "useState" is called conditionally` due to `if (!isOpen) return null;` placed at line 68 before `useState` calls.
- Evidence: `oxlint` terminal output reporting 10 errors on `CardBuilderModal.tsx:70-84`.
- Suspected area: `LarperBI/frontend/src/components/CardBuilder/CardBuilderModal.tsx` line 68.
- Suggested test level: unit
- Confidence: confirmed
