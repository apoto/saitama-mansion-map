"use client";

import { useEffect, useState, useCallback, lazy, Suspense } from "react";
import type { StationData, FilterState, Transaction } from "@/lib/types";
import { getDisplayPrice, getDisplayValue, formatDisplayValue, formatPrice, getRangeAgeStat, formatPeriod } from "@/lib/utils";
import type { SimilarResponse } from "@/app/api/similar/route";

const PriceTrendChart = lazy(() => import("./PriceTrendChart"));

const SIMILAR_CACHE_TTL = 24 * 60 * 60 * 1000;
function getSimilarCached(key: string): SimilarResponse | null {
  try {
    const raw = localStorage.getItem(`similar_${key}`);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    return Date.now() - ts < SIMILAR_CACHE_TTL ? data : null;
  } catch { return null; }
}
function setSimilarCached(key: string, data: SimilarResponse) {
  try { localStorage.setItem(`similar_${key}`, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

interface Props {
  station: StationData | null;
  filter: FilterState;
  onClose: () => void;
  allStations: StationData[];
  onSelectStation: (station: StationData) => void;
  isFavorite?: boolean;
  onFavoriteToggle?: (stationCode: string) => void;
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

export default function StationDetail({ station, filter, onClose, allStations, onSelectStation, isFavorite, onFavoriteToggle }: Props) {
  const [visible, setVisible] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("period");
  const [sortAsc, setSortAsc] = useState(false);

  // 憧れエリア類似提案
  const [similarResult, setSimilarResult] = useState<SimilarResponse | null>(null);
  const [similarLoading, setSimilarLoading] = useState(false);

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
      setSimilarResult(null);
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

      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "リクエストが多すぎます。しばらくお待ちください。");
      }
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

  const handleSimilar = useCallback(async () => {
    if (!station || !filter.budgetMax) return;
    const cacheKey = `${station.stationCode}_${filter.budgetMax}_${filter.targetArea}`;
    const cached = getSimilarCached(cacheKey);
    if (cached) { setSimilarResult(cached); return; }

    setSimilarLoading(true);
    try {
      const res = await fetch("/api/similar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stationCode: station.stationCode, budgetMax: filter.budgetMax, targetArea: filter.targetArea }),
      });
      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "リクエストが多すぎます。しばらくお待ちください。");
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: SimilarResponse = await res.json();
      setSimilarResult(data);
      setSimilarCached(cacheKey, data);
    } catch (err) {
      // エラーを簡易表示するため空のresultにメッセージを入れる
      setSimilarResult({
        aspirational: { stationName: station.stationName, medianPrice: 0 },
        stations: [],
        summary: err instanceof Error ? err.message : "エラーが発生しました。",
      });
    }
    finally { setSimilarLoading(false); }
  }, [station, filter.budgetMax, filter.targetArea]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(key === "period" ? false : true); }
  };

  if (!station) return null;

  const { targetArea, ageCategories, yearFrom, yearTo, budgetMax, displayMode } = filter;
  const yearLabel = yearFrom === yearTo ? `${yearTo}年` : `${yearFrom}〜${yearTo}年`;
  const allStats = getRangeAgeStat(station, "all", filter);
  const displayPriceNow = allStats ? getDisplayValue(allStats.medianPrice70, filter) : null;
  const isOverBudget = displayMode === "total" && budgetMax !== null && displayPriceNow !== null && displayPriceNow > budgetMax;
  const priceLabel = displayMode === "sqm" ? "㎡単価" : `${targetArea}㎡換算`;

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
        className={`fixed top-0 right-0 h-full w-full sm:w-96 bg-white shadow-xl z-[1001] flex flex-col transition-transform duration-200 ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* ヘッダー */}
        <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-gray-100 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-800">{station.stationName}駅</h2>
              {isOverBudget && (
                <span className="text-xs bg-red-50 text-red-500 border border-red-200 rounded-full px-2 py-0.5">
                  予算超過
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {station.lines.length > 0 ? station.lines.join(" / ") : station.area}
            </p>
            <a
              href={`/station/${station.stationCode}?area=${targetArea}&mode=${displayMode}${budgetMax ? `&budget=${budgetMax}` : ""}`}
              className="text-xs text-blue-500 hover:underline mt-0.5 inline-block"
            >
              詳細ページで見る →
            </a>
          </div>
          <div className="flex items-center gap-1">
            {onFavoriteToggle && (
              <button
                onClick={() => onFavoriteToggle(station.stationCode)}
                title={isFavorite ? "お気に入りから外す" : "お気に入りに追加"}
                className={`p-1.5 rounded transition-colors ${
                  isFavorite ? "text-yellow-400 hover:text-yellow-500" : "text-gray-300 hover:text-yellow-400"
                }`}
              >
                <svg className="w-5 h-5" fill={isFavorite ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                </svg>
              </button>
            )}
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 p-1 rounded">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
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
                  <span className="text-gray-500">{priceLabel}（中央値）</span>
                  <span className="font-bold text-gray-800">
                    {formatDisplayValue(getDisplayValue(allStats.medianPrice70, filter), displayMode)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{priceLabel}（平均）</span>
                  <span className="text-gray-700">
                    {formatDisplayValue(getDisplayValue(allStats.avgPrice70, filter), displayMode)}
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
                          {s.count}件 / {formatDisplayValue(getDisplayValue(s.medianPrice70, filter), displayMode)}
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

          {/* ③ 憧れエリア類似提案（予算超過時のみ） */}
          {isOverBudget && (
            <div className="px-4 py-3 border-b border-red-50 bg-red-50/40">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-base">💡</span>
                <h3 className="text-sm font-semibold text-gray-700">
                  {station.stationName}が気になるあなたへ
                </h3>
              </div>
              <p className="text-xs text-gray-500 mb-2.5">
                予算{budgetMax!.toLocaleString()}万円内で、似た特徴のエリアを探します。
              </p>
              {!similarResult && (
                <button
                  onClick={handleSimilar}
                  disabled={similarLoading}
                  className="w-full py-2 text-xs bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  {similarLoading ? "検索中..." : "予算内の類似エリアを探す →"}
                </button>
              )}
              {similarResult && (
                <div className="space-y-2">
                  {similarResult.summary && (
                    <p className="text-xs text-gray-600 bg-white rounded-lg px-3 py-2">
                      {similarResult.summary}
                    </p>
                  )}
                  {similarResult.stations.map((s, i) => {
                    const st = allStations.find((x) => x.stationCode === s.stationCode);
                    return (
                      <div key={s.stationCode} className="bg-white rounded-lg p-2.5 space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-red-400">{i + 1}</span>
                            <span className="text-sm font-bold text-gray-800">{s.stationName}駅</span>
                            <span className="text-xs text-gray-400">{s.area}</span>
                          </div>
                          <span className="text-sm font-bold text-gray-800">{s.medianPrice.toLocaleString()}万円</span>
                        </div>
                        {s.reason && <p className="text-xs text-gray-500">{s.reason}</p>}
                        {st && (
                          <button
                            onClick={() => { onSelectStation(st); }}
                            className="text-xs text-blue-500 hover:underline"
                          >
                            詳細を見る →
                          </button>
                        )}
                      </div>
                    );
                  })}
                  <button
                    onClick={() => setSimilarResult(null)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    再検索
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ④ 価格推移グラフ */}
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
            <div className="flex items-center justify-between mb-1">
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
            <p className="text-xs text-gray-400 mb-2">国土交通省の実成約データです。業者の提示価格と比べてみてください。</p>

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
                          {formatPeriod(tx.period)}
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
