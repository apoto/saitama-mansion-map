"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import FilterPanel from "@/components/FilterPanel";
import AreaList from "@/components/AreaList";
import { stationData } from "@/data/stations";
import type { FilterState, PriceRange } from "@/lib/types";
import { PRICE_RANGES } from "@/lib/constants";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-gray-50">
      <div className="text-sm text-gray-400">地図を読み込み中...</div>
    </div>
  ),
});

const ALL_PRICE_RANGES = new Set<PriceRange>(PRICE_RANGES.map((r) => r.key));

export default function Home() {
  const [filter, setFilter] = useState<FilterState>({
    year: "2025",
    ageCategory: "all",
    visiblePriceRanges: ALL_PRICE_RANGES,
  });

  const stations = useMemo(() => stationData, []);

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-gray-800 tracking-tight">
            埼玉県 中古マンション相場マップ
          </h1>
          <p className="text-xs text-gray-400">
            駅別 70㎡換算価格 × 取引件数
          </p>
        </div>
        <div className="text-xs text-gray-300">
          データ: 国土交通省 不動産取引価格情報（2024Q4〜2025Q3）
        </div>
      </header>

      {/* Filters */}
      <FilterPanel filter={filter} onChange={setFilter} />

      {/* Map */}
      <div className="flex-1 min-h-0">
        <MapView stations={stations} filter={filter} />
      </div>

      {/* Area station list */}
      <div className="max-h-[35vh] overflow-y-auto">
        <AreaList stations={stations} filter={filter} />
      </div>
    </div>
  );
}
