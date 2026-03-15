"use client";

import { useEffect, useState, useCallback, lazy, Suspense } from "react";
import type { StationData, FilterState, Transaction } from "@/lib/types";
import { getDisplayPrice, formatPrice, getRangeAgeStat } from "@/lib/utils";

const PriceTrendChart = lazy(() => import("./PriceTrendChart"));

interface Props {
  station: StationData | null;
  filter: FilterState;
  onClose: () => void;
  allStations: StationData[];
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

// ── AIキャッシュ (localStorage, 24h TTL) ────────────────────
const CACHE_TTL = 24 * 60 * 60 * 1000;

function getCachedSummary(stationCode: string): string | null {
  try {
    const raw = localStorage.getItem(`ai_summary_${stationCode}`);
    if (!raw) return null;
    const { text, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) {
      localStorage.removeItem(`ai_summary_${stationCode}`);
      return null;
    }
    return text;
  } catch {
    return null;
  }
}

function setCachedSummary(stationCode: string, text: string) {
  try {
    localStorage.setItem(
      `ai_summary_${stationCode}`,
      JSON.stringify({ text, ts: Date.now() })
    );
  } catch { /* quota超過は無視 */ }
}

// ── レートリミット (1時間あたり10回) ────────────────────────
const RATE_LIMIT = 10;
const RATE_WINDOW = 60 * 60 * 1000;
const RATE_KEY = "ai_summary_rate";

function checkRateLimit(): { allowed: boolean; remaining: number } {
  try {
    const raw = localStorage.getItem(RATE_KEY);
    const { count = 0, windowStart = Date.now() } = raw ? JSON.parse(raw) : {};
    const now = Date.now();
    if (now - windowStart > RATE_WINDOW) {
      localStorage.setItem(RATE_KEY, JSON.stringify({ count: 1, windowStart: now }));
      return { allowed: true, remaining: RATE_LIMIT - 1 };
    }
    if (count >= RATE_LIMIT) return { allowed: false, remaining: 0 };
    localStorage.setItem(RATE_KEY, JSON.stringify({ count: count + 1, windowStart }));
    return { allowed: true, remaining: RATE_LIMIT - count - 1 };
  } catch {
    return { allowed: true, remaining: RATE_LIMIT };
  }
}

// ────────────────────────────────────────────────────────────

export default function StationDetail({ station, filter, onClose, allStations }: Props) {
  const [visible, setVisible] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("period");
  const [sortAsc, setSortAsc] = useState(false);

  // AI状態
  const [aiText, setAiText] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [rateLimitMsg, setRateLimitMsg] = useState<string | null>(null);

  // ドロワー表示 & 状態リセット
  useEffect(() => {
    if (station) {
      setVisible(true);
      setTransactions([]);
      setSortKey("period");
      setSortAsc(false);
      setAiText("");
      setAiError(null);
      setRateLimitMsg(null);
      // キャッシュがあれば即表示
      const cached = getCachedSummary(station.stationCode);
      if (cached) setAiText(cached);
    } else {
      setVisible(false);
    }
  }, [station]);

  // 取引JSON遅延読み込み
  useEffect(() => {
    if (!station) return;
    let cancelled = false;
    setTxLoading(true);
    fetch(`/transactions/${station.stationCode}.json`)
      .then((r) => r.json())
      .then((data: Transaction[]) => { if (!cancelled) setTransactions(data); })
      .catch(() => { if (!cancelled) setTransactions([]); })
      .finally(() => { if (!cancelled) setTxLoading(false); });
    return () => { cancelled = true; };
  }, [station]);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 200);
  }, [onClose]);

  // AI生成
  const handleGenerateAI = useCallback(async () => {
    if (!station) return;

    // キャッシュ確認
    const cached = getCachedSummary(station.stationCode);
    if (cached) { setAiText(cached); return; }

    // レートリミット確認
    const { allowed, remaining } = checkRateLimit();
    if (!allowed) {
      setRateLimitMsg("1時間あたりの生成上限（10回）に達しました。しばらくお待ちください。");
      return;
    }
    if (remaining <= 2) {
      setRateLimitMsg(`残り生成回数: ${remaining}回/時間`);
    } else {
      setRateLimitMsg(null);
    }

    setAiLoading(true);
    setAiText("");
    setAiError(null);

    try {
      const res = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stationName: station.stationName,
          area: station.area,
          lines: station.lines,
          recentYears: station.years,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        full += chunk;
        setAiText(full);
      }

      setCachedSummary(station.stationCode, full);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "生成に失敗しました");
    } finally {
      setAiLoading(false);
    }
  }, [station]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(key === "period" ? false : true); }
  };

  if (!station) return null;

  const { targetArea, ageCategories, yearFrom, yearTo } = filter;
  const yearLabel = yearFrom === yearTo ? `${yearTo}年` : `${yearFrom}〜${yearTo}年`;
  const allStats = getRangeAgeStat(station, "all", filter);

  const sorted = [...transactions].sort((a, b) => {
    let diff = 0;
    if (sortKey === "price") diff = a.price - b.price;
    else if (sortKey === "area") diff = a.area - b.area;
    else if (sortKey === "age") diff = (a.age ?? 999) - (b.age ?? 999);
    else diff = a.period.localeCompare(b.period);
    return sortAsc ? diff : -diff;
  });

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
      <span className="text-gray-300">{sortKey === k ? (sortAsc ? "↑" : "↓") : "↕"}</span>
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
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 p-1 rounded">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* ① AI傾向分析 */}
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">AI傾向分析</h3>
              <button
                onClick={handleGenerateAI}
                disabled={aiLoading}
                className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                  aiLoading
                    ? "bg-gray-100 text-gray-400 cursor-wait"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {aiLoading ? "生成中…" : aiText ? "再生成" : "生成"}
              </button>
            </div>

            {rateLimitMsg && (
              <p className="text-xs text-amber-600 mb-1">{rateLimitMsg}</p>
            )}

            {aiError && (
              <p className="text-xs text-red-500">{aiError}</p>
            )}

            {aiText ? (
              <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                {aiText}
                {aiLoading && <span className="inline-block w-1 h-3 bg-blue-400 animate-pulse ml-0.5 align-middle" />}
              </p>
            ) : !aiLoading && !aiError && (
              <p className="text-xs text-gray-400 italic">
                「生成」を押すとAIがこのエリアの不動産傾向を分析します。
              </p>
            )}
          </div>

          {/* ② 数値サマリ */}
          {allStats && allStats.count > 0 ? (
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                {yearLabel} 取引サマリ
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

              <div className="mt-3 pt-2 border-t border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-1.5">築年数別内訳</p>
                <div className="space-y-1">
                  {(["age_0_10", "age_11_20", "age_21_30", "age_31_plus"] as const).map((key) => {
                    const s = getRangeAgeStat(station, key, filter);
                    if (!s || s.count === 0) return null;
                    const isActive = ageCategories.size === 0 || ageCategories.has(key);
                    return (
                      <div key={key} className={`flex justify-between text-xs ${isActive ? "text-gray-700" : "text-gray-300"}`}>
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
              <p className="text-sm text-gray-400">{yearLabel}のデータがありません。</p>
            </div>
          )}

          {/* ③ 価格推移グラフ */}
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">価格推移グラフ</h3>
            <Suspense fallback={<div className="text-xs text-gray-400 py-4 text-center">グラフを読み込み中...</div>}>
              <PriceTrendChart
                station={station}
                allStations={allStations}
                targetArea={filter.targetArea}
              />
            </Suspense>
          </div>

          {/* ④ 取引一覧 */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">
                取引一覧
                {transactions.length > 0 && (
                  <span className="ml-1.5 text-xs font-normal text-gray-400">{transactions.length}件</span>
                )}
              </h3>
              {ageCategories.size > 0 && transactions.length > 0 && (
                <span className="text-xs text-blue-500">選択築年数をハイライト</span>
              )}
            </div>

            {txLoading ? (
              <div className="text-xs text-gray-400 py-4 text-center">読み込み中...</div>
            ) : transactions.length === 0 ? (
              <div className="text-xs text-gray-400 py-4 text-center">取引データがありません。</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="pb-1.5 text-left"><SortBtn k="price" label="価格" /></th>
                      <th className="pb-1.5 text-left"><SortBtn k="area" label="面積" /></th>
                      <th className="pb-1.5 text-left"><SortBtn k="age" label="築年" /></th>
                      <th className="pb-1.5 text-left">間取り</th>
                      <th className="pb-1.5 text-left"><SortBtn k="period" label="時期" /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((tx, i) => (
                      <tr key={i} className={`border-b border-gray-50 ${isHighlighted(tx) ? "" : "opacity-30"}`}>
                        <td className="py-1 font-medium tabular-nums pr-2">{formatPrice(tx.price)}</td>
                        <td className="py-1 tabular-nums pr-2">{tx.area}㎡</td>
                        <td className="py-1 tabular-nums pr-2">{tx.age !== null ? `${tx.age}年` : "—"}</td>
                        <td className="py-1 pr-2">{tx.floorPlan || "—"}</td>
                        <td className="py-1 text-gray-400">
                          {tx.period.replace("年第", "年Q").replace("四半期", "")}
                        </td>
                      </tr>
                    ))}
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
