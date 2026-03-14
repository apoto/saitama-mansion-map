"use client";

import { useEffect, useState } from "react";
import type { StationData, FilterState, StationYearData } from "@/lib/types";
import { getDisplayPrice, formatPrice } from "@/lib/utils";

interface Props {
  station: StationData | null;
  filter: FilterState;
  onClose: () => void;
}

const AGE_LABELS: Record<string, string> = {
  age_0_10: "築10年以内",
  age_11_20: "築11〜20年",
  age_21_30: "築21〜30年",
  age_31_plus: "築31年以上",
};

export default function StationDetail({ station, filter, onClose }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (station) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [station]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 200);
  };

  if (!station) return null;

  const yearData: StationYearData | undefined = station.years[filter.year];
  const allStats = yearData?.all;
  const { targetArea } = filter;

  return (
    <>
      {/* オーバーレイ */}
      <div
        className={`fixed inset-0 bg-black/20 z-[1000] transition-opacity duration-200 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
      />

      {/* ドロワー */}
      <div
        className={`fixed top-0 right-0 h-full w-80 bg-white shadow-xl z-[1001] flex flex-col transition-transform duration-200 ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* ヘッダー */}
        <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-800">{station.stationName}駅</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {station.lines.length > 0 ? station.lines.join(" / ") : station.area}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* ① AI傾向分析（将来実装・プレースホルダー） */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">AI傾向分析</h3>
              <button
                disabled
                className="text-xs bg-gray-100 text-gray-400 px-2.5 py-1 rounded-md cursor-not-allowed"
                title="Phase 3で実装予定"
              >
                生成（準備中）
              </button>
            </div>
            <p className="text-xs text-gray-400 italic">
              Phase 3でAIによるエリア傾向分析を追加予定。
            </p>
          </div>

          {/* ② 数値サマリ */}
          {yearData && allStats && allStats.count > 0 ? (
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                {filter.year}年 取引サマリ
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{targetArea}㎡換算（中央値）</span>
                  <span className="font-bold text-gray-800">
                    {formatPrice(getDisplayPrice(allStats.medianPrice70, targetArea))}円
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{targetArea}㎡換算（平均）</span>
                  <span className="text-gray-700">
                    {formatPrice(getDisplayPrice(allStats.avgPrice70, targetArea))}円
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">取引件数</span>
                  <span className="text-gray-700">{allStats.count}件</span>
                </div>
              </div>

              {/* 築年数別内訳 */}
              <div className="mt-3">
                <p className="text-xs font-medium text-gray-500 mb-1.5">築年数別内訳</p>
                <div className="space-y-1">
                  {(["age_0_10", "age_11_20", "age_21_30", "age_31_plus"] as const).map((key) => {
                    const s = yearData[key];
                    if (!s || s.count === 0) return null;
                    return (
                      <div key={key} className="flex justify-between text-xs">
                        <span className="text-gray-500">{AGE_LABELS[key]}</span>
                        <span className="text-gray-700 tabular-nums">
                          {s.count}件 / {formatPrice(getDisplayPrice(s.medianPrice70, targetArea))}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm text-gray-400">{filter.year}年のデータがありません。</p>
            </div>
          )}

          {/* ③ 取引一覧（将来実装・プレースホルダー） */}
          <div className="px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">取引一覧</h3>
            <p className="text-xs text-gray-400 italic">
              Phase 2C（取引詳細JSON生成）完了後に表示予定。
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
