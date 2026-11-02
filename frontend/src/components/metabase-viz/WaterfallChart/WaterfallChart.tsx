import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import { METABASE_PALETTE, formatCurrencyCompact } from "../CartesianChart/echarts-utils";

export interface WaterfallStep {
  name: string;
  value: number; // Positive = add, negative = subtract
  isTotal?: boolean; // True if it is a net/total bar
}

export interface WaterfallChartProps {
  data: WaterfallStep[];
  height?: number | string;
  className?: string;
}

export const WaterfallChart: React.FC<WaterfallChartProps> = ({
  data,
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

    const categories: string[] = [];
    const baseData: number[] = [];
    const deltaData: number[] = [];
    const barColors: string[] = [];

    let runningTotal = 0;

    data.forEach((step) => {
      categories.push(step.name);

      if (step.isTotal) {
        baseData.push(0);
        deltaData.push(Math.abs(runningTotal));
        barColors.push(METABASE_PALETTE[0]); // Metabase Brand Blue for totals
      } else if (step.value >= 0) {
        baseData.push(runningTotal);
        deltaData.push(step.value);
        runningTotal += step.value;
        barColors.push(METABASE_PALETTE[1]); // Green for additions
      } else {
        runningTotal += step.value;
        baseData.push(runningTotal);
        deltaData.push(Math.abs(step.value));
        barColors.push(METABASE_PALETTE[3]); // Red for deductions/losses
      }
    });

    const option: EChartsOption = {
      grid: {
        left: 12,
        right: 12,
        top: 32,
        bottom: 24,
        containLabel: true,
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: "#ffffff",
        borderColor: "#e2e8f0",
        borderWidth: 1,
        padding: [10, 14],
        textStyle: { color: "#1e293b", fontSize: 12 },
        extraCssText: "box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); border-radius: 8px;",
        axisPointer: { type: "shadow" },
        formatter: (params: unknown) => {
          const items = params as { name?: string; dataIndex?: number }[];
          if (!Array.isArray(items) || items.length === 0) return "";
          const idx = items[0].dataIndex ?? 0;
          const step = data[idx];
          if (!step) return "";
          const isPos = step.value >= 0;
          const valColor = step.isTotal ? METABASE_PALETTE[0] : isPos ? METABASE_PALETTE[1] : METABASE_PALETTE[3];
          const sign = step.isTotal ? "" : isPos ? "+" : "-";

          return `
            <div style="font-weight:600;margin-bottom:4px;color:#1e293b;">${step.name}</div>
            <div style="color:#64748b;">
              Impact: <span style="font-weight:600;color:${valColor};">${sign}${formatCurrencyCompact(Math.abs(step.value))}</span>
            </div>
          `;
        },
      },
      xAxis: {
        type: "category",
        data: categories,
        axisLine: { lineStyle: { color: "#e2e8f0" } },
        axisTick: { show: false },
        axisLabel: {
          color: "#64748b",
          fontSize: 11,
          interval: 0,
          rotate: categories.length > 5 ? 20 : 0,
        },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: "#f1f5f9", type: "dashed" } },
        axisLabel: {
          color: "#94a3b8",
          fontSize: 11,
          formatter: (v: number) => formatCurrencyCompact(v),
        },
      },
      series: [
        {
          name: "Placeholder Base",
          type: "bar",
          stack: "waterfall",
          silent: true,
          itemStyle: {
            borderColor: "transparent",
            color: "transparent",
          },
          data: baseData,
        },
        {
          name: "Step Value",
          type: "bar",
          stack: "waterfall",
          barMaxWidth: 36,
          itemStyle: {
            borderRadius: 4,
            color: (params: { dataIndex?: unknown }) => {
              const idx = typeof params.dataIndex === "number" ? params.dataIndex : 0;
              return barColors[idx] || METABASE_PALETTE[0];
            },
          },
          data: deltaData,
        },
      ],
    };

    chartRef.current.setOption(option, true);

    const resizeObserver = new ResizeObserver(() => {
      chartRef.current?.resize();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [data]);

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
