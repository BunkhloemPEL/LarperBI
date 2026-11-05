# QA Notes — LarperBI Studio Product Review

## Phase 0: Dataset Reconnaissance

Inspected dataset: Kaggle "Transactions Fraud Datasets" (computingvictor) located at `archive/`.

### 1. Dataset Files & Volume Summary

| File | Size | Format | Row Count | Distinct Keys / Columns |
| :--- | :--- | :--- | :--- | :--- |
| `transactions_data.csv` | 1.2 GB | CSV | 13,305,915 | 12 columns (`id`, `date`, `client_id`, `card_id`, `amount`, `use_chip`, `merchant_id`, `merchant_city`, `merchant_state`, `zip`, `mcc`, `errors`) |
| `cards_data.csv` | 498 KB | CSV | 6,146 | 13 columns (`id`, `client_id`, `card_brand`, `card_type`, `card_number`, `expires`, `cvv`, `has_chip`, `num_cards_issued`, `credit_limit`, `acct_open_date`, `year_pin_last_changed`, `card_on_dark_web`) |
| `users_data.csv` | 161 KB | CSV | 2,000 | 14 columns (`id`, `current_age`, `retirement_age`, `birth_year`, `birth_month`, `gender`, `address`, `latitude`, `longitude`, `per_capita_income`, `yearly_income`, `total_debt`, `credit_score`, `num_credit_cards`) |
| `mcc_codes.json` | 4.7 KB | Key-Value JSON | 109 entries | Map of MCC code string (e.g. `"5812"`) to Category Description (e.g. `"Eating Places and Restaurants"`) |
| `train_fraud_labels.json`| 152 MB | Nested JSON | 8,914,963 | `{"target": {"<transaction_id>": "Yes" \| "No"}}` (covers ~67% of transactions; 13,332 "Yes" / 0.15% fraud rate) |

---

### 2. Schema Quirks & Anomalies Discovered

1. **Unquoted Commas in `errors` (`transactions_data.csv`)**:
   - Line 21233 contains `"Insufficient Balance,Technical Glitch"` wrapped in quotes.
   - Any naive or unquoted CSV reader fails immediately expecting 12 columns and getting 13.
2. **Currency Strings in Numeric Fields**:
   - `transactions_data.csv` `amount`: stored as `$-77.00`, `$14.57`, etc.
   - `users_data.csv`: `per_capita_income`, `yearly_income`, `total_debt` stored as `"$29278"`, `"$59696"`, etc.
   - `cards_data.csv`: `credit_limit` stored as `"$24295"`.
3. **Negative Amounts (Refunds)**:
   - `transactions_data.csv` contains 660,049 negative transactions (min: `-$500.00`, max: `$6,820.20`, mean: `$42.98`).
4. **Heavy Nullability in Geographic & Error Columns**:
   - `merchant_state`: 1,563,700 nulls (~11.8% of rows, primarily online transactions).
   - `zip`: 1,652,706 nulls (~12.4% of rows).
   - `errors`: 13,094,522 nulls (~98.4% clean transactions).
5. **Non-Tabular JSON Reference Files**:
   - `mcc_codes.json` is a JSON dictionary (`{"5812": "..."}`), not an array of objects.
   - `train_fraud_labels.json` is a 152 MB nested dictionary (`{"target": {"<id>": "Yes"}}`), requiring extraction before tabular ingestion.
6. **Partial Label Coverage**:
   - `train_fraud_labels.json` contains 8,914,963 entries, while `transactions_data.csv` has 13,305,915 rows. 4,390,952 transactions lack ground-truth fraud labels.

---

### 3. Join Keys

- **Transactions $\to$ Cards**: `transactions_data.card_id` $\to$ `cards_data.id` (Many-to-One)
- **Transactions $\to$ Users**: `transactions_data.client_id` $\to$ `users_data.id` (Many-to-One)
- **Cards $\to$ Users**: `cards_data.client_id` $\to$ `users_data.id` (Many-to-One)
- **Transactions $\to$ MCC Lookup**: `transactions_data.mcc` $\to$ `mcc_codes.json[key]` (Many-to-One)
- **Transactions $\to$ Fraud Label**: `transactions_data.id` $\to$ `train_fraud_labels.json["target"][id]` (One-to-One)

---

### 4. LarperBI Supported Capabilities & Boundaries

- **Ingestion Support**:
  - Drag-and-drop CSV (`.csv`) and Excel (`.xlsx`, `.xls`, `.xlsb`, `.ods` via `fastexcel`).
  - Staged inspection (`/upload/inspect`) $\to$ Commit (`/upload/commit`) $\to$ Partitioned Parquet table under `data/dashboards/{id}/`.
  - Manual empty table definition (`POST /tables/empty`).
  - Python-scripted table definition (`POST /tables/python`).
  - Python Notebook (`JupyterNotebook`): allows running arbitrary Polars code and saving DataFrame as derived table.
  - **Gaps**: No native JSON upload / JSON map ingestion. No streaming upload chunker for files > 1 GB without loading entire content into memory or disk temporary buffers.
- **Visual Chart Types (14 Supported)**:
  - `SmartScalar`, `CartesianChart` (Line, Area, Bar, Row), `DonutChart` / `PieChart`, `ProgressBar`, `GaugeChart`, `WaterfallChart`, `FunnelChart`, `ScatterPlot`, `BoxPlot`, `TreemapChart`, `SankeyChart`, `PivotTable`, `TableInteractive`.
- **Filtering Capabilities**:
  - `ParameterBar`: Category (multi-select popover with search), Date Range (preset & calendar picker), Text, Number.
  - Canvas card queries dynamically receive active filters from parameter bar.
- **Pages / Views**:
  - Canvas View (18-column grid with resize/drag/edit/focus mode).
  - Data View (server-side paged row browser with autofilters and sheet tabs).
  - Python Lab (Jupyter notebook with CodeMirror editor and AST evaluation).
  - Data Model (star schema relationship view, table cards, drag-to-link keys, calculated columns, saved metrics).
  - Visual Gallery (static component showcase).

---

## Phase 1: Onboarding Findings & Workarounds

### 1. Ingestion Experience
- **`cards_data.csv` (498 KB)**: Smooth drag-and-drop ingestion. Profiled 6,146 rows in 0.02s. Currency column `credit_limit` automatically cleaned to Float64.
- **`users_data.csv` (161 KB)**: Ingested cleanly. Inferred 2,000 rows in 0.01s.
- **`mcc_codes.json` (4.7 KB)**: FAILED. Rejected by backend with `HTTP 400: Unsupported file type '.json'`.
- **`train_fraud_labels.json` (152 MB)**: FAILED. Rejected by backend with `HTTP 400: Unsupported file type '.json'`.
- **`transactions_data.csv` (1.2 GB, 13.3M rows)**: Upload inspect succeeded in 2.38s; commit to Parquet succeeded in 4.89s. Cleaned currency string `amount` to Float64. However, `date` timestamp string `"2010-01-01 00:01:00"` failed `str.to_date(strict=False)` and was misclassified as `dimension`.

### 2. Workarounds Used (`scripts/qa/prepare_qa_data.py`)
To evaluate the product across all core scenarios without altering product source code:
1. **`mcc_codes.csv`**: Converted `mcc_codes.json` dictionary into a standard 2-column CSV (`mcc,category_name`).
2. **`transactions_100k.csv`**: Sampled 100,000 transactions from `transactions_data.csv` and joined with `train_fraud_labels.json` to append `is_fraud` (1 for "Yes", 0 for "No", yielding 107 fraud rows / 0.11% rate), enabling fraud rate calculations.

---

## Phase 2: Scenario Results Table

| Scenario | Achievable? | Steps & Clicks | Time to First Result | Blockers & Root Cause | Wish Existed |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **S1: Fraud Overview (KPIs & Rate)** | **Yes** | 12 clicks (Create SmartScalar $\to$ Switch to Model $\to$ Saved Metrics $\to$ Define Ratio Metric $\to$ Back to Canvas $\to$ Create Ratio Card) | ~35s | None blocking; ratio metric `sum(is_fraud)/count(is_fraud)*100` evaluated cleanly. | Quick metric creator directly inside the Card Builder without leaving Canvas. |
| **S2: Spend Trend by Month and Year** | **Partially** | 6 clicks (Open Card Builder $\to$ Area Chart $\to$ Select `date` dimension) | ~15s | `date` profiled as `dimension` instead of `date` (B-002). Date Bucket dropdown never rendered; grouped by raw timestamp string. | Date hierarchy parsing for ISO timestamps (`%Y-%m-%d %H:%M:%S`). |
| **S3: Top 10 Merchant Categories** | **No** (Directly in Card Builder) | 5 clicks | ~20s | Card Builder dimension picker only lists columns of the primary table (`selectedTable.columns`), ignoring joined tables (B-003). | Qualified column picker (`table.column`) for all star-schema linked tables in Card Builder. |
| **S4: Fraud Rate by Card Brand / Type** | **No** (Directly in Card Builder) | 5 clicks | ~20s | Cannot select `card_brand` or `card_type` when `transactions_100k` is selected as the primary table (B-003). | Star-schema dimension resolution in visual builder. |
| **S5: Interactive Parameter Filtering** | **Yes** | 8 clicks (Add Filter $\to$ Fill Name $\to$ Select Target $\to$ Click Pill $\to$ Multi-Select Category $\to$ Cross-Filter) | ~25s | None blocking query; filter pills lack `role="button"` for accessibility (B-007). | Server-side searchable filter popovers for high-cardinality dimensions. |
| **S6: Customer View & Age / Income Band** | **Partially** | 10 clicks (Model View $\to$ `+ Column` on `users_data` $\to$ Create calculated column `current_age / 10`) | ~40s | Calculated column parser lacks `CASE WHEN`, `bin()`, or string expressions (B-009). Joined user columns unavailable in transaction card builder (B-003). | Numeric binning helper (`bin(col, step)`) and joined dimension builder. |
| **S7: Multi-Visual Canvas Layout & Persistence** | **Yes** | 14 clicks (Assemble 3 visuals $\to$ Auto Layout $\to$ Lock/Unlock $\to$ Browser Reload) | ~45s | Refreshing the page clears active workspace because dashboard ID is not synced to URL route (B-004). Backend persistence in SQLite is 100% solid. | URL path router (`/dashboards/:id`) and shareable link button. |

---

## Phase 3: Stress & Edge Cases Findings

1. **High-Cardinality Filter Limit (E1)**:
   - Backend `GET /tables/{id}/columns/{col}/distinct` hardcodes `.head(100)`.
   - Frontend search in `ParameterWidget` is purely client-side across those 100 items. Searching for values outside the first 100 (e.g. rare merchant cities) returns zero results.
2. **Empty Results Handling (E2)**:
   - Query engine handles 0-row results gracefully: `SmartScalar` defaults to `0.0`, cartesian charts output empty series arrays without JavaScript runtime crashes.
3. **Very Long Title Overflow (E3)**:
   - Card header does not truncate overflowing title text (`text-overflow: ellipsis` missing in `DashCard.module.css`), pushing action buttons off-card.
4. **Mobile Viewport Scaling (E4)**:
   - At 375px viewport width, cards maintain 18-column grid slots, compressing visuals horizontally into unreadable narrow columns.
5. **Data View Row Browser (E5)**:
   - Server-side pagination (25 / 50 / 100 / 250) and autofilters perform smoothly on 100k and 13.3M row tables. Nulls render with clean muted `null` badges.
6. **Python Lab & EDA (E6)**:
   - CodeMirror editor, execution timing (`0.1ms`), and AST execution work reliably. Derived table materialization persists DataFrames to Parquet.

---

## Observations & Gaps Not Yet Logged in Backlog

- **No Undo / Redo**: Deleting or resizing cards on the canvas cannot be undone without manually re-adding or repositioning.
- **Single Primary Key Assumption**: Drag-to-link foreign keys assume simple single-column equality joins; composite keys are not supported.
- **No Export Dashboard to PDF/PNG**: Individual cards have CSV export, but there is no full-dashboard snapshot export.
- **Polars In-Memory Performance**: Query engine performance on 13.3M rows is outstanding (sub-500ms aggregations), showing that local columnar Parquet + Polars is a viable alternative to client-side DuckDB.
