import type { StationData, FilterState, PriceRange, AgeCategoryKey, AgeCategory, PriceStats } from "./types";
import { PRICE_RANGES, PRICE_RANGES_SQM, YEARS } from "./constants";

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

/** filter の yearFrom〜yearTo に含まれる年度を返す */
export function getYearsInRange(filter: FilterState): string[] {
  const from = parseInt(filter.yearFrom);
  const to = parseInt(filter.yearTo);
  return YEARS.filter((y) => {
    const yi = parseInt(y);
    return yi >= from && yi <= to;
  });
}

/** 複数の PriceStats を件数加重平均でマージ */
function mergeStatsList(statsList: PriceStats[]): PriceStats | null {
  const valid = statsList.filter((s) => s.count > 0);
  if (valid.length === 0) return null;
  const totalCount = valid.reduce((sum, s) => sum + s.count, 0);
  return {
    count: totalCount,
    avgPrice70: Math.round(valid.reduce((sum, s) => sum + s.avgPrice70 * s.count, 0) / totalCount),
    medianPrice70: Math.round(valid.reduce((sum, s) => sum + s.medianPrice70 * s.count, 0) / totalCount),
  };
}

export function getFilteredStats(station: StationData, filter: FilterState): PriceStats | null {
  const years = getYearsInRange(filter);

  const perYear: PriceStats[] = years.flatMap((year) => {
    const yearData = station.years[year];
    if (!yearData) return [];
    if (filter.ageCategories.size === 0) {
      return yearData.all.count > 0 ? [yearData.all] : [];
    }
    const merged = mergeStats([...filter.ageCategories], yearData);
    return merged ? [merged] : [];
  });

  return mergeStatsList(perYear);
}

/**
 * 特定の築年数カテゴリ（または"all"）の範囲集計を返す。
 * StationDetail の年度サマリ・築年数別内訳に使用。
 */
export function getRangeAgeStat(
  station: StationData,
  ageCat: AgeCategory,
  filter: FilterState
): PriceStats | null {
  const years = getYearsInRange(filter);
  const statsList: PriceStats[] = years.flatMap((year) => {
    const s = station.years[year]?.[ageCat];
    return s && s.count > 0 ? [s] : [];
  });
  return mergeStatsList(statsList);
}

/** 70㎡ベースの価格を targetArea 換算に変換（総額モード用） */
export function getDisplayPrice(price70: number, targetArea: number): number {
  return Math.round((price70 / 70) * targetArea);
}

/** FilterState の displayMode に応じた表示値を返す */
export function getDisplayValue(price70: number, filter: FilterState): number {
  if (filter.displayMode === "sqm") return Math.round(price70 / 70);
  return Math.round((price70 / 70) * filter.targetArea);
}

/** displayMode に応じた価格フォーマット文字列を返す */
export function formatDisplayValue(value: number, displayMode: "total" | "sqm"): string {
  if (displayMode === "sqm") return `${value.toLocaleString()}万円/㎡`;
  if (value >= 10000) return `${(value / 10000).toFixed(1)}億円`;
  return `${value.toLocaleString()}万円`;
}

export function getPriceRange(displayPrice: number, displayMode: "total" | "sqm" = "total"): PriceRange {
  const ranges = displayMode === "sqm" ? PRICE_RANGES_SQM : PRICE_RANGES;
  for (const range of ranges) {
    if (displayPrice < range.max) return range.key;
  }
  return "over7000";
}

export function getPriceColor(displayPrice: number, displayMode: "total" | "sqm" = "total"): string {
  const ranges = displayMode === "sqm" ? PRICE_RANGES_SQM : PRICE_RANGES;
  const range = ranges.find((r) => r.key === getPriceRange(displayPrice, displayMode));
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
  /** この駅の70㎡換算中央値（万円） */
  stationPrice: number | null;
  /** 路線平均の70㎡換算中央値（万円） */
  linePrice: number | null;
  /** この駅の取引件数 */
  stationCount: number | null;
  /** 路線内の駅あたり平均取引件数 */
  lineCountPerStation: number | null;
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
    const yd = station.years[year];
    const stationPrice = yd && yd.all.count > 0 ? yd.all.medianPrice70 : null;
    const stationCount = yd && yd.all.count > 0 ? yd.all.count : null;

    let linePrice: number | null = null;
    let lineCountPerStation: number | null = null;
    if (lineStations.length > 0) {
      const valid = lineStations
        .map((s) => s.years[year]?.all)
        .filter((s): s is NonNullable<typeof s> => !!s && s.count > 0);
      if (valid.length > 0) {
        const totalCount = valid.reduce((sum, s) => sum + s.count, 0);
        linePrice = Math.round(
          valid.reduce((sum, s) => sum + s.medianPrice70 * s.count, 0) / totalCount
        );
        lineCountPerStation = Math.round(totalCount / valid.length);
      }
    }

    return { year, stationPrice, linePrice, stationCount, lineCountPerStation };
  });
}


/** "2024年第3四半期" → "2024年7〜9月" */
export function formatPeriod(period: string): string {
  return period
    .replace("第1四半期", "1〜3月")
    .replace("第2四半期", "4〜6月")
    .replace("第3四半期", "7〜9月")
    .replace("第4四半期", "10〜12月");
}
