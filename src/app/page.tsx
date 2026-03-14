"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import FilterPanel from "@/components/FilterPanel";
import AreaList from "@/components/AreaList";
import StationDetail from "@/components/StationDetail";
import SuggestPanel from "@/components/SuggestPanel";
import { stationData } from "@/data/stations";
import type { FilterState, PriceRange, StationData } from "@/lib/types";
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
    ageCategories: new Set(),
    targetArea: 70,
    visiblePriceRanges: ALL_PRICE_RANGES,
    showHazard: false,
  });

  const [selectedStation, setSelectedStation] = useState<StationData | null>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [highlightedStations, setHighlightedStations] = useState<Set<string>>(new Set());

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
            駅別 {filter.targetArea}㎡換算価格 × 取引件数
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="text-xs text-gray-400">
            データ: 国土交通省 不動産取引価格情報
          </div>
          {/* AIコンシェルジュボタン */}
          <button
            onClick={() => setSuggestOpen(true)}
            className="inline-flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-full px-3 py-1 text-xs font-medium transition-colors shadow-sm"
          >
            <span>✨</span>
            <span>AIエリア提案</span>
          </button>
          {/* データ鮮度バッジ (T-051) */}
          <div className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
            <span className="text-xs text-amber-700">2025Q3時点のデータ</span>
          </div>
        </div>
      </header>

      {/* Filters */}
      <FilterPanel filter={filter} onChange={setFilter} />

      {/* Map */}
      <div className="flex-1 min-h-0">
        <MapView
          stations={stations}
          filter={filter}
          onStationClick={setSelectedStation}
          highlightedStations={highlightedStations}
        />
      </div>

      {/* Area station list */}
      <div className="max-h-[35vh] overflow-y-auto">
        <AreaList
          stations={stations}
          filter={filter}
          onStationClick={setSelectedStation}
        />
      </div>

      {/* Station detail drawer */}
      <StationDetail
        station={selectedStation}
        filter={filter}
        onClose={() => setSelectedStation(null)}
        allStations={stations}
      />

      {/* AI Concierge panel */}
      <SuggestPanel
        open={suggestOpen}
        onClose={() => setSuggestOpen(false)}
        onSelectStation={(station) => {
          setSelectedStation(station);
          setSuggestOpen(false);
        }}
        onHighlight={setHighlightedStations}
        stations={stations}
      />
    </div>
  );
}
