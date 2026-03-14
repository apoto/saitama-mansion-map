import type { StationData, FilterState, PriceRange } from "./types";
import { PRICE_RANGES } from "./constants";

export function getFilteredStats(station: StationData, filter: FilterState) {
  const yearData = station.years[filter.year];
  if (!yearData) return null;
  const stats = yearData[filter.ageCategory];
  if (!stats || stats.count === 0) return null;
  return stats;
}

export function getPriceRange(price70InManyen: number): PriceRange {
  for (const range of PRICE_RANGES) {
    if (price70InManyen < range.max) return range.key;
  }
  return "over5000";
}

export function getPriceColor(price70InManyen: number): string {
  const range = PRICE_RANGES.find((r) => r.key === getPriceRange(price70InManyen));
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
