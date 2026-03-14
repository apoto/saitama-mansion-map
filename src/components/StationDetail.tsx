"use client";

import { useEffect, useState, useCallback } from "react";
import type { StationData, FilterState, Transaction } from "@/lib/types";
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

type SortKey = "price" | "area" | "age" | "period";

function getAgeCatKey(age: number | null): string {
  if (age === null) return "";
  if (age <= 10) return "age_0_10";
  if (age <= 20) return "age_11_20";
  if (age <= 30) return "age_21_30";
  return "age_31_plus";
}

export default function StationDetail({ station, filter, onClose }: Props) {
  const [visible, setVisible] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("period");
  const [sortAsc, setSortAsc] = useState(false);

  // ドロワー表示アニメーション
  useEffect(() => {
    if (station) {
      setVisible(true);
      setTransactions([]);
      setSortKey("period");
      setSortAsc(false);
    } else {
      setVisible(false);
    }
  }, [station]);

  // 取引JSON遅延読み込み（T-123）
  useEffect(() => {
    if (!station) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/transactions/${station.stationCode}.json`)
      .then((r) => r.json())
      .then((data: Transaction[]) => {
        if (!cancelled) setTransactions(data);
      })
      .catch(() => {
        if (!cancelled) setTransactions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [station]);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 200);
  }, [onClose]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      setSortAsc(key === "period" ? false : true);
    }
  };

  if (!station) return null;

  const yearData = station.years[filter.year];
  const allStats = yearData?.all;
  const { targetArea, ageCategories } = filter;

  // ソート済み取引一覧
  const sorted = [...transactions].sort((a, b) => {
    let diff = 0;
    if (sortKey === "price") diff = a.price - b.price;
    else if (sortKey === "area") diff = a.area - b.area;
    else if (sortKey === "age") diff = (a.age ?? 999) - (b.age ?? 999);
    else diff = a.period.localeCompare(b.period);
    return sortAsc ? diff : -diff;
  });

  // フィルタ連動ハイライト（T-124）：選択中の築年数カテゴリに合致する行
  const isHighlighted = (tx: Transaction) => {
    if (ageCategories.size === 0) return true;
    const cat = getAgeCatKey(tx.age);
    return cat !== "" && ageCategories.has(cat as Parameters<typeof ageCategories.has>[0]);
  };

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      onClick={() => toggleSort(k)}
      className="flex items-center gap-0.5 text-xs font-medium text-gray-500 hover:text-gray-800"
    >
      {label}
      <span className="text-gray-300">
        {sortKey === k ? (sortAsc ? "↑" : "↓") : "↕"}
      </span>
    </button>
  );

  return (
    <>
      {/* オーバーレイ */}
      <div
        className={`fixed inset-0 bg-black/20 z-[1000] transition-opacity duration-200 ${
          visible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={handleClose}
      />

      {/* ドロワー */}
      <div
        className={`fixed top-0 right-0 h-full w-96 bg-white shadow-xl z-[1001] flex flex-col transition-transform duration-200 ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* ヘッダー */}
        <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-gray-100 flex-shrink-0">
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
          {/* ① AI傾向分析（Phase 3 プレースホルダー） */}
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-gray-700">AI傾向分析</h3>
              <button
                disabled
                className="text-xs bg-gray-200 text-gray-400 px-2.5 py-1 rounded-md cursor-not-allowed"
              >
                生成（Phase 3）
              </button>
            </div>
            <p className="text-xs text-gray-400 italic">
              AIによるエリア傾向分析はPhase 3で実装予定。
            </p>
          </div>

          {/* ② 数値サマリ */}
          {yearData && allStats && allStats.count > 0 ? (
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                {filter.year}年 取引サマリ
              </h3>
              <div className="space-y-1.5">
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
              <div className="mt-3 pt-2 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-1.5">築年数別内訳</p>
                <div className="space-y-1">
                  {(["age_0_10", "age_11_20", "age_21_30", "age_31_plus"] as const).map((key) => {
                    const s = yearData[key];
                    if (!s || s.count === 0) return null;
                    const isActive = ageCategories.size === 0 || ageCategories.has(key);
                    return (
                      <div
                        key={key}
                        className={`flex justify-between text-xs ${isActive ? "text-gray-700" : "text-gray-300"}`}
                      >
                        <span>{AGE_LABELS[key]}</span>
                        <span className="tabular-nums">
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

          {/* ③ 取引一覧（T-123/124） */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">
                取引一覧
                {transactions.length > 0 && (
                  <span className="ml-1.5 text-xs font-normal text-gray-400">
                    {transactions.length}件
                  </span>
                )}
              </h3>
              {ageCategories.size > 0 && transactions.length > 0 && (
                <span className="text-xs text-blue-500">
                  選択築年数をハイライト
                </span>
              )}
            </div>

            {loading ? (
              <div className="text-xs text-gray-400 py-4 text-center">読み込み中...</div>
            ) : transactions.length === 0 ? (
              <div className="text-xs text-gray-400 py-4 text-center">取引データがありません。</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="pb-1.5 text-left">
                        <SortBtn k="price" label="価格" />
                      </th>
                      <th className="pb-1.5 text-left">
                        <SortBtn k="area" label="面積" />
                      </th>
                      <th className="pb-1.5 text-left">
                        <SortBtn k="age" label="築年" />
                      </th>
                      <th className="pb-1.5 text-left">間取り</th>
                      <th className="pb-1.5 text-left">
                        <SortBtn k="period" label="時期" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((tx, i) => {
                      const highlighted = isHighlighted(tx);
                      return (
                        <tr
                          key={i}
                          className={`border-b border-gray-50 ${
                            highlighted ? "" : "opacity-30"
                          }`}
                        >
                          <td className="py-1 font-medium tabular-nums pr-2">
                            {formatPrice(tx.price)}
                          </td>
                          <td className="py-1 tabular-nums pr-2">{tx.area}㎡</td>
                          <td className="py-1 tabular-nums pr-2">
                            {tx.age !== null ? `${tx.age}年` : "—"}
                          </td>
                          <td className="py-1 pr-2">{tx.floorPlan || "—"}</td>
                          <td className="py-1 text-gray-400">
                            {tx.period.replace("年第", "年Q").replace("四半期", "")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
