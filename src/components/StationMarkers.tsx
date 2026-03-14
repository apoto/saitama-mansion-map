"use client";

import { CircleMarker, Tooltip } from "react-leaflet";
import type { StationData, FilterState } from "@/lib/types";
import {
  getFilteredStats,
  getPriceColor,
  getPriceRange,
  getMarkerRadius,
  getDisplayPrice,
  formatPrice,
} from "@/lib/utils";

interface Props {
  stations: StationData[];
  filter: FilterState;
  onStationClick?: (station: StationData) => void;
  highlightedStations?: Set<string>;
}

export default function StationMarkers({ stations, filter, onStationClick, highlightedStations }: Props) {
  const hasHighlight = highlightedStations && highlightedStations.size > 0;
  return (
    <>
      {stations.map((station) => {
        const stats = getFilteredStats(station, filter);
        if (!stats) return null;

        const displayPrice = getDisplayPrice(stats.medianPrice70, filter.targetArea);
        if (!filter.visiblePriceRanges.has(getPriceRange(displayPrice))) return null;

        const color = getPriceColor(displayPrice);
        const radius = getMarkerRadius(stats.count);
        const displayAvg = getDisplayPrice(stats.avgPrice70, filter.targetArea);
        const isHighlighted = hasHighlight && highlightedStations!.has(station.stationCode);
        const dimmed = hasHighlight && !isHighlighted;

        return (
          <CircleMarker
            key={station.stationCode}
            center={[station.lat, station.lng]}
            radius={isHighlighted ? radius + 4 : radius}
            pathOptions={{
              fillColor: color,
              color: isHighlighted ? "#1d4ed8" : color,
              weight: isHighlighted ? 3 : 2,
              opacity: dimmed ? 0.2 : 0.9,
              fillOpacity: dimmed ? 0.1 : isHighlighted ? 0.75 : 0.55,
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
                  <span className="text-gray-500">{filter.targetArea}㎡換算（中央値）</span>
                  <span className="font-semibold text-right">
                    {formatPrice(displayPrice)}円
                  </span>
                  <span className="text-gray-500">{filter.targetArea}㎡換算（平均）</span>
                  <span className="text-right">{formatPrice(displayAvg)}円</span>
                  <span className="text-gray-500">取引件数</span>
                  <span className="text-right">{stats.count}件</span>
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
