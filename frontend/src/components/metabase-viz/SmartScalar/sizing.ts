export interface ScalarSizeTier {
  size: 100 | 150 | 200 | 300 | 400 | 500 | 600;
  minWidth: number;
  minHeight: number;
  valueFontSize: number;
  titleFontSize: number;
  symbolSize: number;
  badgeFontSize: number;
  gap: number;
}

export const SCALAR_SIZE_TIERS: readonly ScalarSizeTier[] = [
  { size: 600, minWidth: 600, minHeight: 280, valueFontSize: 64, titleFontSize: 16, symbolSize: 22, badgeFontSize: 14, gap: 16 },
  { size: 500, minWidth: 500, minHeight: 220, valueFontSize: 56, titleFontSize: 15, symbolSize: 20, badgeFontSize: 13, gap: 14 },
  { size: 400, minWidth: 380, minHeight: 180, valueFontSize: 48, titleFontSize: 14, symbolSize: 18, badgeFontSize: 13, gap: 12 },
  { size: 300, minWidth: 280, minHeight: 140, valueFontSize: 40, titleFontSize: 13, symbolSize: 16, badgeFontSize: 12, gap: 10 },
  { size: 200, minWidth: 180, minHeight: 100, valueFontSize: 32, titleFontSize: 12, symbolSize: 14, badgeFontSize: 11, gap: 8 },
  { size: 150, minWidth: 120, minHeight: 70,  valueFontSize: 24, titleFontSize: 11, symbolSize: 12, badgeFontSize: 10, gap: 6 },
  { size: 100, minWidth: 0,   minHeight: 0,   valueFontSize: 20, titleFontSize: 10, symbolSize: 10, badgeFontSize: 9,  gap: 4 },
];

export function getScalarSizeTier(width: number, height: number): ScalarSizeTier {
  for (const tier of SCALAR_SIZE_TIERS) {
    if (width >= tier.minWidth && height >= tier.minHeight) {
      return tier;
    }
  }
  return SCALAR_SIZE_TIERS[SCALAR_SIZE_TIERS.length - 1];
}

/**
 * Compactifies large numbers ($571,835,522.28 -> $571.8M, 1,234,567 -> 1.2M)
 * when container space is constrained.
 */
export function compactifyValue(rawVal: string | number | null | undefined): string {
  if (rawVal === null || rawVal === undefined) return "-";
  if (typeof rawVal === "number") {
    if (isNaN(rawVal)) return "-";
    const abs = Math.abs(rawVal);
    const prefix = rawVal < 0 ? "-" : "";
    if (abs >= 1_000_000_000) return `${prefix}${(abs / 1_000_000_000).toFixed(1)}B`;
    if (abs >= 1_000_000) return `${prefix}${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 100_000) return `${prefix}${(abs / 1_000).toFixed(0)}K`;
    return rawVal.toLocaleString();
  }

  const str = String(rawVal).trim();
  const hasDollar = str.startsWith("$") || str.startsWith("-$");
  const isNeg = str.startsWith("-") || str.startsWith("-$");
  const cleanNumStr = str.replace(/[$,]/g, "");
  const num = parseFloat(cleanNumStr);
  if (isNaN(num)) return str;

  const prefix = isNeg ? (hasDollar ? "-$" : "-") : (hasDollar ? "$" : "");
  const absNum = Math.abs(num);

  if (absNum >= 1_000_000_000) {
    return `${prefix}${(absNum / 1_000_000_000).toFixed(1)}B`;
  }
  if (absNum >= 1_000_000) {
    return `${prefix}${(absNum / 1_000_000).toFixed(1)}M`;
  }
  if (absNum >= 100_000) {
    return `${prefix}${(absNum / 1_000).toFixed(0)}K`;
  }
  return str;
}
