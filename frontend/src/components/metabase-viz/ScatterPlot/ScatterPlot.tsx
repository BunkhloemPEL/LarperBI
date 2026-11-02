import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import { METABASE_PALETTE, formatCurrencyCompact } from "../CartesianChart/echarts-utils";

export interface ScatterSeries {
  name: string;
  data: [number, number][]; // [x, y]
  color?: string;
}

export interface ScatterPlotProps {
  series: ScatterSeries[];
  xAxisName?: string;
  yAxisName?: string;
  xFormatter?: (val: number) => string;
  yFormatter?: (val: number) => string;
  height?: number | string;
  className?: string;
}

export const ScatterPlot: React.FC<ScatterPlotProps> = ({
  series,
  xAxisName = "Credit Score",
  yAxisName = "Transaction Amount",
  xFormatter = (v) => `${v}`,
  yFormatter = (v) => formatCurrencyCompact(v),
  height = "100%",
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (!chartRef.current) {
      chartRef.current = echarts.init(containerRef.current, null, {
        renderer: "svg",
      });
    }

    const option: EChartsOption = {
      color: series.map((s, i) => s.color || METABASE_PALETTE[i % METABASE_PALETTE.length]),
      grid: {
        left: 16,
        right: 24,
        top: 36,
        bottom: 24,
        containLabel: true,
      },
      legend: {
        top: 0,
        right: 12,
        icon: "circle",
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { color: "#64748b", fontSize: 11 },
        data: series.map((s) => s.name),
      },
      tooltip: {
        trigger: "item",
        backgroundColor: "#ffffff",
        borderColor: "#e2e8f0",
        borderWidth: 1,
        padding: [8, 12],
        textStyle: { color: "#1e293b", fontSize: 12 },
        extraCssText: "box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); border-radius: 8px;",
        formatter: (params: unknown) => {
          const item = params as { seriesName?: string; value?: [number, number]; color?: string };
          const coords = item.value ?? [0, 0];
          return `
            <div style="font-weight:600;margin-bottom:4px;display:flex;align-items:center;gap:6px;">
              <span style="width:8px;height:8px;border-radius:50%;background:${item.color ?? "#509EE3"};"></span>
              ${item.seriesName ?? ""}
            </div>
            <div style="color:#64748b;">${xAxisName}: <span style="font-weight:600;color:#1e293b;">${xFormatter(coords[0])}</span></div>
            <div style="color:#64748b;">${yAxisName}: <span style="font-weight:600;color:#1e293b;">${yFormatter(coords[1])}</span></div>
          `;
        },
      },
      xAxis: {
        type: "value",
        name: xAxisName,
        nameTextStyle: { color: "#64748b", fontSize: 11 },
        splitLine: { lineStyle: { color: "#f1f5f9", type: "dashed" } },
        axisLabel: {
          color: "#94a3b8",
          fontSize: 11,
          formatter: xFormatter,
        },
      },
      yAxis: {
        type: "value",
        name: yAxisName,
        nameTextStyle: { color: "#64748b", fontSize: 11 },
        splitLine: { lineStyle: { color: "#f1f5f9", type: "dashed" } },
        axisLabel: {
          color: "#94a3b8",
          fontSize: 11,
          formatter: yFormatter,
        },
      },
      series: series.map((s, i) => ({
        name: s.name,
        type: "scatter",
        symbolSize: 7,
        itemStyle: {
          color: s.color || METABASE_PALETTE[i % METABASE_PALETTE.length],
          opacity: 0.75,
        },
        emphasis: {
          itemStyle: {
            opacity: 1,
            borderColor: "#ffffff",
            borderWidth: 2,
          },
        },
        data: s.data,
      })),
    };

    chartRef.current.setOption(option, true);

    const resizeObserver = new ResizeObserver(() => {
      chartRef.current?.resize();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [series, xAxisName, yAxisName, xFormatter, yFormatter]);

  useEffect(() => {
    return () => {
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height, minHeight: 220 }}
    />
  );
};
