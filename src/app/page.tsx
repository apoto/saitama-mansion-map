"use client";

import { useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import FilterPanel from "@/components/FilterPanel";
import AreaList from "@/components/AreaList";
import StationDetail from "@/components/StationDetail";
import SuggestPanel from "@/components/SuggestPanel";
import BudgetPanel from "@/components/BudgetPanel";
import PrefectureBar from "@/components/PrefectureBar";
import CrossPrefPanel from "@/components/CrossPrefPanel";
import OnboardingWizard from "@/components/OnboardingWizard";
import type { SuggestResponse } from "@/app/api/suggest/route";
import { stationData } from "@/data/stations";
import type { FilterState, PriceRange, StationData } from "@/lib/types";
import { PRICE_RANGES } from "@/lib/constants";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-gray-50">
      <div className="text-sm text-gray-400">地図を読み込み中...</div>
    </div>
  ),
});

const ALL_PRICE_RANGES = new Set<PriceRange>(PRICE_RANGES.map((r) => r.key));

function getInitialBudget(): number | null {
  if (typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get("budget");
  const n = v ? parseInt(v, 10) : NaN;
  return isNaN(n) || n <= 0 ? null : n;
}

function shouldShowWizard(): boolean {
  if (typeof window === "undefined") return false;
  // URLにbudgetがある場合は表示しない（共有リンク等）
  if (new URLSearchParams(window.location.search).get("budget")) return false;
  return localStorage.getItem("onboarding_completed") !== "1";
}

export default function Home() {
  const [filter, setFilter] = useState<FilterState>({
    yearFrom: "2025",
    yearTo: "2025",
    ageCategories: new Set(),
    targetArea: 70,
    visiblePriceRanges: ALL_PRICE_RANGES,
    showHazard: false,
    budgetMax: getInitialBudget(),
  });

  const [selectedStation, setSelectedStation] = useState<StationData | null>(null);
  const [selectedPrefecture, setSelectedPrefecture] = useState<string | null>("埼玉県");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [crossPrefOpen, setCrossPrefOpen] = useState(false);
  const [highlightedStations, setHighlightedStations] = useState<Set<string>>(new Set());
  const [budgetCalloutDismissed, setBudgetCalloutDismissed] = useState(false);
  // G-05: SuggestPanel と OnboardingWizard で共有する提案結果
  const [suggestQuery, setSuggestQuery] = useState<string | null>(null);
  const [suggestResult, setSuggestResult] = useState<SuggestResponse | null>(null);
  // G-01: ウィザード表示フラグ（クライアントのみ判定）
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("budget_callout_dismissed") === "1") {
      setBudgetCalloutDismissed(true);
    }
    setShowWizard(shouldShowWizard());
  }, []);

  // budgetMax が変わったら URL に反映
  useEffect(() => {
    const url = new URL(window.location.href);
    if (filter.budgetMax !== null) {
      url.searchParams.set("budget", String(filter.budgetMax));
    } else {
      url.searchParams.delete("budget");
    }
    history.replaceState(null, "", url.toString());
  }, [filter.budgetMax]);

  const stations = useMemo(() => stationData, []);

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-5 py-2.5 sm:py-3 bg-white border-b border-gray-200 shadow-sm gap-2">
        <div className="min-w-0">
          <h1 className="text-sm sm:text-lg font-bold text-gray-800 tracking-tight leading-tight">
            {selectedPrefecture
              ? `${selectedPrefecture.replace("都", "").replace("県", "")} 中古マンション相場`
              : "関東 中古マンション相場マップ"}
          </h1>
          <p className="text-xs text-gray-400 hidden sm:block">
            駅別 {filter.targetArea}㎡換算価格 ×{" "}
            {filter.yearFrom === filter.yearTo
              ? `${filter.yearTo}年`
              : `${filter.yearFrom}〜${filter.yearTo}年`}
            取引・2025Q3時点のデータ
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => setBudgetOpen(true)}
            className="inline-flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white rounded-full px-3 py-1.5 text-sm font-medium transition-colors shadow-sm"
          >
            <span>💰</span>
            <span className="hidden sm:inline">予算シミュレーター</span>
            <span className="sm:hidden">予算確認</span>
          </button>
          <button
            onClick={() => setSuggestOpen(true)}
            className="inline-flex items-center gap-1 bg-blue-500 hover:bg-blue-600 text-white rounded-full px-2.5 py-1 text-xs font-medium transition-colors shadow-sm"
          >
            <span>✨</span>
            <span className="hidden sm:inline">AIエリア提案</span>
            <span className="sm:hidden">AIで探す</span>
          </button>
          <button
            onClick={() => setCrossPrefOpen(true)}
            className="inline-flex items-center gap-1 bg-indigo-500 hover:bg-indigo-600 text-white rounded-full px-2.5 py-1 text-xs font-medium transition-colors shadow-sm"
          >
            <span>🗾</span>
            <span className="hidden sm:inline">他県比較</span>
            <span className="sm:hidden">他県も見る</span>
          </button>
        </div>
      </header>

      {/* Budget callout */}
      {filter.budgetMax === null && !budgetCalloutDismissed && (
        <div className="flex items-center justify-between gap-2 px-4 py-2 bg-green-50 border-b border-green-100">
          <button
            onClick={() => setBudgetOpen(true)}
            className="flex items-center gap-1.5 text-sm text-green-700 font-medium hover:text-green-900 transition-colors"
          >
            <span>💰</span>
            <span>まず予算を確認してみましょう →</span>
          </button>
          <button
            onClick={() => {
              localStorage.setItem("budget_callout_dismissed", "1");
              setBudgetCalloutDismissed(true);
            }}
            className="text-green-400 hover:text-green-600 transition-colors flex-shrink-0"
            aria-label="閉じる"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Prefecture selector */}
      <PrefectureBar selected={selectedPrefecture} onChange={setSelectedPrefecture} />

      {/* Filters */}
      <FilterPanel filter={filter} onChange={setFilter} />

      {/* Map */}
      <div className="flex-1 min-h-0">
        <MapView
          stations={stations}
          filter={filter}
          onStationClick={setSelectedStation}
          highlightedStations={highlightedStations}
          selectedPrefecture={selectedPrefecture}
        />
      </div>

      {/* Area station list */}
      <div className="max-h-[25vh] sm:max-h-[35vh] overflow-y-auto">
        <AreaList
          stations={stations}
          filter={filter}
          selectedPrefecture={selectedPrefecture}
          onStationClick={setSelectedStation}
        />
      </div>

      {/* Station detail drawer */}
      <StationDetail
        station={selectedStation}
        filter={filter}
        onClose={() => setSelectedStation(null)}
        allStations={stations}
        onSelectStation={setSelectedStation}
      />

      {/* Budget simulator panel */}
      <BudgetPanel
        open={budgetOpen}
        onClose={() => setBudgetOpen(false)}
        onApply={(budget) => setFilter((f) => ({ ...f, budgetMax: budget }))}
      />

      {/* Cross-prefecture comparison panel */}
      <CrossPrefPanel
        open={crossPrefOpen}
        onClose={() => setCrossPrefOpen(false)}
        defaultPrefecture={selectedPrefecture}
        defaultBudget={filter.budgetMax}
        onSelectStation={(station) => {
          setSelectedStation(station);
          setCrossPrefOpen(false);
        }}
        stations={stations}
      />

      {/* AI Concierge panel */}
      <SuggestPanel
        open={suggestOpen}
        onClose={() => setSuggestOpen(false)}
        onSelectStation={(station) => {
          setSelectedStation(station);
          setSuggestOpen(false);
        }}
        onHighlight={setHighlightedStations}
        stations={stations}
        initialQuery={suggestQuery}
        initialResult={suggestResult}
        onResultChange={(q, r) => { setSuggestQuery(q); setSuggestResult(r); }}
      />

      {/* Onboarding Wizard */}
      {showWizard && (
        <OnboardingWizard
          onComplete={({ budgetMax, targetArea, suggestQuery: q, suggestResult: r }) => {
            setFilter((f) => ({ ...f, budgetMax, targetArea }));
            if (q) setSuggestQuery(q);
            if (r) {
              setSuggestResult(r);
              setHighlightedStations(new Set(r.stations.map((s) => s.stationCode)));
            }
            setBudgetCalloutDismissed(true);
            setShowWizard(false);
          }}
        />
      )}
    </div>
  );
}
