import React from "react";

export interface CardSkeletonProps {
  vizType?: string;
}

export const CardSkeleton: React.FC<CardSkeletonProps> = ({ vizType = "bar" }) => {
  const pulseStyle: React.CSSProperties = {
    background: "linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)",
    backgroundSize: "200% 100%",
    animation: "mbSkeletonPulse 1.5s infinite",
    borderRadius: "4px",
  };

  if (vizType === "smart_scalar") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          height: "100%",
          padding: "1rem 0.5rem",
          gap: "0.75rem",
        }}
      >
        {/* Value pill */}
        <div style={{ ...pulseStyle, width: "140px", height: "36px", borderRadius: "6px" }} />
        {/* Title pill */}
        <div style={{ ...pulseStyle, width: "90px", height: "14px" }} />
        {/* Trend comparison pill */}
        <div style={{ ...pulseStyle, width: "110px", height: "18px", borderRadius: "9999px" }} />
      </div>
    );
  }

  if (vizType === "donut" || vizType === "pie") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          minHeight: 140,
        }}
      >
        <div
          style={{
            ...pulseStyle,
            width: "120px",
            height: "120px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Inner cutout for donut */}
          <div style={{ width: "60px", height: "60px", borderRadius: "50%", backgroundColor: "#ffffff" }} />
        </div>
      </div>
    );
  }

  if (vizType === "table") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem", height: "100%", padding: "0.5rem 0" }}>
        {/* Header row */}
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <div style={{ ...pulseStyle, flex: 1, height: "18px" }} />
          <div style={{ ...pulseStyle, flex: 1, height: "18px" }} />
          <div style={{ ...pulseStyle, flex: 1, height: "18px" }} />
        </div>
        {/* Body rows */}
        <div style={{ ...pulseStyle, width: "100%", height: "14px" }} />
        <div style={{ ...pulseStyle, width: "100%", height: "14px" }} />
        <div style={{ ...pulseStyle, width: "100%", height: "14px" }} />
        <div style={{ ...pulseStyle, width: "70%", height: "14px" }} />
      </div>
    );
  }

  // Cartesian Chart Skeleton (Bar, Line, Area, Row)
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: "0.75rem",
        height: "100%",
        minHeight: 140,
        padding: "1rem 0.5rem 0.5rem 0.5rem",
        borderLeft: "2px solid #e2e8f0",
        borderBottom: "2px solid #e2e8f0",
      }}
    >
      <div style={{ ...pulseStyle, width: "16%", height: "45%" }} />
      <div style={{ ...pulseStyle, width: "16%", height: "75%" }} />
      <div style={{ ...pulseStyle, width: "16%", height: "35%" }} />
      <div style={{ ...pulseStyle, width: "16%", height: "90%" }} />
      <div style={{ ...pulseStyle, width: "16%", height: "60%" }} />
    </div>
  );
};
