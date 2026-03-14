import type { PriceRange } from "./types";

export const SAITAMA_CENTER = { lat: 35.87, lng: 139.62 } as const;
export const DEFAULT_ZOOM = 11;

export const YEARS = ["2025", "2024", "2023", "2022", "2021", "2020"] as const;

export const AGE_CATEGORIES = [
  { value: "all", label: "すべて" },
  { value: "age_0_10", label: "築10年以内" },
  { value: "age_11_20", label: "築11〜20年" },
  { value: "age_21_30", label: "築21〜30年" },
  { value: "age_31_plus", label: "築31年以上" },
] as const;

export const PRICE_RANGES: {
  key: PriceRange;
  label: string;
  color: string;
  min: number;
  max: number;
}[] = [
  { key: "under2000", label: "〜2,000万", color: "#3B82F6", min: 0, max: 2000 },
  { key: "2000_3000", label: "2,000〜3,000万", color: "#22C55E", min: 2000, max: 3000 },
  { key: "3000_4000", label: "3,000〜4,000万", color: "#EAB308", min: 3000, max: 4000 },
  { key: "4000_5000", label: "4,000〜5,000万", color: "#F97316", min: 4000, max: 5000 },
  { key: "over5000", label: "5,000万〜", color: "#EF4444", min: 5000, max: Infinity },
];

export const AREA_ORDER = [
  "さいたま市",
  "川口・蕨・戸田",
  "越谷・草加・三郷",
  "春日部・久喜",
  "所沢・入間・狭山",
  "川越・ふじみ野",
  "朝霞・新座・和光",
  "上尾・桶川・北本",
  "熊谷・深谷・本庄",
] as const;
