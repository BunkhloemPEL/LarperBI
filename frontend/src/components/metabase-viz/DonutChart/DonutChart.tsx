import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import { METABASE_PALETTE, formatCurrencyCompact } from "../CartesianChart/echarts-utils";
import type { CardBreakdownItem } from "../../../types/dashboard";

export interface DonutChartProps {
  data: CardBreakdownItem[];
  centerTitle?: string;
  centerSubtitle?: string;
  height?: number | string;
  className?: string;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  data,
  centerTitle,
  centerSubtitle = "Total Volume",
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

    const safeData = Array.isArray(data) ? data : [];
    const totalVal = safeData.reduce((acc, curr) => acc + (typeof curr?.value === "number" ? curr.value : 0), 0);
    const displayTotal = centerTitle || formatCurrencyCompact(totalVal);
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
          const item = params as { name: string; value: number; percent: number; color: string };
          return `
            <div style="font-weight:600;margin-bottom:4px;display:flex;align-items:center;gap:6px;">
              <span style="width:8px;height:8px;border-radius:50%;background:${item.color};"></span>
              ${item.name}
            </div>
            <div style="color:#64748b;margin:2px 0;">Volume: <span style="font-weight:600;color:#1e293b;">${formatCurrencyCompact(item.value)}</span></div>
            <div style="color:#64748b;margin:2px 0;">Share: <span style="font-weight:600;color:#1e293b;">${item.percent.toFixed(1)}%</span></div>
          `;
        },
      },
      legend: {
        orient: "vertical",
        right: 10,
        top: "middle",
        icon: "circle",
        itemWidth: 8,
        itemHeight: 8,
        textStyle: {
          color: "#64748b",
          fontSize: 12,
        },
        formatter: (name: string) => {
          const target = data.find((d) => d.name === name);
          if (!target) return name;
          return `${name}  ${target.percentage}%`;
        },
      },
      series: [
        {
          name: "Portfolio Share",
          type: "pie",
          radius: ["52%", "74%"],
          center: ["38%", "50%"],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 4,
            borderColor: "#ffffff",
            borderWidth: 2,
          },
          label: {
            show: false,
          },
          emphasis: {
            scale: true,
            scaleSize: 6,
          },
          data: safeData.map((d) => ({
            name: String(d?.name ?? ""),
            value: typeof d?.value === "number" ? d.value : 0,
          })),
        },
      ],
      graphic: [
        {
          type: "text",
          left: "37%",
          top: "45%",
          style: {
            text: displayTotal,
            align: "center",
            fill: "#1e293b",
            fontSize: 18,
            fontWeight: 700,
          },
        },
        {
          type: "text",
          left: "37%",
          top: "54%",
          style: {
            text: centerSubtitle,
            align: "center",
            fill: "#94a3b8",
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
  }, [data, centerTitle, centerSubtitle]);

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
      style={{ width: "100%", height, flex: 1, minHeight: 160 }}
    />
  );
};
