"use client";

import { useState } from "react";
import type { StationData, FilterState } from "@/lib/types";
import { AREA_ORDER, PREFECTURE_ORDER } from "@/lib/constants";
import {
  getFilteredStats,
  getPriceColor,
  getPriceRange,
  getDisplayValue,
  formatDisplayValue,
} from "@/lib/utils";

interface Props {
  stations: StationData[];
  filter: FilterState;
  selectedPrefecture: string | null;
  onStationClick?: (station: StationData) => void;
  favorites?: Set<string>;
  onFindSimilar?: () => void;
}

interface StationRow {
  station: StationData;
  displayPrice: number;
  count: number;
  overBudget: boolean;
}

function buildRows(
  stations: StationData[],
  filter: FilterState
): StationRow[] {
  return stations
    .map((s) => {
      const stats = getFilteredStats(s, filter);
      if (!stats) return null;
      const displayPrice = getDisplayValue(stats.medianPrice70, filter);
      return {
        station: s,
        displayPrice,
        count: stats.count,
        overBudget: filter.displayMode === "total" && filter.budgetMax !== null && displayPrice > filter.budgetMax,
      };
    })
    .filter((x): x is StationRow => x !== null);
}

function StationItem({
  row,
  onClick,
  displayMode = "total",
}: {
  row: StationRow;
  onClick?: (s: StationData) => void;
  displayMode?: "total" | "sqm";
}) {
  return (
    <div
      className={`flex items-center justify-between text-sm ${
        onClick ? "cursor-pointer hover:bg-gray-50 rounded px-1 -mx-1" : ""
      } ${row.overBudget ? "opacity-40" : ""}`}
      onClick={() => onClick?.(row.station)}
    >
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: getPriceColor(row.displayPrice, displayMode) }}
        />
        <span className="text-gray-700">{row.station.stationName}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-medium tabular-nums">{formatDisplayValue(row.displayPrice, displayMode)}</span>
        <span className="text-xs text-gray-400 tabular-nums w-8 text-right">{row.count}件</span>
      </div>
    </div>
  );
}

/** 選択都道府県のエリア別リスト */
function PrefectureAreaList({
  stations,
  filter,
  prefecture,
  budgetOnly,
  onStationClick,
}: {
  stations: StationData[];
  filter: FilterState;
  prefecture: string;
  budgetOnly: boolean;
  onStationClick?: (s: StationData) => void;
}) {
  const inPref = stations.filter((s) => s.prefecture === prefecture);
  const rows = buildRows(inPref, filter).filter((r) => !budgetOnly || !r.overBudget);

  // エリアグループ: 埼玉は AREA_ORDER 順、その他は件数降順で動的生成
  let areaOrder: string[];
  if (prefecture === "埼玉県") {
    areaOrder = [...AREA_ORDER];
  } else {
    const areaCounts: Record<string, number> = {};
    for (const r of rows) {
      const a = r.station.area;
      areaCounts[a] = (areaCounts[a] ?? 0) + r.count;
    }
    areaOrder = Object.entries(areaCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([area]) => area);
  }

  const grouped: Record<string, StationRow[]> = {};
  for (const r of rows) {
    if (!grouped[r.station.area]) grouped[r.station.area] = [];
    grouped[r.station.area].push(r);
  }
  for (const key in grouped) {
    grouped[key].sort((a, b) => b.displayPrice - a.displayPrice);
  }

  const visibleAreas = areaOrder.filter((a) => grouped[a]?.length);
  if (visibleAreas.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-sm text-gray-400">
        表示できるデータがありません
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0">
      {visibleAreas.map((area) => (
        <div key={area} className="border-b border-r border-gray-100 px-4 py-3">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            {area}
          </h3>
          <div className="space-y-1">
            {grouped[area].map((r) => (
              <StationItem key={r.station.stationCode} row={r} onClick={onStationClick} displayMode={filter.displayMode} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** 全関東ビュー: 都道府県別サマリ */
function AllKantoList({
  stations,
  filter,
  budgetOnly,
  onStationClick,
}: {
  stations: StationData[];
  filter: FilterState;
  budgetOnly: boolean;
  onStationClick?: (s: StationData) => void;
}) {
  const rows = buildRows(stations, filter).filter((r) => !budgetOnly || !r.overBudget);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-0">
      {PREFECTURE_ORDER.map((pref) => {
        const prefRows = rows
          .filter((r) => r.station.prefecture === pref)
          .sort((a, b) => b.displayPrice - a.displayPrice)
          .slice(0, 8);
        if (prefRows.length === 0) return null;
        return (
          <div key={pref} className="border-b border-r border-gray-100 px-4 py-3">
            <h3 className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-2">
              {pref}
            </h3>
            <div className="space-y-1">
              {prefRows.map((r) => (
                <StationItem key={r.station.stationCode} row={r} onClick={onStationClick} displayMode={filter.displayMode} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AreaList({ stations, filter, selectedPrefecture, onStationClick, favorites, onFindSimilar }: Props) {
  const [budgetOnly, setBudgetOnly] = useState(false);

  const prefLabel = selectedPrefecture ?? "全関東";

  // お気に入り駅のリスト
  const favoriteStations = favorites && favorites.size > 0
    ? stations.filter((s) => favorites.has(s.stationCode))
    : [];
  const favoriteRows = buildRows(favoriteStations, filter);

  return (
    <div className="bg-white border-t border-gray-200">

      {/* ⭐ お気に入りセクション */}
      {favoriteRows.length > 0 && (
        <div className="px-4 py-3 border-b border-yellow-100 bg-yellow-50">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-yellow-700">⭐ お気に入りのエリア</h3>
            {favoriteRows.length >= 2 && onFindSimilar && (
              <button
                onClick={onFindSimilar}
                className="text-xs text-blue-500 hover:text-blue-700 transition-colors font-medium"
              >
                似たエリアを探す →
              </button>
            )}
          </div>
          <div className="space-y-1">
            {favoriteRows.map((r) => (
              <StationItem key={r.station.stationCode} row={r} onClick={onStationClick} displayMode={filter.displayMode} />
            ))}
          </div>
        </div>
      )}

      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">
          {prefLabel} — エリア別駅一覧（{filter.displayMode === "sqm" ? "㎡単価 中央値" : `${filter.targetArea}㎡換算 中央値`}）
        </h2>
        {filter.budgetMax !== null && (
          <button
            onClick={() => setBudgetOnly((v) => !v)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              budgetOnly
                ? "bg-green-500 text-white border-green-500"
                : "bg-white text-green-600 border-green-300 hover:bg-green-50"
            }`}
          >
            {budgetOnly ? "✓ 予算内のみ" : "予算内のみ表示"}
          </button>
        )}
      </div>

      {selectedPrefecture ? (
        <PrefectureAreaList
          stations={stations}
          filter={filter}
          prefecture={selectedPrefecture}
          budgetOnly={budgetOnly}
          onStationClick={onStationClick}
        />
      ) : (
        <AllKantoList
          stations={stations}
          filter={filter}
          budgetOnly={budgetOnly}
          onStationClick={onStationClick}
        />
      )}
    </div>
  );
}
