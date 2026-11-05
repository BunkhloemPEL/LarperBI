# LarperBI Polish & Product Plan

This document establishes the roadmap to transition `LarperBI` from an experimental prototype into a production-grade, self-service BI studio. Findings and evidence originate from `docs/BACKLOG.md`, `docs/QA_NOTES.md`, and automated end-to-end evidence in `qa-evidence/`.

---

## 1. Current Flow Map

The user journey from raw file to saved dashboard across the product today:

```
[Create Workspace] ──> [Ingest File] ──> [Profile Schema] ──> [Data Model Links] ──> [Build Cards] ──> [Filter Canvas] ──> [Save & Reload]
      SMOOTH               ROUGH              ROUGH                 ROUGH                 ROUGH            SMOOTH/ROUGH          MISSING
```

1. **Create Dashboard** (`DashboardList.tsx`): **SMOOTH**
   - Click "New Blank Dashboard", fill title/description, click "Create". Workspace persists instantly in SQLite.
2. **Ingest Data** (`CanvasView.tsx`, `storage.py`): **ROUGH**
   - CSV and multi-sheet Excel files upload and convert to Parquet in < 5 seconds for files up to 100k rows.
   - *Friction*: Uploading 1.2 GB raw CSV buffers entire byte stream into Python memory; no upload progress percentage indicator.
   - *Failure*: Reference JSON files (`mcc_codes.json`, `train_fraud_labels.json`) fail with HTTP 400 (`Unsupported file type`).
3. **Data Profiling & Type Inference** (`storage.py:profile_dataframe`): **ROUGH**
   - Numeric columns and currency strings (`$24,295`) correctly clean and tag as `measure`.
   - *Failure*: ISO timestamp strings (`"2010-01-01 00:01:00"`) throw `ComputeError` under `pl.col(col).str.to_date(strict=False)` and silently fall back to `dimension`, disabling all temporal date grain options (`year`, `month`, `day`).
4. **Data Modeling & Relationships** (`ModelView.tsx`): **ROUGH**
   - Drag-to-link foreign keys and relationship creation execute reliably and store in SQLite.
   - *Failure*: Established relationships are completely ignored by the Card Builder UI. Linked table columns never appear in visual pickers.
5. **Define Saved Metrics** (`ModelView.tsx`): **SMOOTH**
   - Ratio and simple aggregation metrics (`sum(is_fraud) / count() × 100`) save cleanly and evaluate dynamically.
   - *Friction*: Metrics must be configured in a separate tab; cannot be created or edited inline while designing a visual card.
6. **Author Visual Cards** (`CardBuilderModal.tsx`): **ROUGH**
   - Sub-20ms preview calculates accurately across 14 chart types.
   - *Blocker*: Cannot build cross-table visuals (S3 MCC descriptions, S4 Card brand, S6 Customer demographics) because picker excludes linked tables.
   - *Blocker*: Cannot build time-series rollups (S2 Spend trend) due to missing date grain on timestamp columns.
7. **Filter & Parameter Interaction** (`ParameterBar.tsx`): **SMOOTH / ROUGH**
   - Cross-filtering across canvas cards operates sub-second over 100k rows.
   - *Friction*: Category popover hardcaps distinct values at 100; search is purely client-side within those 100.
   - *Friction*: Parameter pills are rendered as unsemantic `<div>` tags lacking keyboard focus or button role.
8. **Layout, Save & Reload** (`CanvasView.tsx`, `App.tsx`): **MISSING**
   - Grid layout coordinates `[x, y, w, h]` persist reliably to SQLite on drag/resize.
   - *Failure*: No URL routing exists. Pressing browser Refresh (`F5`/`Cmd+R`) or sharing the URL resets `activeDashboardId` to `null`, dropping the user back to the home list.

---

## 2. Gap Analysis by Theme

### Data Onboarding
- **B-001 [bug] Reference JSON files rejected (`.json` unsupported)**: Blocks standard reference/lookup tables (`mcc_codes.json`).
- **Memory Pressure on Multi-Gigabyte Uploads**: FastAPI `await file.read()` reads full file into RAM before writing to disk, risking OOM on servers handling concurrent gigabyte-scale uploads.
- *(Flagged: B-008 is an upstream CSV quotation quirk that Polars already handles with `quote='"'` / `truncate_ragged_lines=True`; marked low-value / external data defect).*

### Modeling & Joins
- **B-003 [missing] Card Builder pickers omit joined table columns**: The backend auto-join engine (`query_engine.py`) supports joining across foreign keys, but the UI picker (`CardBuilderModal.tsx`) only maps `selectedTable.columns`. Users cannot select dimensions or measures from linked tables.
- **B-009 [friction] Calculated column parser lacks string, date, and conditional expressions**: AST validation only permits arithmetic, `abs()`, and `round()`. Expressions like `case when`, `bin()`, or `slice()` are rejected.

### Visuals
- **B-002 [bug] Datetime strings misclassified as dimensions; temporal grain bucketing hidden**: Date parsing fails on timestamps with time components, hiding the Date Bucket selector and breaking trend line charts.
- **B-010 [missing] Hardcoded USD currency formatting**: Template string `f"${val:,.2f}"` cannot format Euros, GBP, or format negative refunds cleanly (e.g. `$-77.00` vs `-$77.00`).
- **B-011 [friction] Long card titles overflow header action controls**: Header text lacks truncation styles, colliding with action icons on long titles.

### Filters
- **B-005 [friction] Distinct filter popover capped at 100 values without server search**: High-cardinality columns cannot be filtered by values outside the top 100 alphabetically.
- **B-007 [friction] Filter parameter pills are unsemantic divs lacking accessibility**: Keyboard and screen reader users cannot focus or trigger filter pills.

### Layout & Persistence
- **B-004 [missing] No URL routing or deep linking**: Workspace state lives solely in React `useState(null)`. Cannot refresh or share URLs.
- **B-012 [friction] Mobile viewport (375px) card reflow compresses visuals**: Fixed 18-column layout does not collapse to 1-column stack on small screens.

### Feedback & Errors
- **B-006 [bug] React Hook rules violation in CardBuilderModal**: `if (!isOpen) return null;` placed before hooks; triggers lint errors and risks state corruption.

---

## 3. Prioritized Plan

| Priority | ID | Title | Area | Effort | Main Risk |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **P0** | **B-003** | Expose joined table columns in Card Builder pickers | Frontend (CardBuilder) | **M** | Column name collisions across tables; ambiguous measure aggregations. |
| **P0** | **B-002** | Robust datetime parsing & temporal bucketing in profiler/engine | Backend & Frontend | **S** | Inconsistent date formats within the same column crashing Polars. |
| **P0** | **B-001** | Support flat & Key-Value JSON lookup table ingestion | Backend (storage.py) | **S** | Arbitrarily nested JSON structures failing tabular normalization. |
| **P1** | **B-004** | URL routing & deep linking (`?dashboard=:id` or hash route) | Frontend (App.tsx) | **S** | History stack desynchronization when modals open/close. |
| **P1** | **B-005** | Remote search & pagination for distinct column filter popover | Fullstack | **M** | Query latency on multi-million row Parquet files during rapid typing. |
| **P1** | **B-007** | Convert filter pills to semantic, keyboard-accessible `<button>` | Frontend (ParameterWidget) | **S** | CSS styling overrides colliding with browser button user-agent styles. |
| **P1** | **B-009** | Add date slicing and conditional binning to calculated columns | Backend (storage.py) | **M** | AST parser security hole permitting arbitrary code execution. |
| **P2** | **B-006** | Fix conditional hook execution order in CardBuilderModal | Frontend (CardBuilder) | **S** | None. Straightforward refactor moving guard below hooks. |
| **P2** | **B-010** | Internationalized currency & accounting negative number layout | Backend & Frontend | **S** | Breaking existing snapshots expecting hardcoded `$`. |
| **P2** | **B-011** | Text truncation (`text-overflow: ellipsis`) on card headers | Frontend (DashCard) | **S** | Title tooltip clipping if parent overflow is hidden. |
| **P2** | **B-012** | Responsive 1-column mobile breakpoint for grid layout | Frontend (GridLayout) | **M** | Preserving user-authored desktop grid coordinates upon window resize. |

*Flagged Items*:
- **B-008**: Dismissed as a product defect. Upstream dataset anomaly already mitigated by Polars CSV reader flags.

---

## 4. Quick Wins (< 1 Day Effort, High Impact)

1. **B-002 (Datetime Profiling Fix)**: Replace strict `str.to_date()` in `storage.py` with multi-format pattern matching or `str.to_datetime(strict=False)`. Instantly enables Date Bucket dropdown on all timestamp datasets.
2. **B-006 (Hook Order Fix)**: Move `if (!isOpen) return null;` in `CardBuilderModal.tsx` below all `useState` declarations. Clears 10 oxlint errors immediately.
3. **B-007 (Filter Pill Accessibility)**: Replace `<div className={styles.filterPill}>` with `<button type="button" className={styles.filterPill}>` in `ParameterWidget.tsx`. Delivers full keyboard Tab and Enter navigation.
4. **B-011 (Card Header Text Truncation)**: Add `overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: calc(100% - 60px);` to `_cardTitle` in `DashCard.module.css`. Prevents button overflow.
5. **B-004 (Hash-based Workspace Sync)**: Add `window.location.hash = activeDashboardId` in `App.tsx` and read initial state from `window.location.hash.slice(1)`. Gives instant refresh and bookmarking survival without adding new router dependencies.

---

## 5. Recommended First Milestone: "Self-Service Star Schema"

**Target Goal**: Enable a user to onboard the Kaggle Fraud dataset (CSV + JSON) and build Scenarios **S1 through S5** cleanly through the UI in under 10 minutes without workarounds.

**Included Scope (5 Items)**:
1. **B-003**: Star-schema column picker in Card Builder (enables S3 MCC category names and S4 Card brand).
2. **B-002**: Datetime timestamp detection and temporal grain selector (enables S2 Monthly spend trend).
3. **B-001**: Ingestion support for Key-Value JSON lookup files (`mcc_codes.json`).
4. **B-004**: URL state synchronization (enables S7 reload and workspace sharing).
5. **B-007**: Keyboard accessibility on filter parameters (polishes S5).

---

## 6. Spec Stubs for Top 3 Items

### Spec 1: Joined Table Column Support in Visual Card Builder (B-003)

```markdown
# Spec: Joined Table Column Support in Visual Card Builder

## Goal
Allow dashboard authors to select dimensions and measures from foreign-key linked tables directly within the Visual Card Builder, unlocking true star-schema visual analytics without SQL or manual table denormalization.

## Non-goals
- Defining new relationships inside the Card Builder modal (relationships remain managed in the Data Model tab).
- Supporting circular or ambiguous multi-path join topologies.

## Behavior
1. When a primary table is selected in CardBuilderModal, the system scans `relationships` for all links connected to that table.
2. The Category / Dimension dropdown displays primary table columns under a header (`-- Primary: <Table> --`), followed by columns from each joined table grouped under (`-- Joined: <Target Table> --`).
3. Selecting a column from a joined table passes its qualified reference (`table_id.column_name`) to the query configuration.
4. The backend query engine checks relationships, injects required left joins, and resolves the selected column alias.

## API / data changes
- `DimensionSpec` and `MeasureSpec` in `schemas.py`:
  - Add optional `table_id: Optional[str] = None`.
- `CardBuilderModalProps` in `CardBuilderModal.tsx`:
  - Add `relationships: RelationshipItem[]` and `allTables: TableItem[]`.

## Acceptance criteria (each becomes a test)
- [ ] Card Builder dimension picker lists columns from tables linked via foreign key.
- [ ] Selecting a joined dimension executes a query that joins the target table and renders the chart.
- [ ] Cards built with joined columns save and reload without schema resolution errors.

## Edge cases
- Joined table contains a column with the same name as the primary table (engine must alias with table suffix).
- Joined table file is deleted or missing (engine must return clean 400 error rather than crashing).

## Open questions
- Should measures from joined tables (e.g. `cards.credit_limit`) be aggregateable on transaction cards, or dimensions only?
```

---

### Spec 2: Datetime Parsing and Temporal Grain Bucketing (B-002)

```markdown
# Spec: Datetime Parsing and Temporal Grain Bucketing

## Goal
Automatically identify string timestamp columns during ingestion profiling and provide users with Year, Month, Day, and Hour aggregation grain buckets in the Card Builder.

## Non-goals
- Custom timezone transformation engines or daylight savings offsets.
- Fiscal year calendar overrides.

## Behavior
1. Ingestion profiler tests non-null string samples against ISO 8601 patterns (`%Y-%m-%d %H:%M:%S`, `%Y-%m-%dT%H:%M:%S`).
2. Columns passing datetime parsing are assigned `semantic_type: "date"`.
3. Selecting any column with `semantic_type: "date"` in the Card Builder reveals the "Date Bucket" dropdown with options: `Year`, `Quarter`, `Month`, `Week`, `Day`.
4. The backend engine applies the appropriate string slicing or Polars datetime truncation (`dt.truncate("1mo")`) before grouping.

## API / data changes
- `storage.py:profile_dataframe`:
  - Update string date detection to try `pl.col(col).str.to_datetime(strict=False)` in addition to `to_date`.
- `query_engine.py:execute_card_query`:
  - Support `date_grain: "quarter"` and `date_grain: "week"`.

## Acceptance criteria (each becomes a test)
- [ ] Uploading a CSV with `"2010-01-01 12:00:00"` tags column as `semantic_type: "date"`.
- [ ] Selecting that column in Card Builder displays the Date Bucket picker.
- [ ] Query engine groups spend amounts by `"2010-01"` when Month is selected.

## Edge cases
- Timestamps with mixed formatting or trailing millisecond offsets.
- Invalid date strings (e.g. `"0000-00-00 00:00:00"`).

## Open questions
- Should the underlying Parquet column be cast and stored as `pl.Datetime` on disk during upload commit, or left as String with dynamic truncation?
```

---

### Spec 3: Key-Value and Reference JSON Ingestion (B-001)

```markdown
# Spec: Key-Value and Reference JSON Ingestion

## Goal
Enable users to drop `.json` dictionary and array files directly onto the dashboard canvas, converting them into first-class lookup tables ready for relationship linking.

## Non-goals
- Full arbitrary document database querying or deeply nested JSON path extraction (arrays of nested objects).

## Behavior
1. Upload endpoint inspects `.json` files.
2. If file content is a JSON object with scalar values (`{"5812": "Restaurants"}`), it converts to a 2-column table (`key, value` or inferred names).
3. If file content is a JSON array of objects (`[{"id": 1, "name": "A"}]`), it normalizes into standard tabular columns.
4. Committed table is stored as Parquet and displayed in Data Model and Data View.

## API / data changes
- `storage.py`:
  - Add `".json"` to `TEXT_EXTENSIONS`.
  - Add `_preview_json(path)` parser to convert dictionary/array structures into Polars DataFrames.

## Acceptance criteria (each becomes a test)
- [ ] Dropping `mcc_codes.json` uploads successfully without 400 error.
- [ ] Ingested table displays 109 rows with columns `key` and `value`.
- [ ] Foreign key relationship can be linked from `transactions.mcc` to `mcc_codes.key`.

## Edge cases
- Large nested JSON files (e.g. `train_fraud_labels.json` at 152 MB). Parsing must stream or avoid loading full object tree if non-tabular.
- Empty JSON files (`{}` or `[]`).

## Open questions
- Should default column names for KV maps be `code, description` or `key, value`?
```

---

## 7. Strategic Decisions for the Lead Engineer

### Decision 1: Star-Schema Column Picker UX
- **Context**: B-003 requires exposing joined table columns in the Card Builder.
- **Option A (Table-Grouped Dropdown)**: Group columns by table in a single select element (`<optgroup label="cards_data">`).
- **Option B (Two-Stage Cascading Picker)**: First picker selects "Source Field Table" (Primary or any linked table); second picker selects column.
- **Recommendation**: **Option A**. Keeps card creation fast and avoids adding extra modal controls while clearly distinguishing primary attributes from joined dimensions.

### Decision 2: Ingestion Architecture for Files > 1 GB
- **Context**: Uploading `transactions_data.csv` (1.2 GB) strains FastAPI memory when using `await file.read()`.
- **Option A (Chunked Disk Spooling)**: Stream chunks directly from `file.file` to a temporary disk buffer; pass path directly to `pl.scan_csv()`.
- **Option B (Hard Upload Cap)**: Reject files over 250 MB in the UI with a warning to pre-sample or convert to Parquet.
- **Recommendation**: **Option A**. Polars excels at out-of-core streaming CSV ingestion; spooling directly to disk allows 10GB+ file ingestion with near-zero RAM overhead.

### Decision 3: URL State Management
- **Context**: B-004 causes workspace loss on page reload.
- **Option A (Lightweight Hash Route)**: Sync `activeDashboardId` to `window.location.hash = "#/dashboard/" + id`. Zero dependencies.
- **Option B (React Router / Browser History)**: Introduce `react-router-dom` with `/dashboards/:id` and sub-routes for `/model`, `/data`.
- **Recommendation**: **Option A** for immediate milestone delivery; adopt **Option B** only when deep-linking into specific card focus modes or cell outputs is needed.

---

## 8. Parity with Power BI: Diverge vs. Close the Gap

| Capability | Power BI Pattern | LarperBI Today | Strategy | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **Expression Language** | DAX (Data Analysis Expressions) | Safe Python AST arithmetic + Polars | **Deliberately Diverge** | DAX has a notoriously steep learning curve. Modern data analysts prefer Python/Pandas/Polars syntax. Expanding LarperBI's Python AST parser is far more powerful and accessible. |
| **Canvas Grid** | Freeform absolute pixel canvas with layering | 18-column magnetic grid (`react-grid-layout`) | **Deliberately Diverge** | Absolute positioning leads to misaligned cards and broken responsive layouts. Metabase's 18-column snap grid enforces clean aesthetics out of the box. |
| **Data Ingestion** | Power Query ETL editor (M language) | Direct drag-and-drop + in-product Jupyter Notebook | **Deliberately Diverge** | Power Query is heavy and isolated. Having an in-product Jupyter Notebook where cells can materialize Polars DataFrames into catalog tables (`[ ⚡ Save as Derived Table ]`) is superior for EDA. |
| **Star-Schema Navigation** | Relationship diagram with field pickers per table | Visual relationship builder, but pickers isolated to primary table | **Close the Gap** | Power BI's primary strength is seamless cross-table drag-and-drop. LarperBI must close this gap (B-003) to deliver true BI utility. |
| **Direct Filter Linking** | Slicers cross-filter all visuals using relationship topology | ParameterBar with manual column targeting | **Close the Gap** | Filter parameters should automatically propagate across joined tables without requiring the user to create separate filters per table. |
