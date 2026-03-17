import type { PriceRange, AgeCategoryKey } from "./types";

export const SAITAMA_CENTER = { lat: 35.87, lng: 139.62 } as const;
export const DEFAULT_ZOOM = 11;

export const KANTO_CENTER = { lat: 35.75, lng: 139.65 } as const;
export const KANTO_ZOOM = 9;

export const PREFECTURE_VIEWS: Record<string, { lat: number; lng: number; zoom: number; label: string }> = {
  "埼玉県": { lat: 35.87, lng: 139.62, zoom: 11, label: "埼玉" },
  "東京都": { lat: 35.69, lng: 139.69, zoom: 11, label: "東京" },
  "神奈川県": { lat: 35.44, lng: 139.47, zoom: 10, label: "神奈川" },
  "千葉県": { lat: 35.65, lng: 140.12, zoom: 10, label: "千葉" },
  "茨城県": { lat: 36.20, lng: 140.10, zoom: 10, label: "茨城" },
  "栃木県": { lat: 36.57, lng: 139.88, zoom: 10, label: "栃木" },
  "群馬県": { lat: 36.39, lng: 139.06, zoom: 10, label: "群馬" },
};

export const PREFECTURE_ORDER = [
  "埼玉県", "東京都", "神奈川県", "千葉県", "茨城県", "栃木県", "群馬県",
] as const;

export const YEARS = [
  "2025", "2024", "2023", "2022", "2021", "2020",
  "2019", "2018", "2017", "2016", "2015", "2014",
  "2013", "2012", "2011", "2010", "2009", "2008",
  "2007", "2006", "2005",
] as const;

export const AGE_CATEGORY_OPTIONS: { value: AgeCategoryKey; label: string }[] = [
  { value: "age_0_10", label: "築10年以内" },
  { value: "age_11_20", label: "築11〜20年" },
  { value: "age_21_30", label: "築21〜30年" },
  { value: "age_31_plus", label: "築31年以上" },
];

export const TARGET_AREAS = [30, 40, 50, 60, 70, 80, 90] as const;

export const PRICE_RANGES: {
  key: PriceRange;
  label: string;
  color: string;
  min: number;
  max: number;
}[] = [
  { key: "under3000",  label: "〜3,000万",       color: "#3B82F6", min: 0,    max: 3000 },
  { key: "3000_5000",  label: "3,000〜5,000万",  color: "#22C55E", min: 3000, max: 5000 },
  { key: "5000_7000",  label: "5,000〜7,000万",  color: "#F97316", min: 5000, max: 7000 },
  { key: "over7000",   label: "7,000万〜",        color: "#EF4444", min: 7000, max: Infinity },
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
  "その他",
] as const;
