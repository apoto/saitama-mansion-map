"use client";

import { useState, useEffect } from "react";
import type { StationData } from "@/lib/types";
import type { CrossPrefResponse, CrossPrefStation } from "@/app/api/cross-prefecture/route";
import { PREFECTURE_ORDER, PREFECTURE_VIEWS } from "@/lib/constants";
import { formatPrice } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  /** 選択都道府県（初期値）*/
  defaultPrefecture: string | null;
  /** 予算上限（初期値） */
  defaultBudget: number | null;
  /** 面積（初期値） */
  defaultArea?: number;
  onSelectStation?: (station: StationData) => void;
  stations: StationData[];
}

function StationBadge({
  s,
  budget,
  onSelect,
}: {
  s: CrossPrefStation;
  budget: number;
  onSelect?: (s: CrossPrefStation) => void;
}) {
  const pct = Math.round((s.medianPrice / budget) * 100);
  return (
    <button
      onClick={() => onSelect?.(s)}
      className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-gray-800 truncate">{s.stationName}</span>
          <span className="text-xs text-gray-400 truncate">{s.area}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-400 rounded-full"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs font-mono text-indigo-600 tabular-nums flex-shrink-0">
            {formatPrice(s.medianPrice)}
          </span>
        </div>
      </div>
    </button>
  );
}

export default function CrossPrefPanel({
  open,
  onClose,
  defaultPrefecture,
  defaultBudget,
  defaultArea,
  onSelectStation,
  stations,
}: Props) {
  const [pref, setPref] = useState(defaultPrefecture ?? "埼玉県");
  const [budget, setBudget] = useState(defaultBudget ?? 4000);
  const [area, setArea] = useState(defaultArea ?? 70);
  const [loading, setLoading] = useState(false);

  // パネルを開くたびに最新の絞り込み条件を反映
  useEffect(() => {
    if (open) {
      setPref(defaultPrefecture ?? "埼玉県");
      if (defaultBudget !== null) setBudget(defaultBudget);
      if (defaultArea !== undefined) setArea(defaultArea);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const [result, setResult] = useState<(CrossPrefResponse & {
    baseStations: CrossPrefStation[];
    baseStationCount: number;
    baseMedian: number;
  }) | null>(null);
  const [error, setError] = useState("");

  if (!open) return null;

  async function handleSearch() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/cross-prefecture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ basePrefecture: pref, budget, targetArea: area }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error ?? "エラーが発生しました");
      }
      setResult(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "通信エラー");
    } finally {
      setLoading(false);
    }
  }

  function handleSelectStation(s: CrossPrefStation) {
    const found = stations.find((st) => st.stationCode === s.stationCode);
    if (found) {
      onSelectStation?.(found);
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white w-full sm:w-[600px] max-h-[90vh] rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-800">他県比較</h2>
            <p className="text-xs text-gray-400">予算内で住める駅を都道府県横断で比較</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Controls */}
        <div className="px-5 py-4 border-b border-gray-100 space-y-3">
          <div className="flex gap-3 flex-wrap">
            {/* 基準都道府県 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">基準都道府県</label>
              <select
                value={pref}
                onChange={(e) => setPref(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                {PREFECTURE_ORDER.map((p) => (
                  <option key={p} value={p}>{PREFECTURE_VIEWS[p]?.label ?? p}</option>
                ))}
              </select>
            </div>

            {/* 予算 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">予算上限</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  min={500}
                  max={30000}
                  step={100}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-24 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
                <span className="text-sm text-gray-500">万円</span>
              </div>
            </div>

            {/* 面積 */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">面積</label>
              <div className="flex items-center gap-1">
                <select
                  value={area}
                  onChange={(e) => setArea(Number(e.target.value))}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  {[30, 40, 50, 60, 70, 80, 90].map((a) => (
                    <option key={a} value={a}>{a}㎡</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleSearch}
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg px-4 py-1.5 text-sm font-medium transition-colors"
              >
                {loading ? "検索中…" : "比較する"}
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="px-5 py-4 text-sm text-red-500">{error}</div>
          )}

          {result && (
            <div className="px-5 py-4 space-y-5">
              {/* Base prefecture summary */}
              <div className="bg-indigo-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-indigo-700 mb-1">
                  {result.basePrefecture}（基準）の状況
                </p>
                <p className="text-sm text-indigo-800">
                  予算{formatPrice(result.budget)}以内の駅: <strong>{result.baseStationCount}駅</strong>
                  {result.baseMedian > 0 && (
                    <> / 中央値 <strong>{formatPrice(result.baseMedian)}</strong></>
                  )}
                </p>
                {result.baseStations.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {result.baseStations.slice(0, 6).map((s) => (
                      <button
                        key={s.stationCode}
                        onClick={() => handleSelectStation(s)}
                        className="text-xs bg-white text-indigo-700 border border-indigo-200 rounded-full px-2 py-0.5 hover:bg-indigo-100 transition-colors"
                      >
                        {s.stationName} {formatPrice(s.medianPrice)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Other prefectures */}
              {result.results.map((prefResult) => (
                <div key={prefResult.prefecture}>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-sm font-bold text-gray-700">
                      {prefResult.prefecture}
                    </h3>
                    <span className="text-xs text-gray-400">
                      {prefResult.stations.length}駅 / 中央値 {formatPrice(prefResult.medianOfMedians)}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {prefResult.stations.slice(0, 8).map((s) => (
                      <StationBadge
                        key={s.stationCode}
                        s={s}
                        budget={result.budget}
                        onSelect={handleSelectStation}
                      />
                    ))}
                    {prefResult.stations.length > 8 && (
                      <p className="text-xs text-gray-400 pl-3">
                        他 {prefResult.stations.length - 8}駅…
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {result.results.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">
                  他県に予算内の駅が見つかりませんでした。
                </p>
              )}
            </div>
          )}

          {!result && !loading && !error && (
            <div className="px-5 py-8 text-center text-sm text-gray-400">
              基準都道府県と予算を設定して「比較する」をタップ
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
