import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import { METABASE_PALETTE } from "../CartesianChart/echarts-utils";

export interface GaugeSegment {
  threshold: number; // Ratio 0 to 1
  color: string;
}

export interface GaugeChartProps {
  value: number;
  min?: number;
  max?: number;
  unit?: string;
  title?: string;
  segments?: GaugeSegment[];
  height?: number | string;
  className?: string;
}

const DEFAULT_SEGMENTS: GaugeSegment[] = [
  { threshold: 0.2, color: METABASE_PALETTE[1] }, // Green
  { threshold: 0.6, color: METABASE_PALETTE[4] }, // Yellow
  { threshold: 1.0, color: METABASE_PALETTE[3] }, // Red
];

export const GaugeChart: React.FC<GaugeChartProps> = ({
  value,
  min = 0,
  max = 100,
  unit = "%",
  title = "Current Metric",
  segments = DEFAULT_SEGMENTS,
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

    const colorStops: [number, string][] = segments.map((s) => [s.threshold, s.color]);

    const option: EChartsOption = {
      series: [
        {
          type: "gauge",
          startAngle: 200,
          endAngle: -20,
          min,
          max,
          splitNumber: 5,
          itemStyle: {
            color: "#1e293b",
          },
          progress: {
            show: true,
            width: 14,
            roundCap: true,
          },
          pointer: {
            show: true,
            length: "60%",
            width: 4,
            itemStyle: {
              color: "#334155",
            },
          },
          axisLine: {
            roundCap: true,
            lineStyle: {
              width: 14,
              color: colorStops,
            },
          },
          axisTick: {
            show: false,
          },
          splitLine: {
            length: 6,
            lineStyle: {
              width: 1.5,
              color: "#94a3b8",
            },
          },
          axisLabel: {
            distance: 22,
            color: "#94a3b8",
            fontSize: 10,
          },
          title: {
            show: true,
            offsetCenter: [0, "65%"],
            fontSize: 12,
            color: "#64748b",
            fontWeight: 500,
          },
          detail: {
            valueAnimation: true,
            fontSize: 22,
            fontWeight: 700,
            offsetCenter: [0, "35%"],
            formatter: `{value}${unit}`,
            color: "#1e293b",
          },
          data: [
            {
              value: Number(value.toFixed(2)),
              name: title,
            },
          ],
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
  }, [value, min, max, unit, title, segments]);

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
