import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import { METABASE_PALETTE, formatNumberCompact } from "../CartesianChart/echarts-utils";

export interface FunnelStep {
  name: string;
  value: number;
}

export interface FunnelChartProps {
  data: FunnelStep[];
  height?: number | string;
  className?: string;
}

export const FunnelChart: React.FC<FunnelChartProps> = ({
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

    const maxVal = data[0]?.value || 1;

    const option: EChartsOption = {
      color: METABASE_PALETTE,
      tooltip: {
        trigger: "item",
        backgroundColor: "#ffffff",
        borderColor: "#e2e8f0",
        borderWidth: 1,
        padding: [10, 14],
        textStyle: { color: "#1e293b", fontSize: 12 },
        extraCssText: "box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); border-radius: 8px;",
        formatter: (params: unknown) => {
          const item = params as { name: string; value: number; color: string };
          const conversion = ((item.value / maxVal) * 100).toFixed(1);
          return `
            <div style="font-weight:600;margin-bottom:4px;display:flex;align-items:center;gap:6px;">
              <span style="width:8px;height:8px;border-radius:50%;background:${item.color};"></span>
              ${item.name}
            </div>
            <div style="color:#64748b;margin:2px 0;">Count: <span style="font-weight:600;color:#1e293b;">${item.value.toLocaleString()}</span></div>
            <div style="color:#64748b;margin:2px 0;">Retention from Top: <span style="font-weight:600;color:#1e293b;">${conversion}%</span></div>
          `;
        },
      },
      legend: {
        top: 0,
        icon: "circle",
        itemWidth: 8,
        itemHeight: 8,
        textStyle: { color: "#64748b", fontSize: 11 },
        data: data.map((d) => d.name),
      },
      series: [
        {
          name: "Funnel Progression",
          type: "funnel",
          left: "15%",
          top: 40,
          bottom: 20,
          width: "70%",
          min: 0,
          max: maxVal,
          minSize: "10%",
          maxSize: "100%",
          sort: "descending",
          gap: 4,
          label: {
            show: true,
            position: "inside",
            formatter: (params: { name?: string; value?: unknown }) => {
              const val = typeof params.value === "number" ? params.value : 0;
              return `${params.name ?? ""}: ${formatNumberCompact(val)}`;
            },
            color: "#ffffff",
            fontSize: 11,
            fontWeight: 600,
          },
          itemStyle: {
            borderColor: "#ffffff",
            borderWidth: 1.5,
            borderRadius: 4,
          },
          emphasis: {
            label: {
              fontSize: 13,
            },
          },
          data,
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
      style={{ width: "100%", height, minHeight: 240 }}
    />
  );
};
