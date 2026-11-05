# Metabase Visual Card Architecture Revamp Plan for LarperBI

> **Engineering Objective**: Re-architect LarperBI's visual card subsystem from a superficial visual mimic into an authentic, production-grade replica of Metabase's visualization architecture, referencing the genuine implementation in `metabase/`.

---

## 1. Executive Summary & Root Cause Analysis

Exploratory QA review identified that while LarperBI borrows Metabase's color palette, the underlying visual cards suffer from severe architectural flaws:

1. **Epileptic Gray Flicker on Click/Drag**: A single mouse interaction triggers up to 18 duplicate backend queries, immediately unmounting rendered charts to display a pulsing gray skeleton box (`skeletonPulse`).
2. **Zoom View Obscured & Small Card Overflow**: SmartScalar numbers are hardcoded to a fixed 34px (`2.125rem`). In 3-column cards, long numbers (`$571,835,522.28`) overflow container boundaries and clip; in 80vh Zoom Focus mode, the number remains a tiny 34px, lost in the container.
3. **Silent "No data to display" on Errors**: When queries fail (e.g. backend 500 due to unselected measures, column name collisions, or filter type mismatches), cards swallow the error and render a misleading `"No data to display."` message.
4. **Header Collision**: Maximize, Edit, and Delete action buttons are rendered as an absolutely positioned floating overlay (`top: 10, right: 10`), colliding with card titles and interfering with drag handles.

---

## 2. Metabase Source Architecture Benchmark

Inspecting `metabase/frontend/src/metabase/`:

```
metabase/frontend/src/metabase/
├── dashboard/components/DashCard/
│   ├── DashCard.tsx                  # Container coordinating lifecycle, drag handles, and actions
│   ├── DashCardVisualization.tsx      # Renders Visualization with LoadingView, NoResultsView, ErrorView
│   └── DashCardActionsPanel/         # Header toolbar with hover-reveal opacity and action buttons
├── visualizations/
│   ├── components/
│   │   ├── Visualization/
│   │   │   ├── Visualization.tsx      # State machine: Loading | NoResults | Error | Rendered
│   │   │   ├── LoadingView/          # Visual-specific skeletons (DashCardLoadingView)
│   │   │   ├── NoResultsView/        # Clean "No results" illustration
│   │   │   └── ErrorView/            # Warning icon with expandable error message
│   │   ├── ScalarValue/
│   │   │   ├── ScalarCardShell.tsx   # Measures container dimensions and provides sizing tiers
│   │   │   ├── ScalarValue.tsx       # Headline number with dynamic font scale and compactification
│   │   │   └── sizing.ts             # 7 Discrete size tiers (Tier 600 down to Tier 100)
│   │   └── EChartsRenderer/
│   │       └── EChartsRenderer.tsx   # SVG ECharts instance with explicit width/height & resize decoupling
│   └── visualizations/
│       ├── SmartScalar/              # KPI big number, trend delta badges, previous-period comparisons
│       ├── Scalar/                   # Single scalar value with auto-compactification ($571.8M)
│       └── CartesianChart/           # Area, Line, Bar, Row with custom tooltip models & legend layout
```

### Key Differences Between Metabase and LarperBI Today

| Architectural Dimension | Metabase Pattern | LarperBI Today | Target Architecture |
| :--- | :--- | :--- | :--- |
| **Card State Machine** | 5 Explicit States: `INITIAL_LOADING`, `RUNNING_BACKGROUND`, `IDLE_RENDERED`, `NO_RESULTS`, `ERROR` | Binary boolean: `isLoading ? <Skeleton /> : renderVisual()` | Full 5-state lifecycle with non-blocking background revalidation |
| **Drag & Layout Decoupling** | Card position changes `[x, y, w, h]` only trigger CSS grid reflow; 0 queries executed | Every layout tick updates parent React state, generating new card object references that trigger full API queries | Layout changes purely update grid coordinates; data queries strictly locked to deterministic query hash |
| **Background Refresh (SWR)** | Stale visual stays on screen during filter change; subtle 14px spinner in header | Unmounts visual immediately to show a full-card gray skeleton box | Keep existing chart visible during re-query (Stale-While-Revalidate) |
| **Scalar Typography** | 7 Sizing Tiers (`64px` in Zoom down to `20px` in compact) computed via `ResizeObserver` | Fixed 34px (`2.125rem`) CSS font size | Metabase 7-tier sizing engine + dynamic zoom scaling |
| **Number Compactification** | Automatic compactification (`$571.8M`) when container width is constrained, with full tooltip | Full verbatim string (`$571,835,522.28`) causing horizontal overflow | `compactifyValue()` on small tiers with unrounded tooltip on hover |
| **Header Action Toolbar** | Unified header toolbar in `.cardHeader` with hover opacity (`opacity: 0` $\to$ `1`) | Floating overlay (`position: absolute; top: 10, right: 10`) colliding with title | Integrated action toolbar slot inside `DashCard` |
| **Error Visibility** | Warning icon with descriptive error message and retry action | Silent catch-all rendering `"No data to display."` | Actionable `CardErrorView` showing error message and retry button |
| **Loading Skeletons** | Visual-specific skeletons (Scalar skeleton, Bar skeleton, Line skeleton, Table skeleton) | Generic pulsing gray box (`skeletonPulse`) | Visual-specific geometry-matched skeletons |

---

## 3. The 5 Core Revamp Workpackages

```
┌────────────────────────────────────────────────────────────────────────┐
│                        WP-1: Card Lifecycle & SWR Cache                │
│       Eliminate gray flicker; decouple layout from query execution     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
    ┌───────────────────────────────┴───────────────────────────────┐
    ▼                                                               ▼
┌───────────────────────────────────────┐   ┌───────────────────────────────────────┐
│     WP-2: Sizing & Scalar Engine      │   │     WP-3: Unified Header & Zoom       │
│  7 sizing tiers (20px-64px), compact  │   │  Header action toolbar, 80vh focus    │
│  formatting, Mantine trend delta badge│   │  inspection mode, zero title overlap  │
└───────────────────┬───────────────────┘   └───────────────────┬───────────────────┘
                    │                                           │
    ┌───────────────┴───────────────────────────────────────────┴───┐
    ▼                                                               ▼
┌───────────────────────────────────────┐   ┌───────────────────────────────────────┐
│     WP-4: Empty & Error States        │   │    WP-5: Visual-Specific Skeletons    │
│  Differentiate 0-row filter match from│   │  Scalar, Cartesian, Donut skeletons   │
│  query errors; actionable error views │   │  matching target component geometry   │
└───────────────────────────────────────┘   └───────────────────────────────────────┘
```

---

### Workpackage 1: Card Lifecycle & Non-Flashing SWR Cache

#### Problem
In `CanvasCardRenderer.tsx:95`, `useEffect` depends on `[dashboardId, card, activeFilters, dashboardFilters]`. When a card is dragged or clicked, `react-grid-layout` fires `onLayoutChange`, causing `App.tsx` to generate new `card` references. Every card re-fetches from the network and displays `skeletonPulse`.

#### Solution
1. **Deterministic Query Hash**:
   Compute a hash that ignores `grid_layout`:
   ```ts
   const queryHash = useMemo(() => {
     const relevantFilters = (dashboardFilters || []).map(f => ({
       id: f.id,
       col: f.column_name,
       val: activeFilters?.[f.id]
     })).filter(f => f.val !== undefined && f.val !== null && f.val !== "");
     return `${card.table_id}|${card.viz_type}|${JSON.stringify(card.config)}|${JSON.stringify(relevantFilters)}`;
   }, [card.table_id, card.viz_type, card.config, activeFilters, dashboardFilters]);
   ```
2. **Stale-While-Revalidate (SWR)**:
   - On initial mount with no cached data: Show skeleton loader.
   - On subsequent filter updates: Keep previous `queryResult.data` rendered. Display an unobtrusive 14px animated spinner in the card header.
   - Layout coordinate changes (`x, y, w, h`) trigger 0 queries and 0 state flips.

---

### Workpackage 2: Responsive Sizing Engine & SmartScalar Parity

#### Problem
`SmartScalar.tsx` uses a static CSS class (`font-size: 2.125rem`). Large values overflow in small cards; in Zoom mode, the number is tiny and uncentered.

#### Solution
Implement Metabase's 7-tier sizing specification from `metabase/frontend/src/metabase/visualizations/components/ScalarValue/sizing.ts`:

```ts
export interface ScalarSizeTier {
  size: 100 | 150 | 200 | 300 | 400 | 500 | 600;
  minWidth: number;
  minHeight: number;
  valueFontSize: number;
  titleFontSize: number;
  symbolSize: number;
  gap: number;
}

export const SCALAR_SIZE_TIERS: ScalarSizeTier[] = [
  { size: 600, minWidth: 600, minHeight: 280, valueFontSize: 64, titleFontSize: 16, symbolSize: 22, gap: 16 },
  { size: 500, minWidth: 500, minHeight: 220, valueFontSize: 56, titleFontSize: 15, symbolSize: 20, gap: 14 },
  { size: 400, minWidth: 380, minHeight: 180, valueFontSize: 48, titleFontSize: 14, symbolSize: 18, gap: 12 },
  { size: 300, minWidth: 280, minHeight: 140, valueFontSize: 40, titleFontSize: 13, symbolSize: 16, gap: 10 },
  { size: 200, minWidth: 180, minHeight: 100, valueFontSize: 32, titleFontSize: 12, symbolSize: 14, gap: 8 },
  { size: 150, minWidth: 120, minHeight: 70,  valueFontSize: 24, titleFontSize: 11, symbolSize: 12, gap: 6 },
  { size: 100, minWidth: 0,   minHeight: 0,   valueFontSize: 20, titleFontSize: 10, symbolSize: 10, gap: 4 },
];
```

1. **Container Dimension Hook**:
   Use `ResizeObserver` inside `SmartScalar` to observe `width` and `height`.
2. **Dynamic Compactification**:
   - If `tier.size <= 250` and the value exceeds 9 characters (e.g. `$571,835,522.28`), compactify to `$571.8M`.
   - Wrap the number in a tooltip displaying the exact uncompacted value.
3. **Mantine-Style Trend Badges**:
   - Delta percentage pill (`▲ +8.2% vs baseline`) rendered below the main value.
   - Green badge (`#88BF4D` / `rgba(136, 191, 77, 0.12)`) when favorable.
   - Red badge (`#EF8C8C` / `rgba(239, 140, 140, 0.12)`) when unfavorable.
   - Muted baseline text: `"vs prior period"` or `"vs baseline"`.

---

### Workpackage 3: Unified Header Chrome & High-Impact Zoom Mode

#### Problem
Floating action buttons (`position: absolute; top: 10, right: 10`) overlap card titles and block drag handles. Zoom mode is a plain box with no visual scaling.

#### Solution
1. **Integrated Header Toolbar**:
   Refactor `DashCard.tsx` so action buttons are passed directly into `.actionsPanel`:
   ```tsx
   <DashCard
     title={card.title}
     description={cardDescription}
     isRevalidating={isRevalidating}
     actions={
       <div className={styles.actionGroup}>
         <button onClick={onZoom} title="Maximize (Zoom)"><Maximize2 size={13} /></button>
         <button onClick={onEdit} title="Edit Visual"><Pencil size={13} /></button>
         <button onClick={onDelete} title="Delete Card"><Trash2 size={13} /></button>
       </div>
     }
   >
     {children}
   </DashCard>
   ```
   Actions panel has `opacity: 0` by default; smoothly transitions to `opacity: 1` when the user hovers over the card.
2. **Text Ellipsis with Title Tooltip**:
   Card title is constrained with `white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: calc(100% - 70px)`. If truncated, a clean tooltip displays the full title on hover.
3. **High-Impact Zoom / Focus Mode**:
   When Maximize is clicked:
   - Fullscreen overlay with dark backdrop blur (`rgba(15, 23, 42, 0.6)`).
   - Card content renders at **Tier 600**:
     - `SmartScalar`: Large 64px centered metric, large trend arrow, baseline comparison, centered title.
     - `CartesianChart`: Height 100% of 80vh container, expanded X-axis labels, interactive dataZoom slider.
     - `TableInteractive`: Full viewport scroll with virtualized sticky headers.
   - Esc key closes Zoom mode.

---

### Workpackage 4: State Machine (Loading, Empty, Error)

#### Problem
Cards treat query crashes, filter 0-row results, and unconfigured cards identically as `"No data to display."`.

#### Solution
Implement explicit state resolution in `CanvasCardRenderer.tsx`:

```tsx
if (status === "INITIAL_LOADING") {
  return <DashCardSkeleton vizType={card.viz_type} />;
}

if (status === "ERROR") {
  return <CardErrorView error={errorMessage} onRetry={fetchCardData} />;
}

if (status === "EMPTY_RESULTS") {
  return <CardEmptyState isFiltered={hasActiveFilters} onResetFilters={resetFilters} />;
}

return renderVisual();
```

1. **`CardEmptyState`**:
   - If filters are active: Displays Metabase search-off illustration with `"No results match your active filters"` and a `"Reset Filters"` action button.
   - If card has no measures configured: Displays `"No metric selected — edit card to choose a measure"`.
2. **`CardErrorView`**:
   - Displays warning triangle icon in Metabase coral (`#EF8C8C`).
   - Title: `"Query Failed"`.
   - Subtitle: Human-readable error message (e.g. `"Column 'amount' not found in table 'orders'"` or `"Backend connection error"`).
   - Action: `"Retry Query"` button.

---

### Workpackage 5: Visual-Specific Loading Skeletons

#### Problem
LarperBI displays a single, generic pulsing rectangle (`skeletonPulse`) for every visual type.

#### Solution
Port Metabase's geometry-matched skeleton components (`metabase/frontend/src/metabase/visualizations/components/skeletons/`):
1. **Scalar Skeleton**: Centered value pill (height 40px, width 120px) + subtitle pill (height 14px, width 80px) + trend pill (height 20px, width 60px). Matches exact geometry of `SmartScalar`.
2. **Cartesian Skeleton**: Y-axis vertical line + 5 horizontal guide bars of varied widths, pulsing gently in Metabase slate (`#f1f5f9` $\to$ `#e2e8f0`).
3. **Donut Skeleton**: Circular ring wireframe pulsing in center.
4. **Table Skeleton**: Header row with 4 column blocks + 3 skeleton row lines.

---

## 4. Implementation Phasing & Task Checklist

### Phase 1: Core Stability & Cache Engine
- [ ] Task 1.1: Replace `card` reference in `CanvasCardRenderer`'s `useEffect` with serialized `queryHash`.
- [ ] Task 1.2: Implement SWR non-blocking background revalidation (prevent visual unmount on refetch).
- [ ] Task 1.3: Fix `query_engine.py` empty measure fallback (`pl.len().alias("count")`) to eliminate HTTP 500 errors.
- [ ] Task 1.4: Refactor `DashCard.tsx` to receive action buttons in `.actionsPanel`; remove floating absolute button hack.

### Phase 2: Scalar & Typography Scaling
- [ ] Task 2.1: Create `LarperBI/frontend/src/components/metabase-viz/SmartScalar/sizing.ts` with 7 size tiers.
- [ ] Task 2.2: Add container measurement via `ResizeObserver` to `SmartScalar.tsx`.
- [ ] Task 2.3: Implement `compactifyValue()` ($571.8M) with hover tooltip showing unrounded number.
- [ ] Task 2.4: Revamp Zoom Focus view to render Tier 600 (64px) centered layout.

### Phase 3: Empty, Error & Skeleton States
- [ ] Task 3.1: Create `CardEmptyState.tsx` with filter reset action.
- [ ] Task 3.2: Create `CardErrorView.tsx` with error details and retry button.
- [ ] Task 3.3: Port `ScalarSkeleton`, `ChartSkeleton`, and `TableSkeleton` into `DashCard`.

### Phase 4: ECharts & Chart Refinement
- [ ] Task 4.1: Add 50ms resize debouncing to ECharts `CartesianChart`.
- [ ] Task 4.2: Ensure floating tooltips use Metabase shadow styling (`0 10px 15px -3px rgba(0,0,0,0.1)`).
- [ ] Task 4.3: Add legend hover emphasis with `notMerge=false` on pie/donut charts.

---

## 5. QA Acceptance Gates (Must Pass Before Completion)

1. **Zero Click Flicker**: Clicking any card or dragging across the canvas produces 0 queries and 0 skeleton flashes.
2. **Zoom View Legibility**: Opening Zoom mode on a SmartScalar displays the number in 64px font, centered, with no overlapping headers or clipped text.
3. **Small Card Robustness**: A 15-character number (`$571,835,522.28`) in a 3-column card auto-compacts to `$571.8M` with hover tooltip showing the exact figure.
4. **Actionable Error Surface**: Breaking a query intentionally displays `CardErrorView` with the error description and retry button, never `"No data to display."`.
5. **Port Hygiene**: All background test servers terminate cleanly upon test completion; ports 8000, 8001, 5173, and 5174 verified free.
