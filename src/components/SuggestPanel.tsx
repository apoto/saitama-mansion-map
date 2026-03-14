"use client";

import { useState, useRef, useEffect } from "react";
import type { StationData } from "@/lib/types";
import type { SuggestResponse, SuggestStation } from "@/app/api/suggest/route";

const CACHE_KEY_PREFIX = "suggest_cache_";
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

function getCached(query: string): SuggestResponse | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + query);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch {
    return null;
  }
}

function setCache(query: string, data: SuggestResponse) {
  try {
    localStorage.setItem(CACHE_KEY_PREFIX + query, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

const EXAMPLES = [
  "3000万以内、築20年以内、70㎡、川口・戸田エリア",
  "予算4500万で駅徒歩5分以内、大宮周辺",
  "2500万以下で広めの80㎡、子育て向き",
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSelectStation: (station: StationData) => void;
  onHighlight: (codes: Set<string>) => void;
  stations: StationData[];
}

export default function SuggestPanel({ open, onClose, onSelectStation, onHighlight, stations }: Props) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SuggestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [open]);

  // Clear highlights when panel closes
  useEffect(() => {
    if (!open) onHighlight(new Set());
  }, [open, onHighlight]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    const cached = getCached(q);
    if (cached) {
      setResult(cached);
      onHighlight(new Set(cached.stations.map((s) => s.stationCode)));
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      if (!res.ok) throw new Error("APIエラーが発生しました");
      const data: SuggestResponse = await res.json();
      setResult(data);
      setCache(q, data);
      onHighlight(new Set(data.stations.map((s) => s.stationCode)));
    } catch {
      setError("検索中にエラーが発生しました。しばらく待ってから再試行してください。");
    } finally {
      setLoading(false);
    }
  }

  function handleStationClick(suggested: SuggestStation) {
    const station = stations.find((s) => s.stationCode === suggested.stationCode);
    if (station) onSelectStation(station);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xl">✨</span>
            <div>
              <h2 className="text-base font-bold text-gray-800">AIエリア提案</h2>
              <p className="text-xs text-gray-400">条件を自然な言葉で入力してください</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Input form */}
          <form onSubmit={handleSubmit} className="space-y-2">
            <textarea
              ref={textareaRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="例: 3000万以内で築20年以内、川口か戸田エリア希望"
              rows={2}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none placeholder:text-gray-300"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e as unknown as React.FormEvent);
                }
              }}
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="w-full py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-200 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {loading ? "検索中..." : "この条件でおすすめエリアを探す"}
            </button>
          </form>

          {/* Examples */}
          {!result && !loading && (
            <div className="space-y-1.5">
              <p className="text-xs text-gray-400">入力例</p>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setQuery(ex)}
                  className="block w-full text-left text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg px-3 py-2 transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-8 gap-2 text-gray-400 text-sm">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              AIが条件を分析しています…
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-3">
              {result.summary && (
                <div className="text-sm text-gray-600 bg-blue-50 rounded-lg px-3 py-2.5">
                  {result.summary}
                </div>
              )}
              <p className="text-xs text-gray-400">おすすめ駅</p>
              {result.stations.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  条件に合う駅が見つかりませんでした。<br />
                  条件を緩めてみてください。
                </p>
              ) : (
                result.stations.map((s, i) => (
                  <SuggestCard
                    key={s.stationCode}
                    station={s}
                    rank={i + 1}
                    onShowOnMap={() => handleStationClick(s)}
                  />
                ))
              )}

              {/* Parsed conditions badge */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {result.conditions.maxPrice && (
                  <Badge label={`予算 ${result.conditions.maxPrice.toLocaleString()}万円以下`} />
                )}
                {result.conditions.maxAge && (
                  <Badge label={`築${result.conditions.maxAge}年以内`} />
                )}
                {result.conditions.targetArea && (
                  <Badge label={`${result.conditions.targetArea}㎡`} />
                )}
                {result.conditions.maxWalkMinutes && (
                  <Badge label={`徒歩${result.conditions.maxWalkMinutes}分以内`} />
                )}
                {result.conditions.preferredAreas.map((a) => (
                  <Badge key={a} label={a} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SuggestCard({
  station,
  rank,
  onShowOnMap,
}: {
  station: SuggestStation;
  rank: number;
  onShowOnMap: () => void;
}) {
  return (
    <div className="border border-gray-100 rounded-xl p-3 space-y-2 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center">
            {rank}
          </span>
          <div>
            <span className="font-bold text-sm text-gray-800">{station.stationName}駅</span>
            <span className="ml-1.5 text-xs text-gray-400">{station.area}</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-sm font-bold text-gray-800">{station.medianPrice.toLocaleString()}万円</div>
          <div className="text-xs text-gray-400">{station.count}件</div>
        </div>
      </div>

      {station.lines.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {station.lines.map((line) => (
            <span key={line} className="text-xs bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">
              {line}
            </span>
          ))}
        </div>
      )}

      {station.reason && (
        <p className="text-xs text-gray-500 leading-relaxed">{station.reason}</p>
      )}

      <button
        onClick={onShowOnMap}
        className="w-full text-xs text-blue-500 border border-blue-200 hover:bg-blue-50 rounded-lg py-1.5 transition-colors"
      >
        マップで見る・取引を確認する →
      </button>
    </div>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">{label}</span>
  );
}
