import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import { METABASE_PALETTE, formatCurrencyCompact } from "../CartesianChart/echarts-utils";

export interface BoxPlotGroup {
  name: string;
  // [min, Q1, median, Q3, max]
  box: [number, number, number, number, number];
}

export interface BoxPlotProps {
  groups: BoxPlotGroup[];
  yAxisName?: string;
  yFormatter?: (val: number) => string;
  height?: number | string;
  className?: string;
}

export const BoxPlot: React.FC<BoxPlotProps> = ({
  groups,
  yAxisName = "Transaction Size ($)",
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

    const categories = groups.map((g) => g.name);
    const boxData = groups.map((g) => g.box);

    const option: EChartsOption = {
      grid: {
        left: 16,
        right: 16,
        top: 32,
        bottom: 24,
        containLabel: true,
      },
      tooltip: {
        trigger: "item",
        backgroundColor: "#ffffff",
        borderColor: "#e2e8f0",
        borderWidth: 1,
        padding: [10, 14],
        textStyle: { color: "#1e293b", fontSize: 12 },
        extraCssText: "box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); border-radius: 8px;",
        formatter: (params: unknown) => {
          const item = params as { name?: string; value?: number[] };
          const vals = item.value ?? [];
          if (vals.length < 5) return "";
          const [min, q1, med, q3, max] = vals;
          return `
            <div style="font-weight:600;margin-bottom:6px;color:#1e293b;">${item.name ?? ""} Distribution</div>
            <div style="color:#64748b;margin:2px 0;">Max: <span style="font-weight:600;color:#1e293b;">${yFormatter(max)}</span></div>
            <div style="color:#64748b;margin:2px 0;">Q3 (75%): <span style="font-weight:600;color:#1e293b;">${yFormatter(q3)}</span></div>
            <div style="color:#64748b;margin:2px 0;">Median: <span style="font-weight:600;color:${METABASE_PALETTE[0]};">${yFormatter(med)}</span></div>
            <div style="color:#64748b;margin:2px 0;">Q1 (25%): <span style="font-weight:600;color:#1e293b;">${yFormatter(q1)}</span></div>
            <div style="color:#64748b;margin:2px 0;">Min: <span style="font-weight:600;color:#1e293b;">${yFormatter(min)}</span></div>
          `;
        },
      },
      xAxis: {
        type: "category",
        data: categories,
        axisLine: { lineStyle: { color: "#e2e8f0" } },
        axisTick: { show: false },
        axisLabel: { color: "#64748b", fontSize: 11 },
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
      series: [
        {
          name: "Distribution",
          type: "boxplot",
          data: boxData,
          itemStyle: {
            color: "rgba(80, 158, 227, 0.15)",
            borderColor: METABASE_PALETTE[0],
            borderWidth: 1.5,
          },
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
  }, [groups, yAxisName, yFormatter]);

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
