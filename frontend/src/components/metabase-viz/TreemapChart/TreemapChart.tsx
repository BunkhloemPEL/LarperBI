import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import { METABASE_PALETTE, formatCurrencyCompact } from "../CartesianChart/echarts-utils";

export interface TreemapNode {
  name: string;
  value: number;
  itemStyle?: { color?: string };
  children?: TreemapNode[];
}

export interface TreemapChartProps {
  data: TreemapNode[];
  height?: number | string;
  className?: string;
}

export const TreemapChart: React.FC<TreemapChartProps> = ({
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

    const coloredData = data.map((item, idx) => ({
      name: item.name,
      value: item.value,
      children: item.children,
      itemStyle: item.itemStyle || {
        color: METABASE_PALETTE[idx % METABASE_PALETTE.length],
      },
    }));

    const option: EChartsOption = {
      tooltip: {
        trigger: "item",
        backgroundColor: "#ffffff",
        borderColor: "#e2e8f0",
        borderWidth: 1,
        padding: [10, 14],
        textStyle: { color: "#1e293b", fontSize: 12 },
        extraCssText: "box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); border-radius: 8px;",
        formatter: (params: unknown) => {
          const item = params as { name?: string; value?: number };
          const val = typeof item.value === "number" ? item.value : 0;
          return `
            <div style="font-weight:600;margin-bottom:4px;color:#1e293b;">${item.name ?? ""}</div>
            <div style="color:#64748b;">Volume: <span style="font-weight:600;color:#1e293b;">${formatCurrencyCompact(val)}</span></div>
          `;
        },
      },
      series: [
        {
          type: "treemap",
          data: coloredData,
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          roam: false,
          nodeClick: false,
          breadcrumb: {
            show: false,
          },
          label: {
            show: true,
            formatter: "{b}\n{c}",
            color: "#ffffff",
            fontSize: 12,
            fontWeight: 600,
          },
          itemStyle: {
            borderColor: "#ffffff",
            borderWidth: 2,
            gapWidth: 2,
            borderRadius: 4,
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
