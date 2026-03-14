"use client";

import type { StationData, FilterState } from "@/lib/types";
import { AREA_ORDER } from "@/lib/constants";
import {
  getFilteredStats,
  getPriceColor,
  getDisplayPrice,
  formatPrice,
  groupStationsByArea,
} from "@/lib/utils";

interface Props {
  stations: StationData[];
  filter: FilterState;
  onStationClick?: (station: StationData) => void;
}

export default function AreaList({ stations, filter, onStationClick }: Props) {
  const grouped = groupStationsByArea(stations);

  return (
    <div className="bg-white border-t border-gray-200">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700">
          エリア別 駅一覧（{filter.targetArea}㎡換算 中央値）
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0">
        {AREA_ORDER.map((area) => {
          const areaStations = grouped[area];
          if (!areaStations) return null;

          const sorted = [...areaStations]
            .map((s) => {
              const stats = getFilteredStats(s, filter);
              if (!stats) return null;
              return { station: s, stats, displayPrice: getDisplayPrice(stats.medianPrice70, filter.targetArea) };
            })
            .filter((x): x is NonNullable<typeof x> => x !== null)
            .sort((a, b) => b.displayPrice - a.displayPrice);

          if (sorted.length === 0) return null;

          return (
            <div key={area} className="border-b border-r border-gray-100 px-4 py-3">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                {area}
              </h3>
              <div className="space-y-1">
                {sorted.map(({ station, stats, displayPrice }) => (
                  <div
                    key={station.stationCode}
                    className={`flex items-center justify-between text-sm ${
                      onStationClick ? "cursor-pointer hover:bg-gray-50 rounded px-1 -mx-1" : ""
                    }`}
                    onClick={() => onStationClick?.(station)}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: getPriceColor(displayPrice) }}
                      />
                      <span className="text-gray-700">{station.stationName}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium tabular-nums">
                        {formatPrice(displayPrice)}
                      </span>
                      <span className="text-xs text-gray-400 tabular-nums w-8 text-right">
                        {stats.count}件
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
