import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import { METABASE_PALETTE, formatCurrencyCompact } from "../CartesianChart/echarts-utils";

export interface SankeyNode {
  name: string;
  itemStyle?: { color?: string };
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

export interface SankeyChartProps {
  nodes: SankeyNode[];
  links: SankeyLink[];
  height?: number | string;
  className?: string;
}

export const SankeyChart: React.FC<SankeyChartProps> = ({
  nodes,
  links,
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

    const coloredNodes = nodes.map((node, i) => ({
      ...node,
      itemStyle: node.itemStyle || {
        color: METABASE_PALETTE[i % METABASE_PALETTE.length],
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
          const item = params as { dataType?: string; data?: { source?: string; target?: string; value?: number; name?: string } };
          if (item.dataType === "edge" && item.data) {
            const val = typeof item.data.value === "number" ? item.data.value : 0;
            return `
              <div style="font-weight:600;margin-bottom:4px;color:#1e293b;">${item.data.source} → ${item.data.target}</div>
              <div style="color:#64748b;">Volume: <span style="font-weight:600;color:#1e293b;">${formatCurrencyCompact(val)}</span></div>
            `;
          }
          return `<div style="font-weight:600;color:#1e293b;">${item.data?.name ?? ""}</div>`;
        },
      },
      series: [
        {
          type: "sankey",
          emphasis: {
            focus: "adjacency",
          },
          nodeWidth: 14,
          nodeGap: 16,
          nodeAlign: "justify",
          left: 10,
          right: 80,
          top: 10,
          bottom: 10,
          data: coloredNodes,
          links,
          lineStyle: {
            color: "gradient",
            curveness: 0.5,
            opacity: 0.35,
          },
          label: {
            color: "#475569",
            fontSize: 11,
            fontWeight: 500,
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
  }, [nodes, links]);

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
      style={{ width: "100%", height, minHeight: 240 }}
    />
  );
};
