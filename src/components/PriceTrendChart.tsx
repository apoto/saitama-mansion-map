"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { StationData } from "@/lib/types";
import { buildTrendData } from "@/lib/utils";
import { YEARS } from "@/lib/constants";

interface Props {
  station: StationData;
  allStations: StationData[];
  targetArea: number;
}

type ChartType = "price" | "count";

export default function PriceTrendChart({ station, allStations, targetArea }: Props) {
  const [chartType, setChartType] = useState<ChartType>("price");
  const [selectedLine, setSelectedLine] = useState<string | null>(
    station.lines.length > 0 ? station.lines[0] : null
  );
  const [showAll, setShowAll] = useState(false);

  const displayYears = (showAll ? [...YEARS] : YEARS.filter((y) => parseInt(y) >= 2015)).reverse();

  const trendData = useMemo(
    () => buildTrendData(station, selectedLine, allStations, displayYears),
    [station, selectedLine, allStations, displayYears]
  );

  const chartData = trendData.map((pt) => ({
    year: pt.year,
    station:
      chartType === "price"
        ? pt.stationPrice !== null
          ? Math.round((pt.stationPrice / 70) * targetArea)
          : null
        : pt.stationCount,
    line:
      chartType === "price"
        ? pt.linePrice !== null
          ? Math.round((pt.linePrice / 70) * targetArea)
          : null
        : pt.lineCountPerStation,
  }));

  const hasData = chartData.some((d) => d.station !== null);
  if (!hasData) {
    return (
      <div className="text-xs text-gray-400 text-center py-6">
        グラフ表示に必要なデータがありません。
      </div>
    );
  }

  const lineLegendLabel = selectedLine
    ? chartType === "price"
      ? `${selectedLine}平均`
      : `${selectedLine}駅平均`
    : "";

  return (
    <div className="space-y-3">
      {/* グラフ種別タブ */}
      <div className="flex items-center justify-between">
        <div className="flex rounded-md overflow-hidden border border-gray-200 text-xs">
          {(["price", "count"] as ChartType[]).map((type) => (
            <button
              key={type}
              onClick={() => setChartType(type)}
              className={`px-3 py-1 transition-colors ${
                chartType === type
                  ? "bg-gray-800 text-white"
                  : "bg-white text-gray-500 hover:bg-gray-50"
              }`}
            >
              {type === "price" ? "価格推移" : "取引件数"}
            </button>
          ))}
        </div>

        {/* 路線選択 */}
        {station.lines.length > 0 && (
          <div className="flex gap-1 items-center">
            <span className="text-xs text-gray-400">比較:</span>
            <button
              onClick={() => setSelectedLine(null)}
              className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                selectedLine === null
                  ? "bg-gray-700 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              なし
            </button>
            {station.lines.map((line) => (
              <button
                key={line}
                onClick={() => setSelectedLine(line)}
                className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                  selectedLine === line
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {line}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* グラフ本体 */}
      <ResponsiveContainer width="100%" height={190}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={false}
            interval={showAll ? 3 : 1}
          />
          <YAxis
            tickFormatter={(v) =>
              chartType === "price"
                ? `${Math.round(v / 100)}百`
                : `${v}件`
            }
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={false}
            width={chartType === "price" ? 36 : 40}
          />
          <Tooltip
            formatter={(value, name) => {
              if (typeof value !== "number") return ["-", ""];
              const label =
                name === "station"
                  ? `${station.stationName}駅`
                  : lineLegendLabel;
              const formatted =
                chartType === "price"
                  ? `${value.toLocaleString()}万円`
                  : `${value.toLocaleString()}件`;
              return [formatted, label];
            }}
            labelFormatter={(label) => `${label}年`}
            contentStyle={{
              fontSize: 11,
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            }}
          />
          {selectedLine && (
            <Legend
              formatter={(value) =>
                value === "station" ? `${station.stationName}駅` : lineLegendLabel
              }
              wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
            />
          )}
          <Line
            type="monotone"
            dataKey="station"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls
            name="station"
          />
          {selectedLine && (
            <Line
              type="monotone"
              dataKey="line"
              stroke="#d1d5db"
              strokeWidth={1.5}
              dot={false}
              strokeDasharray="4 2"
              connectNulls
              name="line"
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      {/* 期間切替 */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          {chartType === "count" && selectedLine
            ? `路線比較: ${selectedLine}の駅あたり平均件数`
            : ""}
        </p>
        <button
          onClick={() => setShowAll((v) => !v)}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          {showAll ? "直近10年を表示" : "全期間（2005〜）を表示"}
        </button>
      </div>
    </div>
  );
}
