export type AgeCategoryKey = "age_0_10" | "age_11_20" | "age_21_30" | "age_31_plus";

// データモデルのキー（"all"を含む）
export type AgeCategory = "all" | AgeCategoryKey;

export type PriceRange =
  | "under3000"
  | "3000_5000"
  | "5000_7000"
  | "over7000";

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
  /** 都道府県名（例: "埼玉県", "千葉県"）*/
  prefecture?: string;
  years: Record<string, StationYearData>;
  /** 駅徒歩分数の中央値（万円）。stations.ts 再生成後に有効 */
  medianWalkMinutes?: number;
}

export interface Transaction {
  price: number;         // 取引価格（万円）
  area: number;          // 面積（㎡）
  unitPrice: number;     // ㎡単価（万円）
  buildingYear: number | null;
  age: number | null;    // 築年数
  floorPlan: string;
  structure: string;
  district: string;
  period: string;        // 取引時期（例: "2025年第3四半期"）
  walkMinutes: number | null;
}

export interface FilterState {
  yearFrom: string;
  yearTo: string;
  ageCategories: Set<AgeCategoryKey>;
  targetArea: number;
  visiblePriceRanges: Set<PriceRange>;
  showHazard: boolean;
  /** 予算上限（万円）。null = フィルタなし */
  budgetMax: number | null;
}
