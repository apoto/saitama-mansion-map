"use client";

import { CircleMarker, Tooltip } from "react-leaflet";
import type { StationData, FilterState } from "@/lib/types";
import {
  getFilteredStats,
  getPriceColor,
  getPriceRange,
  getMarkerRadius,
  getDisplayValue,
  formatDisplayValue,
} from "@/lib/utils";

interface Props {
  stations: StationData[];
  filter: FilterState;
  onStationClick?: (station: StationData) => void;
  highlightedStations?: Set<string>;
  selectedPrefecture: string | null;
}

export default function StationMarkers({ stations, filter, onStationClick, highlightedStations, selectedPrefecture }: Props) {
  const hasHighlight = highlightedStations && highlightedStations.size > 0;

  // 全関東選択時はマーカーを非表示（CrossPrefPanel で比較する設計）
  if (selectedPrefecture === null) return null;

  // 選択された都道府県のみ表示
  const visibleStations = stations.filter((s) => s.prefecture === selectedPrefecture);

  return (
    <>
      {visibleStations.map((station) => {
        const stats = getFilteredStats(station, filter);
        if (!stats) return null;

        // 路線フィルター
        if (filter.lineFilter && !station.lines.includes(filter.lineFilter)) return null;

        // 徒歩分数フィルター（medianWalkMinutes が未設定の駅は通過させる）
        if (
          filter.maxWalkMinutes !== null &&
          station.medianWalkMinutes !== undefined &&
          station.medianWalkMinutes > filter.maxWalkMinutes
        ) return null;

        const displayPrice = getDisplayValue(stats.medianPrice70, filter);
        if (!filter.visiblePriceRanges.has(getPriceRange(displayPrice, filter.displayMode))) return null;

        const color = getPriceColor(displayPrice, filter.displayMode);
        const radius = getMarkerRadius(stats.count);
        const displayAvg = getDisplayValue(stats.avgPrice70, filter);
        const isHighlighted = hasHighlight && highlightedStations!.has(station.stationCode);
        // sqmモードでは予算比較できないためグレーアウト無効
        const overBudget = filter.displayMode === "total" && filter.budgetMax !== null && displayPrice > filter.budgetMax;
        const lowData = stats.count < 10;
        const dimmed = (hasHighlight && !isHighlighted) || overBudget;

        return (
          <CircleMarker
            key={station.stationCode}
            center={[station.lat, station.lng]}
            radius={isHighlighted ? radius + 4 : radius}
            pathOptions={{
              fillColor: overBudget ? "#9ca3af" : color,
              color: isHighlighted ? "#1d4ed8" : overBudget ? "#9ca3af" : color,
              weight: isHighlighted ? 3 : 2,
              opacity: dimmed ? 0.25 : lowData ? 0.4 : 0.9,
              fillOpacity: dimmed ? 0.12 : lowData ? 0.2 : isHighlighted ? 0.75 : 0.55,
            }}
            eventHandlers={
              onStationClick
                ? { click: () => onStationClick(station) }
                : undefined
            }
          >
            <Tooltip direction="top" offset={[0, -radius]} className="station-tooltip">
              <div className="min-w-[200px] p-1">
                <div className="font-bold text-sm mb-1">{station.stationName}駅</div>
                <div className="text-xs text-gray-500 mb-2">
                  {station.lines.join(" / ")}
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <span className="text-gray-500">
                    {filter.displayMode === "sqm" ? "㎡単価" : `${filter.targetArea}㎡換算`}（中央値）
                  </span>
                  <span className="font-semibold text-right">
                    {formatDisplayValue(displayPrice, filter.displayMode)}
                  </span>
                  <span className="text-gray-500">
                    {filter.displayMode === "sqm" ? "㎡単価" : `${filter.targetArea}㎡換算`}（平均）
                  </span>
                  <span className="text-right">{formatDisplayValue(displayAvg, filter.displayMode)}</span>
                  <span className="text-gray-500">取引件数</span>
                  <span className="text-right">
                    {stats.count}件{lowData && <span className="ml-1 text-amber-500 text-xs">参考値</span>}
                  </span>
                  {station.medianWalkMinutes !== undefined && (
                    <>
                      <span className="text-gray-500">駅徒歩（中央値）</span>
                      <span className="text-right">{station.medianWalkMinutes}分</span>
                    </>
                  )}
                </div>
                {onStationClick && (
                  <div className="mt-2 text-xs text-blue-500 text-center">クリックで詳細を表示</div>
                )}
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
}
