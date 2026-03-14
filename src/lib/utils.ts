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

export interface TrendPoint {
  year: string;
  /** この駅の70㎡換算中央値（万円）。データなしは null */
  stationPrice: number | null;
  /** 路線平均の70㎡換算中央値（万円）。データなしは null */
  linePrice: number | null;
}

/**
 * 特定駅の年度別価格推移と、指定路線の平均推移を返す。
 * @param station 対象駅
 * @param lineName 比較する路線名（station.lines[0] など）
 * @param allStations 全駅データ（路線平均計算用）
 * @param years 表示する年度の配列
 */
export function buildTrendData(
  station: StationData,
  lineName: string | null,
  allStations: StationData[],
  years: string[]
): TrendPoint[] {
  // 路線に属する駅を抽出
  const lineStations = lineName
    ? allStations.filter((s) => s.lines.includes(lineName))
    : [];

  return years.map((year) => {
    // この駅の価格
    const yd = station.years[year];
    const stationPrice =
      yd && yd.all.count > 0 ? yd.all.medianPrice70 : null;

    // 路線平均: その年にデータがある駅の加重平均
    let linePrice: number | null = null;
    if (lineStations.length > 0) {
      const valid = lineStations
        .map((s) => s.years[year]?.all)
        .filter((s): s is NonNullable<typeof s> => !!s && s.count > 0);
      if (valid.length > 0) {
        const totalCount = valid.reduce((sum, s) => sum + s.count, 0);
        const weightedSum = valid.reduce((sum, s) => sum + s.medianPrice70 * s.count, 0);
        linePrice = Math.round(weightedSum / totalCount);
      }
    }

    return { year, stationPrice, linePrice };
  });
}
