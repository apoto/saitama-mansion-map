import type { StationData, FilterState, PriceRange, AgeCategoryKey, PriceStats } from "./types";
import { PRICE_RANGES } from "./constants";

function mergeStats(
  keys: AgeCategoryKey[],
  yearData: import("./types").StationYearData
): PriceStats | null {
  const selected = keys.map((k) => yearData[k]).filter((s) => s && s.count > 0);
  if (selected.length === 0) return null;
  const totalCount = selected.reduce((sum, s) => sum + s!.count, 0);
  if (totalCount === 0) return null;
  const weightedAvg = selected.reduce((sum, s) => sum + s!.avgPrice70 * s!.count, 0) / totalCount;
  const weightedMedian = selected.reduce((sum, s) => sum + s!.medianPrice70 * s!.count, 0) / totalCount;
  return {
    count: totalCount,
    avgPrice70: Math.round(weightedAvg),
    medianPrice70: Math.round(weightedMedian),
  };
}

export function getFilteredStats(station: StationData, filter: FilterState): PriceStats | null {
  const yearData = station.years[filter.year];
  if (!yearData) return null;

  if (filter.ageCategories.size === 0) {
    const s = yearData.all;
    return s && s.count > 0 ? s : null;
  }

  return mergeStats([...filter.ageCategories], yearData);
}

/** 70㎡ベースの価格を targetArea 換算に変換 */
export function getDisplayPrice(price70: number, targetArea: number): number {
  return Math.round((price70 / 70) * targetArea);
}

export function getPriceRange(displayPrice: number): PriceRange {
  for (const range of PRICE_RANGES) {
    if (displayPrice < range.max) return range.key;
  }
  return "over5000";
}

export function getPriceColor(displayPrice: number): string {
  const range = PRICE_RANGES.find((r) => r.key === getPriceRange(displayPrice));
  return range?.color ?? "#6B7280";
}

export function getMarkerRadius(count: number): number {
  const MIN_R = 6;
  const MAX_R = 30;
  const scaled = Math.log(count + 1) / Math.log(100);
  return Math.max(MIN_R, Math.min(MAX_R, MIN_R + scaled * (MAX_R - MIN_R)));
}

export function formatPrice(manyen: number): string {
  if (manyen >= 10000) {
    return `${(manyen / 10000).toFixed(1)}億`;
  }
  return `${Math.round(manyen).toLocaleString()}万`;
}

export function groupStationsByArea(stations: StationData[]): Record<string, StationData[]> {
  const grouped: Record<string, StationData[]> = {};
  for (const s of stations) {
    if (!grouped[s.area]) grouped[s.area] = [];
    grouped[s.area].push(s);
  }
  return grouped;
}
