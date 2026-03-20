"use client";

import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { stationData } from "@/data/stations";
import type { Transaction } from "@/lib/types";
import {
  getDisplayValue,
  formatDisplayValue,
  formatPrice,
  getRangeAgeStat,
  formatPeriod,
} from "@/lib/utils";
import type { SimilarResponse } from "@/app/api/similar/route";

const PriceTrendChart = lazy(() => import("@/components/PriceTrendChart"));

// ── AI キャッシュ ─────────────────────────────────────────────
const CACHE_TTL = 24 * 60 * 60 * 1000;

function getCachedSummary(code: string): string | null {
  try {
    const raw = localStorage.getItem(`ai_summary_${code}`);
    if (!raw) return null;
    const { text, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem(`ai_summary_${code}`); return null; }
    return text;
  } catch { return null; }
}
function setCachedSummary(code: string, text: string) {
  try { localStorage.setItem(`ai_summary_${code}`, JSON.stringify({ text, ts: Date.now() })); } catch {}
}

// ── レートリミット ────────────────────────────────────────────
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
  } catch { return { allowed: true, remaining: RATE_LIMIT }; }
}

// ── similar キャッシュ ────────────────────────────────────────
function getSimilarCached(key: string): SimilarResponse | null {
  try {
    const raw = localStorage.getItem(`similar_${key}`);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    return Date.now() - ts < CACHE_TTL ? data : null;
  } catch { return null; }
}
function setSimilarCached(key: string, data: SimilarResponse) {
  try { localStorage.setItem(`similar_${key}`, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

// ── 定数 ──────────────────────────────────────────────────────
const AGE_LABELS: Record<string, string> = {
  age_0_10: "築10年以内",
  age_11_20: "築11〜20年",
  age_21_30: "築21〜30年",
  age_31_plus: "築31年以上",
};
type SortKey = "price" | "area" | "age" | "walkMinutes" | "period";
type DisplayMode = "total" | "sqm";

// ────────────────────────────────────────────────────────────
export default function StationPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = params.code as string;

  const station = stationData.find((s) => s.stationCode === code) ?? null;

  // URL パラメータから初期フィルター値を取得
  const initArea = parseInt(searchParams.get("area") ?? "70", 10);
  const initMode = (searchParams.get("mode") ?? "total") as DisplayMode;
  const initBudget = parseInt(searchParams.get("budget") ?? "0", 10) || null;

  const [targetArea, setTargetArea] = useState(isNaN(initArea) ? 70 : initArea);
  const [displayMode, setDisplayMode] = useState<DisplayMode>(initMode === "sqm" ? "sqm" : "total");
  const [budgetMax] = useState<number | null>(initBudget);

  // お気に入り
  const [isFavorite, setIsFavorite] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("favorites");
      if (saved) setIsFavorite(new Set<string>(JSON.parse(saved)).has(code));
    } catch {}
  }, [code]);
  function toggleFavorite() {
    try {
      const saved = localStorage.getItem("favorites");
      const set = new Set<string>(saved ? JSON.parse(saved) : []);
      if (set.has(code)) set.delete(code); else set.add(code);
      localStorage.setItem("favorites", JSON.stringify([...set]));
      setIsFavorite(set.has(code));
    } catch {}
  }

  // 取引データ
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("period");
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    if (!station) return;
    setTxLoading(true);
    fetch(`/transactions/${station.stationCode}.json`)
      .then((r) => r.json())
      .then((data: Transaction[]) => setTransactions(data))
      .catch(() => setTransactions([]))
      .finally(() => setTxLoading(false));
  }, [station]);

  // AI分析
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [rateLimitMsg, setRateLimitMsg] = useState<string | null>(null);

  useEffect(() => {
    if (station) {
      const cached = getCachedSummary(station.stationCode);
      if (cached) setAiText(cached);
    }
  }, [station]);

  const handleGenerateAI = useCallback(async () => {
    if (!station) return;
    const cached = getCachedSummary(station.stationCode);
    if (cached) { setAiText(cached); return; }
    const { allowed, remaining } = checkRateLimit();
    if (!allowed) { setRateLimitMsg("1時間あたりの生成上限（10回）に達しました。"); return; }
    if (remaining <= 2) setRateLimitMsg(`残り生成回数: ${remaining}回/時間`);
    else setRateLimitMsg(null);
    setAiLoading(true); setAiText(""); setAiError(null);
    try {
      const res = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stationName: station.stationName, area: station.area, lines: station.lines, recentYears: station.years }),
      });
      if (res.status === 429) { const b = await res.json().catch(() => ({})); throw new Error(b.error ?? "リクエストが多すぎます。"); }
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setAiText(full);
      }
      setCachedSummary(station.stationCode, full);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "生成に失敗しました");
    } finally { setAiLoading(false); }
  }, [station]);

  // 類似エリア
  const [similarResult, setSimilarResult] = useState<SimilarResponse | null>(null);
  const [similarLoading, setSimilarLoading] = useState(false);

  const handleSimilar = useCallback(async () => {
    if (!station || !budgetMax) return;
    const key = `${station.stationCode}_${budgetMax}_${targetArea}`;
    const cached = getSimilarCached(key);
    if (cached) { setSimilarResult(cached); return; }
    setSimilarLoading(true);
    try {
      const res = await fetch("/api/similar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stationCode: station.stationCode, budgetMax, targetArea }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: SimilarResponse = await res.json();
      setSimilarResult(data); setSimilarCached(key, data);
    } catch (err) {
      setSimilarResult({ aspirational: { stationName: station.stationName, medianPrice: 0 }, stations: [], summary: err instanceof Error ? err.message : "エラーが発生しました。" });
    } finally { setSimilarLoading(false); }
  }, [station, budgetMax, targetArea]);

  // ── 物件査定補助 ─────────────────────────────────────────
  const [checkArea, setCheckArea] = useState(String(initArea));
  const [checkAge, setCheckAge] = useState("");
  const [checkWalk, setCheckWalk] = useState("");
  const [checkPrice, setCheckPrice] = useState("");
  const [checkResult, setCheckResult] = useState<{
    count: number;
    medianUnitPrice: number;
    fairPrice: number;
    diffPct: number;
    inputUnitPrice: number;
  } | { count: number; insufficient: true } | null>(null);
  const [copied, setCopied] = useState(false);

  function runCheck() {
    const area = parseFloat(checkArea);
    const age = parseFloat(checkAge);
    const walk = checkWalk !== "" ? parseFloat(checkWalk) : null;
    const price = parseFloat(checkPrice);
    if (isNaN(area) || isNaN(age) || isNaN(price) || area <= 0 || price <= 0) return;

    const similar = transactions.filter((tx) => {
      const areaOk = Math.abs(tx.area - area) <= 15;
      const ageOk = tx.age !== null && Math.abs(tx.age - age) <= 7;
      const walkOk = walk === null || tx.walkMinutes === null || Math.abs((tx.walkMinutes ?? 0) - walk) <= 5;
      return areaOk && ageOk && walkOk;
    });

    if (similar.length < 3) {
      setCheckResult({ count: similar.length, insufficient: true });
      return;
    }

    const unitPrices = similar.map((tx) => tx.price / tx.area).sort((a, b) => a - b);
    const mid = Math.floor(unitPrices.length / 2);
    const medianUnitPrice = unitPrices.length % 2 === 0
      ? (unitPrices[mid - 1] + unitPrices[mid]) / 2
      : unitPrices[mid];
    const fairPrice = medianUnitPrice * area;
    const inputUnitPrice = price / area;
    const diffPct = ((price - fairPrice) / fairPrice) * 100;
    setCheckResult({ count: similar.length, medianUnitPrice, fairPrice, diffPct, inputUnitPrice });
  }

  function buildCopyText() {
    if (!checkResult || "insufficient" in checkResult) return "";
    const { count, medianUnitPrice, fairPrice, diffPct } = checkResult;
    const sign = diffPct >= 0 ? "+" : "";
    return `【相場比較メモ】${station?.stationName}駅\n` +
      `条件: ${checkArea}㎡・築${checkAge}年・徒歩${checkWalk || "―"}分\n` +
      `類似成約（${count}件）中央値: 約${Math.round(fairPrice)}万円（㎡単価 ${medianUnitPrice.toFixed(1)}万円/㎡）\n` +
      `ご提示価格: ${checkPrice}万円（相場比 ${sign}${diffPct.toFixed(1)}%）\n` +
      `出典: 国土交通省 不動産情報ライブラリ（実成約データ）`;
  }

  // ソート・フィルタ
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(key === "period" ? false : true); }
  };

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button onClick={() => toggleSort(k)} className="flex items-center gap-0.5 text-xs font-medium text-gray-500 hover:text-gray-800">
      {label}
      <span className="text-gray-300">{sortKey === k ? (sortAsc ? "↑" : "↓") : "↕"}</span>
    </button>
  );

  // ── 駅が存在しない場合 ──────────────────────────────────────
  if (!station) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-gray-500">
        <p>駅データが見つかりません（{code}）</p>
        <Link href="/" className="text-blue-500 hover:underline text-sm">← マップに戻る</Link>
      </div>
    );
  }

  // ── 計算 ──────────────────────────────────────────────────
  const filter = { targetArea, displayMode, ageCategories: new Set<never>(), yearFrom: "2025", yearTo: "2025", visiblePriceRanges: new Set<never>(), showHazard: false, budgetMax, maxWalkMinutes: null, lineFilter: null };
  const allStats = getRangeAgeStat(station, "all", filter);
  const isOverBudget = displayMode === "total" && budgetMax !== null && allStats !== null && getDisplayValue(allStats.medianPrice70, filter) > budgetMax;
  const priceLabel = displayMode === "sqm" ? "㎡単価" : `${targetArea}㎡換算`;

  const sorted = [...transactions].sort((a, b) => {
    let diff = 0;
    if (sortKey === "price") diff = a.price - b.price;
    else if (sortKey === "area") diff = a.area - b.area;
    else if (sortKey === "age") diff = (a.age ?? 999) - (b.age ?? 999);
    else if (sortKey === "walkMinutes") diff = (a.walkMinutes ?? 999) - (b.walkMinutes ?? 999);
    else diff = a.period.localeCompare(b.period);
    return sortAsc ? diff : -diff;
  });

  // SUUMO 検索 URL（駅名ベース）
  const suumoUrl = `https://suumo.jp/jj/bukken/ichiran/JJ012FJ001/?ar=030&bs=011&rn=0&fw2=&kw=${encodeURIComponent(station.stationName)}`;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── ヘッダー ───────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-gray-800 truncate">{station.stationName}駅</h1>
            {isOverBudget && (
              <span className="text-xs bg-red-50 text-red-500 border border-red-200 rounded-full px-2 py-0.5 flex-shrink-0">予算超過</span>
            )}
          </div>
          <p className="text-xs text-gray-400 truncate">{station.lines.join(" / ")}</p>
        </div>
        <button
          onClick={toggleFavorite}
          title={isFavorite ? "お気に入りから外す" : "お気に入りに追加"}
          className={`p-1.5 rounded transition-colors flex-shrink-0 ${isFavorite ? "text-yellow-400 hover:text-yellow-500" : "text-gray-300 hover:text-yellow-400"}`}
        >
          <svg className="w-5 h-5" fill={isFavorite ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
          </svg>
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* ── 表示モード・面積 ───────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex flex-wrap items-center gap-3">
          {/* 総額 / 単価 */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
            <button
              onClick={() => setDisplayMode("total")}
              className={`px-2.5 py-1 transition-colors ${displayMode === "total" ? "bg-gray-800 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
            >総額</button>
            <button
              onClick={() => setDisplayMode("sqm")}
              className={`px-2.5 py-1 transition-colors border-l border-gray-200 ${displayMode === "sqm" ? "bg-gray-800 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
            >㎡単価</button>
          </div>
          {/* 面積 */}
          <div className={`flex items-center gap-1.5 transition-opacity ${displayMode === "sqm" ? "opacity-30 pointer-events-none" : ""}`}>
            <span className="text-xs text-gray-500">面積</span>
            <div className="flex gap-1">
              {[30, 40, 50, 60, 70, 80, 90].map((a) => (
                <button
                  key={a}
                  onClick={() => setTargetArea(a)}
                  className={`rounded-md px-2 py-1 text-xs font-medium transition-all ${targetArea === a ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                >
                  {a}㎡
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── 価格サマリ ────────────────────────────────────────── */}
        {allStats && allStats.count > 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700">2025年 取引サマリ</h2>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs text-gray-400">{priceLabel}（中央値）</p>
                <p className="text-lg font-bold text-gray-800 mt-0.5">{formatDisplayValue(getDisplayValue(allStats.medianPrice70, filter), displayMode)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">{priceLabel}（平均）</p>
                <p className="text-lg font-bold text-gray-600 mt-0.5">{formatDisplayValue(getDisplayValue(allStats.avgPrice70, filter), displayMode)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">取引件数</p>
                <p className="text-lg font-bold text-gray-800 mt-0.5">{allStats.count}件</p>
              </div>
            </div>
            {station.medianWalkMinutes !== undefined && (
              <p className="text-xs text-gray-400 text-center">🚶 駅徒歩中央値 {station.medianWalkMinutes}分</p>
            )}
            {/* 築年数別内訳 */}
            <div className="border-t border-gray-100 pt-2 space-y-1">
              {(["age_0_10", "age_11_20", "age_21_30", "age_31_plus"] as const).map((key) => {
                const s = getRangeAgeStat(station, key, filter);
                if (!s || s.count === 0) return null;
                return (
                  <div key={key} className="flex justify-between text-xs text-gray-600">
                    <span>{AGE_LABELS[key]}</span>
                    <span className="tabular-nums">{s.count}件 / {formatDisplayValue(getDisplayValue(s.medianPrice70, filter), displayMode)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-4 text-sm text-gray-400">2025年のデータがありません。</div>
        )}

        {/* ── 価格推移グラフ ────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">価格推移グラフ</h2>
          <Suspense fallback={<div className="text-xs text-gray-400 py-6 text-center">グラフを読み込み中...</div>}>
            <PriceTrendChart station={station} allStations={stationData} targetArea={targetArea} />
          </Suspense>
        </div>

        {/* ── AI傾向分析 ────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-700">AI傾向分析</h2>
            <button
              onClick={handleGenerateAI}
              disabled={aiLoading}
              className={`text-xs px-2.5 py-1 rounded-md transition-colors ${aiLoading ? "bg-gray-100 text-gray-400 cursor-wait" : "bg-blue-600 text-white hover:bg-blue-700"}`}
            >
              {aiLoading ? "生成中…" : aiText ? "再生成" : "生成"}
            </button>
          </div>
          {rateLimitMsg && <p className="text-xs text-amber-600 mb-1">{rateLimitMsg}</p>}
          {aiError && <p className="text-xs text-red-500">{aiError}</p>}
          {aiText ? (
            <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
              {aiText}
              {aiLoading && <span className="inline-block w-1 h-3 bg-blue-400 animate-pulse ml-0.5 align-middle" />}
            </p>
          ) : !aiLoading && !aiError && (
            <p className="text-xs text-gray-400 italic">「生成」を押すとAIがこのエリアの不動産傾向を分析します。</p>
          )}
        </div>

        {/* ── 類似エリア（予算超過時） ──────────────────────────── */}
        {isOverBudget && budgetMax && (
          <div className="bg-red-50/60 rounded-xl border border-red-100 px-4 py-4">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-base">💡</span>
              <h2 className="text-sm font-semibold text-gray-700">{station.stationName}が気になるあなたへ</h2>
            </div>
            <p className="text-xs text-gray-500 mb-2">予算{budgetMax.toLocaleString()}万円内で、似た特徴のエリアを探します。</p>
            {!similarResult && (
              <button onClick={handleSimilar} disabled={similarLoading} className="w-full py-2 text-xs bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50">
                {similarLoading ? "検索中..." : "予算内の類似エリアを探す →"}
              </button>
            )}
            {similarResult && (
              <div className="space-y-2">
                {similarResult.summary && <p className="text-xs text-gray-600 bg-white rounded-lg px-3 py-2">{similarResult.summary}</p>}
                {similarResult.stations.map((s, i) => (
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
                    <Link href={`/station/${s.stationCode}?area=${targetArea}&mode=${displayMode}${budgetMax ? `&budget=${budgetMax}` : ""}`} className="text-xs text-blue-500 hover:underline">詳細を見る →</Link>
                  </div>
                ))}
                <button onClick={() => setSimilarResult(null)} className="text-xs text-gray-400 hover:text-gray-600">再検索</button>
              </div>
            )}
          </div>
        )}

        {/* ── 取引一覧 ──────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-gray-700">
              取引一覧
              {transactions.length > 0 && <span className="ml-1.5 text-xs font-normal text-gray-400">{transactions.length}件</span>}
            </h2>
          </div>
          <p className="text-xs text-gray-400 mb-3">国土交通省の実成約データです。業者の提示価格と比べてみてください。</p>
          {txLoading ? (
            <div className="text-xs text-gray-400 py-6 text-center">読み込み中...</div>
          ) : transactions.length === 0 ? (
            <div className="text-xs text-gray-400 py-6 text-center">取引データがありません。</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="pb-1.5 text-left"><SortBtn k="price" label="価格" /></th>
                    <th className="pb-1.5 text-left"><SortBtn k="area" label="面積" /></th>
                    <th className="pb-1.5 text-left"><SortBtn k="age" label="築年" /></th>
                    <th className="pb-1.5 text-left">間取り</th>
                    <th className="pb-1.5 text-left"><SortBtn k="walkMinutes" label="徒歩" /></th>
                    <th className="pb-1.5 text-left"><SortBtn k="period" label="時期" /></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((tx, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-1 font-medium tabular-nums pr-2">{formatPrice(tx.price)}</td>
                      <td className="py-1 tabular-nums pr-2">{tx.area}㎡</td>
                      <td className="py-1 tabular-nums pr-2">{tx.age !== null ? `${tx.age}年` : "—"}</td>
                      <td className="py-1 pr-2">{tx.floorPlan || "—"}</td>
                      <td className="py-1 tabular-nums pr-2">{tx.walkMinutes !== undefined && tx.walkMinutes !== null ? `${tx.walkMinutes}分` : "—"}</td>
                      <td className="py-1 text-gray-400">{formatPeriod(tx.period)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── 物件査定補助 ──────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-0.5">物件の適正価格チェック</h2>
          <p className="text-xs text-gray-400 mb-3">SUUMOなどで気になった物件のスペックを入力すると、上の成約データと比較します。</p>

          <div className="grid grid-cols-2 gap-2 mb-3">
            {[
              { label: "面積（㎡）", value: checkArea, set: setCheckArea, placeholder: "70" },
              { label: "築年数（年）", value: checkAge, set: setCheckAge, placeholder: "15" },
              { label: "駅徒歩（分）任意", value: checkWalk, set: setCheckWalk, placeholder: "8" },
              { label: "価格（万円）", value: checkPrice, set: setCheckPrice, placeholder: "4500" },
            ].map(({ label, value, set, placeholder }) => (
              <div key={label}>
                <label className="block text-xs text-gray-500 mb-0.5">{label}</label>
                <input
                  type="number"
                  value={value}
                  onChange={(e) => { set(e.target.value); setCheckResult(null); }}
                  placeholder={placeholder}
                  className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
            ))}
          </div>

          <button
            onClick={runCheck}
            disabled={transactions.length === 0}
            className="w-full py-2 text-sm font-medium bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-40"
          >
            {transactions.length === 0 ? "データ読み込み中..." : "相場と比べる"}
          </button>

          {checkResult && (
            <div className="mt-3">
              {"insufficient" in checkResult ? (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                  類似条件の成約データが少なすぎます（{checkResult.count}件）。面積・築年数の範囲を広げて再度お試しください。
                </p>
              ) : (
                <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-3 space-y-2">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>類似成約件数</span>
                    <span className="font-medium text-gray-700">{checkResult.count}件</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>成約㎡単価（中央値）</span>
                    <span className="font-medium text-gray-700">{checkResult.medianUnitPrice.toFixed(1)}万円/㎡</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>適正価格の目安（{checkArea}㎡換算）</span>
                    <span className="font-medium text-gray-700">約{Math.round(checkResult.fairPrice).toLocaleString()}万円</span>
                  </div>
                  <div className="border-t border-gray-200 pt-2 flex justify-between items-center">
                    <span className="text-xs text-gray-500">相場との比較</span>
                    <span className={`text-base font-bold ${checkResult.diffPct > 5 ? "text-red-500" : checkResult.diffPct < -5 ? "text-green-600" : "text-gray-700"}`}>
                      {checkResult.diffPct >= 0 ? "+" : ""}{checkResult.diffPct.toFixed(1)}%
                    </span>
                  </div>
                  {Math.abs(checkResult.diffPct) > 5 && (
                    <p className="text-xs text-gray-500">
                      {checkResult.diffPct > 5
                        ? `相場より約${Math.round(parseFloat(checkPrice) - checkResult.fairPrice).toLocaleString()}万円高い設定です。交渉の余地があるかもしれません。`
                        : `相場より約${Math.round(checkResult.fairPrice - parseFloat(checkPrice)).toLocaleString()}万円安い設定です。`}
                    </p>
                  )}
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(buildCopyText()).then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      });
                    }}
                    className="w-full mt-1 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                  >
                    {copied ? "✓ コピーしました" : "交渉メモをコピー"}
                  </button>
                  <p className="text-xs text-gray-400">※ 国土交通省の過去成約データによる参考値です。実際の取引価格を保証するものではありません。</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── 外部リンク ────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-4 space-y-2">
          <h2 className="text-sm font-semibold text-gray-700">現在の売り出し物件を探す</h2>
          <p className="text-xs text-gray-400">上の成約データで相場を確認したら、外部サイトで今の売り出し物件と比べてみてください。</p>
          <a
            href={suumoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between w-full px-4 py-3 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors"
          >
            <span className="text-sm font-medium text-green-800">SUUMO で{station.stationName}駅の物件を探す</span>
            <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>

        <div className="pb-8" />
      </main>
    </div>
  );
}
