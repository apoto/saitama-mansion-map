export type AgeCategory = "all" | "age_0_10" | "age_11_20" | "age_21_30" | "age_31_plus";

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
  ageCategory: AgeCategory;
  visiblePriceRanges: Set<PriceRange>;
}
