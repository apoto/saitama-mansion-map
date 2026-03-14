export type AgeCategoryKey = "age_0_10" | "age_11_20" | "age_21_30" | "age_31_plus";

// データモデルのキー（"all"を含む）
export type AgeCategory = "all" | AgeCategoryKey;

export type PriceRange =
  | "under2000"
  | "2000_3000"
  | "3000_4000"
  | "4000_5000"
  | "over5000";

export interface PriceStats {
  count: number;
  avgPrice70: number;
  medianPrice70: number;
}

export interface StationYearData {
  all: PriceStats;
  age_0_10: PriceStats;
  age_11_20: PriceStats;
  age_21_30: PriceStats;
  age_31_plus: PriceStats;
}

export interface StationData {
  stationCode: string;
  stationName: string;
  lat: number;
  lng: number;
  lines: string[];
  area: string;
  years: Record<string, StationYearData>;
}

export interface FilterState {
  year: string;
  /** 空Set = すべての築年数を表示 */
  ageCategories: Set<AgeCategoryKey>;
  /** 表示基準面積 (㎡)。デフォルト70 */
  targetArea: number;
  visiblePriceRanges: Set<PriceRange>;
}
