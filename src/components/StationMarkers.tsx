"use client";

import { CircleMarker, Tooltip } from "react-leaflet";
import type { StationData, FilterState } from "@/lib/types";
import { getFilteredStats, getPriceColor, getMarkerRadius, formatPrice } from "@/lib/utils";

interface Props {
  stations: StationData[];
  filter: FilterState;
}

export default function StationMarkers({ stations, filter }: Props) {
  return (
    <>
      {stations.map((station) => {
        const stats = getFilteredStats(station, filter);
        if (!stats) return null;

        const priceRange = station.years[filter.year]?.[filter.ageCategory];
        if (!priceRange || priceRange.count === 0) return null;

        const color = getPriceColor(stats.medianPrice70);
        const radius = getMarkerRadius(stats.count);

        const isVisible = filter.visiblePriceRanges.has(
          stats.medianPrice70 < 2000
            ? "under2000"
            : stats.medianPrice70 < 3000
              ? "2000_3000"
              : stats.medianPrice70 < 4000
                ? "3000_4000"
                : stats.medianPrice70 < 5000
                  ? "4000_5000"
                  : "over5000"
        );
        if (!isVisible) return null;

        return (
          <CircleMarker
            key={station.stationCode}
            center={[station.lat, station.lng]}
            radius={radius}
            pathOptions={{
              fillColor: color,
              color: color,
              weight: 2,
              opacity: 0.9,
              fillOpacity: 0.55,
            }}
          >
            <Tooltip
              direction="top"
              offset={[0, -radius]}
              className="station-tooltip"
            >
              <div className="min-w-[200px] p-1">
                <div className="font-bold text-sm mb-1">{station.stationName}駅</div>
                <div className="text-xs text-gray-500 mb-2">
                  {station.lines.join(" / ")}
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <span className="text-gray-500">70㎡換算（中央値）</span>
                  <span className="font-semibold text-right">
                    {formatPrice(stats.medianPrice70)}円
                  </span>
                  <span className="text-gray-500">70㎡換算（平均）</span>
                  <span className="text-right">
                    {formatPrice(stats.avgPrice70)}円
                  </span>
                  <span className="text-gray-500">取引件数</span>
                  <span className="text-right">{stats.count}件</span>
                </div>
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
}
