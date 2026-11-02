import type { EChartsOption } from "echarts";

export const METABASE_PALETTE = [
  "#509EE3", // Accent 0: Blue
  "#88BF4D", // Accent 1: Green
  "#A989C5", // Accent 2: Purple
  "#EF8C8C", // Accent 3: Red
  "#F9D45C", // Accent 4: Yellow
  "#F2A86F", // Accent 5: Orange
  "#98D9D9", // Accent 6: Cyan
  "#7172AD", // Accent 7: Indigo
];

export interface TooltipParamItem {
  axisValue?: string;
  name?: string;
  seriesName?: string;
  value?: number;
  color?: string;
}

export function formatCurrencyCompact(val: number): string {
  if (Math.abs(val) >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (Math.abs(val) >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(0)}`;
}

export function formatNumberCompact(val: number): string {
  if (Math.abs(val) >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (Math.abs(val) >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return `${val}`;
}

export function buildGenericBarOption(
  rawDimensions: unknown[],
  rawSeries: { name: string; data: number[]; color?: string }[]
): EChartsOption {
  const dimensions = (Array.isArray(rawDimensions) ? rawDimensions : []).map((d) => String(d ?? ""));
  const series = Array.isArray(rawSeries) ? rawSeries : [];

  return {
    color: series.map((s, i) => s.color || METABASE_PALETTE[i % METABASE_PALETTE.length]),
    grid: {
      left: 12,
      right: 16,
      top: series.length > 1 ? 40 : 20,
      bottom: 24,
      containLabel: true,
    },
    dataZoom: [
      {
        type: "inside",
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
      },
    ],
    legend: series.length > 1 ? {
      data: series.map((s) => s.name),
      top: 0,
      right: 10,
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: "#64748b", fontSize: 11 },
    } : undefined,
    tooltip: {
      trigger: "axis",
      backgroundColor: "#ffffff",
      borderColor: "#e2e8f0",
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: "#1e293b", fontSize: 12 },
      extraCssText: "box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); border-radius: 8px;",
      formatter: (params: unknown) => {
        const items = params as TooltipParamItem[];
        if (!Array.isArray(items) || items.length === 0) return "";
        const header = `<div style="font-weight:600;margin-bottom:4px;color:#1e293b;">${items[0].axisValue ?? ""}</div>`;
        const rows = items
          .map((p) => {
            const val = typeof p.value === "number" ? p.value : 0;
            return `
              <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:2px 0;">
                <span style="display:flex;align-items:center;gap:4px;">
                  <span style="width:8px;height:8px;border-radius:50%;background:${p.color ?? "#509EE3"};"></span>
                  <span style="color:#64748b;">${p.seriesName ?? ""}</span>
                </span>
                <span style="font-weight:600;color:#1e293b;">${formatNumberCompact(val)}</span>
              </div>
            `;
          })
          .join("");
        return header + rows;
      },
    },
    xAxis: {
      type: "category",
      data: dimensions,
      axisLine: { lineStyle: { color: "#e2e8f0" } },
      axisTick: { show: false },
      axisLabel: {
        color: "#64748b",
        fontSize: 11,
        interval: 0,
        rotate: dimensions.length > 6 ? 25 : 0,
      },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "#f1f5f9", type: "dashed" } },
      axisLabel: {
        color: "#94a3b8",
        fontSize: 11,
        formatter: (v: number) => formatNumberCompact(v),
      },
    },
    series: series.map((s, i) => ({
      name: s.name,
      type: "bar",
      barMaxWidth: 32,
      data: s.data,
      itemStyle: {
        borderRadius: [4, 4, 0, 0],
        color: s.color || METABASE_PALETTE[i % METABASE_PALETTE.length],
      },
    })),
  };
}

export function buildGenericRowOption(
  rawDimensions: unknown[],
  rawSeries: { name: string; data: number[]; color?: string }[]
): EChartsOption {
  const dimensions = (Array.isArray(rawDimensions) ? rawDimensions : []).map((d) => String(d ?? ""));
  const series = Array.isArray(rawSeries) && rawSeries[0] ? rawSeries[0] : { name: "Value", data: [] };

  const reversedDims = [...dimensions].reverse();
  const reversedData = [...(series.data || [])].reverse();

  return {
    grid: {
      left: 10,
      right: 36,
      top: 10,
      bottom: 10,
      containLabel: true,
    },
    tooltip: {
      trigger: "item",
      backgroundColor: "#ffffff",
      borderColor: "#e2e8f0",
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: "#1e293b", fontSize: 12 },
      extraCssText: "box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); border-radius: 8px;",
    },
    xAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "#f1f5f9", type: "dashed" } },
      axisLabel: {
        color: "#94a3b8",
        fontSize: 11,
        formatter: (v: number) => formatNumberCompact(v),
      },
    },
    yAxis: {
      type: "category",
      data: reversedDims,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: "#475569",
        fontSize: 11,
        width: 130,
        overflow: "truncate",
      },
    },
    series: [
      {
        name: series.name,
        type: "bar",
        data: reversedData,
        barMaxWidth: 18,
        itemStyle: {
          borderRadius: [0, 4, 4, 0],
          color: METABASE_PALETTE[0],
        },
        label: {
          show: true,
          position: "right",
          formatter: (p: { value?: unknown }) => {
            const v = typeof p.value === "number" ? p.value : 0;
            return formatNumberCompact(v);
          },
          fontSize: 11,
          fontWeight: 600,
          color: "#64748b",
        },
      },
    ],
  };
}

export function buildGenericLineOption(
  rawDimensions: unknown[],
  rawSeries: { name: string; data: number[]; color?: string }[],
  isArea: boolean = false
): EChartsOption {
  const dimensions = (Array.isArray(rawDimensions) ? rawDimensions : []).map((d) => String(d ?? ""));
  const series = Array.isArray(rawSeries) ? rawSeries : [];

  return {
    dataZoom: [
      {
        type: "inside",
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
      },
    ],
    color: series.map((s, i) => s.color || METABASE_PALETTE[i % METABASE_PALETTE.length]),
    grid: {
      left: 12,
      right: 16,
      top: series.length > 1 ? 40 : 20,
      bottom: 24,
      containLabel: true,
    },
    legend: series.length > 1 ? {
      data: series.map((s) => s.name),
      top: 0,
      right: 10,
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: "#64748b", fontSize: 11 },
    } : undefined,
    tooltip: {
      trigger: "axis",
      backgroundColor: "#ffffff",
      borderColor: "#e2e8f0",
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: "#1e293b", fontSize: 12 },
      extraCssText: "box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); border-radius: 8px;",
    },
    xAxis: {
      type: "category",
      data: dimensions,
      axisLine: { lineStyle: { color: "#e2e8f0" } },
      axisTick: { show: false },
      axisLabel: {
        color: "#64748b",
        fontSize: 11,
      },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "#f1f5f9", type: "dashed" } },
      axisLabel: {
        color: "#94a3b8",
        fontSize: 11,
        formatter: (v: number) => formatNumberCompact(v),
      },
    },
    series: series.map((s, i) => {
      const col = s.color || METABASE_PALETTE[i % METABASE_PALETTE.length];
      return {
        name: s.name,
        type: "line",
        smooth: true,
        symbol: "none",
        lineStyle: { width: 2.2, color: col },
        areaStyle: isArea ? { opacity: 0.15, color: col } : undefined,
        data: s.data,
      };
    }),
  };
}

// Keep specialized builders for demo reference
export function buildTrendsOption(
  dimensions: string[],
  volume: number[],
  fraudVolume: number[],
  _fraudRate: number[]
): EChartsOption {
  return {
    color: [METABASE_PALETTE[0], METABASE_PALETTE[3]],
    grid: { left: 12, right: 16, top: 48, bottom: 24, containLabel: true },
    legend: { data: ["Gross Volume ($)", "Fraud Losses ($)"], top: 4, right: 40, icon: "circle", itemWidth: 8, itemHeight: 8 },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: dimensions },
    yAxis: [{ type: "value" }, { type: "value", position: "right" }],
    series: [
      { name: "Gross Volume ($)", type: "line", yAxisIndex: 0, data: volume, smooth: true, areaStyle: { opacity: 0.15 } },
      { name: "Fraud Losses ($)", type: "line", yAxisIndex: 1, data: fraudVolume, smooth: true },
    ],
  };
}

export function buildChannelBarOption(
  channels: string[],
  volumes: number[],
  fraudAmounts: number[]
): EChartsOption {
  const safeChannels = (channels || []).map((c) => String(c ?? "").replace(" Transaction", ""));
  return {
    color: [METABASE_PALETTE[0], METABASE_PALETTE[3]],
    grid: { left: 12, right: 12, top: 48, bottom: 12, containLabel: true },
    legend: { data: ["Total Volume ($)", "Fraud Volume ($)"], top: 4, right: 16, icon: "circle", itemWidth: 8, itemHeight: 8 },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: safeChannels },
    yAxis: { type: "value" },
    series: [
      { name: "Total Volume ($)", type: "bar", data: volumes || [], barMaxWidth: 32 },
      { name: "Fraud Volume ($)", type: "bar", data: fraudAmounts || [], barMaxWidth: 32 },
    ],
  };
}

export function buildRowChartOption(
  categories: string[],
  fraudRates: number[]
): EChartsOption {
  const safeCategories = (categories || []).map((c) => String(c ?? ""));
  const reversedCats = [...safeCategories].reverse();
  const reversedRates = [...(fraudRates || [])].reverse();

  return {
    grid: { left: 10, right: 36, top: 10, bottom: 10, containLabel: true },
    tooltip: { trigger: "item" },
    xAxis: { type: "value" },
    yAxis: { type: "category", data: reversedCats },
    series: [{ name: "Rate (%)", type: "bar", data: reversedRates, barMaxWidth: 16 }],
  };
}
