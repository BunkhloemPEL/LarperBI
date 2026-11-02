import React from "react";
import {
  DashCard,
  SmartScalar,
  ProgressBar,
  GaugeChart,
  CartesianChart,
  DonutChart,
  WaterfallChart,
  FunnelChart,
  ScatterPlot,
  BoxPlot,
  TreemapChart,
  SankeyChart,
  PivotTable,
  buildTrendsOption,
  buildChannelBarOption,
  buildRowChartOption,
} from "./metabase-viz";

export const VisualGallery: React.FC = () => {
  // Baseline Data Sets for Benchmark Reference
  const mockScalar = {
    title: "Gross Settled Volume",
    current_value: 49480000,
    previous_value: 45730000,
    percent_change: 8.2,
    formatted_value: "$49.48M",
    trend_direction: "up" as const,
    is_favorable: true,
    comparison_label: "vs prior 30d",
  };

  const waterfallData = [
    { name: "Gross Authorized", value: 1000000 },
    { name: "3DS Auth Drop", value: -140000 },
    { name: "Declines", value: -85000 },
    { name: "Disputes & Fraud", value: -35000 },
    { name: "Merchant Recoveries", value: 12000 },
    { name: "Net Settled", value: 752000, isTotal: true },
  ];

  const funnelData = [
    { name: "1. Initiation", value: 1250000 },
    { name: "2. Identity Verification", value: 1180000 },
    { name: "3. Gateway Auth", value: 1140000 },
    { name: "4. Settlement", value: 1090000 },
    { name: "5. Chargebacks", value: 14500 },
  ];

  const scatterData = [
    {
      name: "Normal Transactions",
      color: "#509EE3",
      data: [
        [620, 45], [680, 78], [710, 120], [740, 210], [590, 32],
        [650, 95], [720, 140], [800, 320], [670, 85], [760, 250],
        [730, 180], [690, 110], [640, 60], [780, 290], [715, 130],
      ] as [number, number][],
    },
    {
      name: "Flagged Outliers (Fraud)",
      color: "#EF8C8C",
      data: [
        [510, 920], [540, 1450], [580, 880], [630, 2100], [605, 1200],
        [570, 980], [530, 1600], [615, 1350],
      ] as [number, number][],
    },
  ];

  const boxPlotData = [
    { name: "Chip POS", box: [5, 24, 52, 98, 220] as [number, number, number, number, number] },
    { name: "Online CNP", box: [12, 45, 110, 240, 580] as [number, number, number, number, number] },
    { name: "Swipe POS", box: [4, 18, 42, 85, 195] as [number, number, number, number, number] },
    { name: "ATM Terminal", box: [20, 60, 100, 200, 400] as [number, number, number, number, number] },
  ];

  const treemapData = [
    {
      name: "Retail & Shopping",
      value: 18500000,
      children: [
        { name: "Department Stores", value: 8500000 },
        { name: "Electronics Stores", value: 6200000 },
        { name: "Clothing Stores", value: 3800000 },
      ],
    },
    {
      name: "Travel & Hospitality",
      value: 12400000,
      children: [
        { name: "Airlines", value: 7100000 },
        { name: "Hotels & Resorts", value: 3900000 },
        { name: "Cruise Lines", value: 1400000 },
      ],
    },
    {
      name: "Food & Dining",
      value: 9800000,
      children: [
        { name: "Supermarkets", value: 5400000 },
        { name: "Restaurants", value: 4400000 },
      ],
    },
    {
      name: "Services & Tech",
      value: 8780000,
      children: [
        { name: "Money Transfer", value: 5200000 },
        { name: "Digital Goods", value: 3580000 },
      ],
    },
  ];

  const sankeyData = {
    nodes: [
      { name: "Online Channel" },
      { name: "Chip POS" },
      { name: "Swipe POS" },
      { name: "Visa" },
      { name: "Mastercard" },
      { name: "Amex" },
      { name: "Authorized" },
      { name: "Fraud Dispute" },
    ],
    links: [
      { source: "Online Channel", target: "Visa", value: 4500000 },
      { source: "Online Channel", target: "Mastercard", value: 5200000 },
      { source: "Chip POS", target: "Visa", value: 12000000 },
      { source: "Chip POS", target: "Mastercard", value: 14500000 },
      { source: "Swipe POS", target: "Visa", value: 3500000 },
      { source: "Swipe POS", target: "Amex", value: 2100000 },
      { source: "Visa", target: "Authorized", value: 19600000 },
      { source: "Visa", target: "Fraud Dispute", value: 400000 },
      { source: "Mastercard", target: "Authorized", value: 19100000 },
      { source: "Mastercard", target: "Fraud Dispute", value: 600000 },
      { source: "Amex", target: "Authorized", value: 2050000 },
      { source: "Amex", target: "Fraud Dispute", value: 50000 },
    ],
  };

  const pivotMatrix = {
    rowDimensionTitle: "Channel",
    colDimensionTitle: "Card Brand",
    rows: ["Chip Transaction", "Online Transaction", "Swipe Transaction"],
    columns: ["Visa", "Mastercard", "Amex", "Discover"],
    values: [
      [14200000, 16800000, 2400000, 1100000],
      [3800000, 4200000, 950000, 410000],
      [3200000, 3900000, 820000, 310000],
    ],
  };

  const trendOption = buildTrendsOption(
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"],
    [4800000, 4500000, 4900000, 5100000, 5200000, 4950000, 5050000, 4850000, 4750000, 5150000],
    [9200, 7800, 9100, 11200, 14200, 11800, 8900, 12400, 9500, 15800],
    [0.19, 0.17, 0.18, 0.22, 0.27, 0.24, 0.17, 0.25, 0.20, 0.31]
  );

  const barOption = buildChannelBarOption(
    ["Chip Transaction", "Online Transaction", "Swipe Transaction"],
    [34500000, 9360000, 8230000],
    [24000, 78000, 14400]
  );

  const rowOption = buildRowChartOption(
    ["Computers & Tech", "Home Furnishing", "Precious Stones", "Gift Stores", "Antique Shops"],
    [18.39, 9.76, 9.07, 5.53, 3.56]
  );

  return (
    <div style={{ padding: "0 0 3rem 0" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--mb-color-text-primary)" }}>
          Metabase Replicated Visuals Reference Benchmark
        </h2>
        <p style={{ fontSize: "0.8125rem", color: "var(--mb-color-text-muted)", marginTop: "2px" }}>
          Exhaustive baseline gallery of every visual component with Metabase styling, tokens, and options.
        </p>
      </div>

      {/* Grid of Components */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: "1.5rem",
        }}
      >
        {/* 1. SmartScalar */}
        <DashCard title="1. SmartScalar (KPI Card)" description="Metabase primary KPI card with period delta.">
          <SmartScalar data={mockScalar} />
        </DashCard>

        {/* 2. ProgressBar */}
        <DashCard title="2. ProgressBar" description="Horizontal quota / goal tracker.">
          <ProgressBar current={49480000} goal={60000000} isCurrency label="Monthly Target Cap" />
        </DashCard>

        {/* 3. GaugeChart */}
        <DashCard title="3. GaugeChart (Radial Risk Meter)" description="Radial dial with green/yellow/red threshold zones.">
          <GaugeChart value={0.12} min={0} max={0.5} unit="%" title="Loss Ratio" />
        </DashCard>

        {/* 4. WaterfallChart */}
        <DashCard title="4. WaterfallChart" description="Cumulative step bridge showing additions, deductions, and total.">
          <WaterfallChart data={waterfallData} height={260} />
        </DashCard>

        {/* 5. FunnelChart */}
        <DashCard title="5. FunnelChart" description="Multi-stage progression and conversion tracking.">
          <FunnelChart data={funnelData} height={260} />
        </DashCard>

        {/* 6. CartesianChart: Smooth Area + Line */}
        <DashCard title="6. CartesianChart: Area + Line" description="Dual-axis time-series trajectory with area gradient.">
          <CartesianChart option={trendOption} height={260} />
        </DashCard>

        {/* 7. CartesianChart: Grouped Bar */}
        <DashCard title="7. CartesianChart: Grouped Bar" description="Categorical comparison with rounded bar caps.">
          <CartesianChart option={barOption} height={260} />
        </DashCard>

        {/* 8. CartesianChart: Horizontal Row */}
        <DashCard title="8. CartesianChart: Horizontal Row" description="Rotated bar chart with conditional color thresholds.">
          <CartesianChart option={rowOption} height={260} />
        </DashCard>

        {/* 9. DonutChart */}
        <DashCard title="9. DonutChart" description="Concentric ring chart with center aggregate and pill legend.">
          <DonutChart
            data={[
              { name: "Mastercard", value: 24900000, percentage: 50.4, tx_count: 580000, fraud_count: 580 },
              { name: "Visa", value: 18900000, percentage: 38.2, tx_count: 420000, fraud_count: 410 },
              { name: "Amex", value: 4000000, percentage: 8.1, tx_count: 110000, fraud_count: 90 },
              { name: "Discover", value: 1680000, percentage: 3.3, tx_count: 49000, fraud_count: 45 },
            ]}
            height={260}
          />
        </DashCard>

        {/* 10. ScatterPlot */}
        <DashCard title="10. ScatterPlot" description="2D correlation and anomaly clustering.">
          <ScatterPlot series={scatterData} height={260} />
        </DashCard>

        {/* 11. BoxPlot */}
        <DashCard title="11. BoxPlot" description="Five-number statistical distribution summary across groups.">
          <BoxPlot groups={boxPlotData} height={260} />
        </DashCard>

        {/* 12. TreemapChart */}
        <DashCard title="12. TreemapChart" description="Hierarchical rectangular area tiles.">
          <TreemapChart data={treemapData} height={260} />
        </DashCard>

        {/* 13. SankeyChart */}
        <DashCard title="13. SankeyChart" description="Flow mapping across channels, networks, and outcomes.">
          <SankeyChart nodes={sankeyData.nodes} links={sankeyData.links} height={260} />
        </DashCard>

        {/* 14. PivotTable */}
        <DashCard title="14. PivotTable" description="Multi-dimensional cross-tabulation with heatmap tinting.">
          <PivotTable data={pivotMatrix} isCurrency height="100%" />
        </DashCard>
      </div>
    </div>
  );
};
