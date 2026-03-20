"use client";

import { useState } from "react";
import type { FilterState, AgeCategoryKey, PriceRange } from "@/lib/types";
import { YEARS, AGE_CATEGORY_OPTIONS, TARGET_AREAS, PRICE_RANGES, PRICE_RANGES_SQM } from "@/lib/constants";

interface Props {
  filter: FilterState;
  onChange: (filter: FilterState) => void;
  onResetWizard?: () => void;
  allLines?: string[];
}

export default function FilterPanel({ filter, onChange, onResetWizard, allLines = [] }: Props) {
  const [priceRangeOpen, setPriceRangeOpen] = useState(false);
  const toggleAgeCategory = (key: AgeCategoryKey) => {
    const next = new Set(filter.ageCategories);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onChange({ ...filter, ageCategories: next });
  };

  const togglePriceRange = (key: PriceRange) => {
    const next = new Set(filter.visiblePriceRanges);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onChange({ ...filter, visiblePriceRanges: next });
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-white border-b border-gray-200 overflow-x-auto">
      {/* 年度範囲 */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-gray-500 whitespace-nowrap">年度</span>
        <select
          value={filter.yearFrom}
          onChange={(e) => {
            const from = e.target.value;
            // yearFrom > yearTo なら yearTo を from に合わせる
            const to = parseInt(from) > parseInt(filter.yearTo) ? from : filter.yearTo;
            onChange({ ...filter, yearFrom: from, yearTo: to });
          }}
          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        >
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}年</option>
          ))}
        </select>
        <span className="text-xs text-gray-400">〜</span>
        <select
          value={filter.yearTo}
          onChange={(e) => {
            const to = e.target.value;
            // yearTo < yearFrom なら yearFrom を to に合わせる
            const from = parseInt(to) < parseInt(filter.yearFrom) ? to : filter.yearFrom;
            onChange({ ...filter, yearFrom: from, yearTo: to });
          }}
          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        >
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}年</option>
          ))}
        </select>
        {filter.yearFrom !== filter.yearTo && (
          <button
            onClick={() => onChange({ ...filter, yearFrom: filter.yearTo })}
            className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
            title="最新年度のみに戻す"
          >
            ✕
          </button>
        )}
      </div>

      {/* 路線フィルター */}
      {allLines.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-gray-500 whitespace-nowrap">路線</span>
          <select
            value={filter.lineFilter ?? ""}
            onChange={(e) => onChange({ ...filter, lineFilter: e.target.value || null })}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          >
            <option value="">すべて</option>
            {allLines.map((line) => (
              <option key={line} value={line}>{line}</option>
            ))}
          </select>
          {filter.lineFilter && (
            <button
              onClick={() => onChange({ ...filter, lineFilter: null })}
              className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
              title="路線フィルターを解除"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* 表示モード + 面積 */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* 総額 / 単価 トグル */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
          <button
            onClick={() => onChange({ ...filter, displayMode: "total" })}
            className={`px-2.5 py-1 transition-colors ${
              filter.displayMode === "total"
                ? "bg-gray-800 text-white"
                : "bg-white text-gray-500 hover:bg-gray-50"
            }`}
          >
            総額
          </button>
          <button
            onClick={() => onChange({ ...filter, displayMode: "sqm" })}
            className={`px-2.5 py-1 transition-colors border-l border-gray-200 ${
              filter.displayMode === "sqm"
                ? "bg-gray-800 text-white"
                : "bg-white text-gray-500 hover:bg-gray-50"
            }`}
          >
            ㎡単価
          </button>
        </div>

        {/* 面積（総額モードのみ有効） */}
        <div className={`flex items-center gap-1.5 transition-opacity ${filter.displayMode === "sqm" ? "opacity-30 pointer-events-none" : ""}`}>
          <span className="text-xs font-medium text-gray-500 whitespace-nowrap">面積</span>
          <div className="flex gap-1">
            {TARGET_AREAS.map((area) => {
              const active = filter.targetArea === area;
              return (
                <button
                  key={area}
                  onClick={() => onChange({ ...filter, targetArea: area })}
                  className={`rounded-md px-2 py-1 text-xs font-medium transition-all ${
                    active
                      ? "bg-gray-800 text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {area}㎡
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 築年数 */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-gray-500 whitespace-nowrap">築年数</span>
        <div className="flex gap-1">
          <button
            onClick={() => onChange({ ...filter, ageCategories: new Set() })}
            className={`rounded-md px-2 py-1 text-xs font-medium transition-all ${
              filter.ageCategories.size === 0
                ? "bg-gray-800 text-white"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            すべて
          </button>
          {AGE_CATEGORY_OPTIONS.map((opt) => {
            const active = filter.ageCategories.has(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggleAgeCategory(opt.value)}
                className={`rounded-md px-2 py-1 text-xs font-medium transition-all ${
                  active
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 予算バッジ */}
      {filter.budgetMax !== null && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
            <span className="text-xs text-green-700 font-medium">
              予算 {filter.budgetMax.toLocaleString()}万円以下
            </span>
            <button
              onClick={() => onChange({ ...filter, budgetMax: null })}
              className="text-green-500 hover:text-green-700 transition-colors ml-0.5"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <span className="text-xs text-gray-400 whitespace-nowrap">グレー = 予算超</span>
        </div>
      )}


      {/* ハザードマップ */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onChange({ ...filter, showHazard: !filter.showHazard })}
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all border ${
            filter.showHazard
              ? "bg-blue-50 text-blue-700 border-blue-300"
              : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200"
          }`}
          title="国土交通省 洪水浸水想定区域を表示"
        >
          <span>🌊</span>
          <span>ハザード</span>
        </button>
      </div>

      {/* 設定やり直し */}
      {onResetWizard && (
        <button
          onClick={() => {
            try { localStorage.removeItem("onboarding_completed"); } catch {}
            onResetWizard();
          }}
          className="text-xs text-gray-400 hover:text-gray-600 whitespace-nowrap transition-colors"
          title="初期設定をやり直す"
        >
          ⚙ 設定やり直し
        </button>
      )}

      {/* 価格帯（折りたたみ） */}
      <div className="flex items-center gap-1.5 sm:ml-auto">
        <button
          onClick={() => setPriceRangeOpen((v) => !v)}
          className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors whitespace-nowrap"
        >
          <span>価格帯</span>
          {/* アクティブな色ドット */}
          <span className="flex gap-0.5 ml-0.5">
            {(filter.displayMode === "sqm" ? PRICE_RANGES_SQM : PRICE_RANGES).map((range) =>
              filter.visiblePriceRanges.has(range.key) ? (
                <span
                  key={range.key}
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: range.color }}
                />
              ) : null
            )}
          </span>
          <svg
            className={`w-3 h-3 transition-transform ${priceRangeOpen ? "rotate-180" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {priceRangeOpen && (
          <div className="flex gap-1">
            {(filter.displayMode === "sqm" ? PRICE_RANGES_SQM : PRICE_RANGES).map((range) => {
              const active = filter.visiblePriceRanges.has(range.key);
              return (
                <button
                  key={range.key}
                  onClick={() => togglePriceRange(range.key)}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                    active ? "text-white shadow-sm" : "bg-gray-100 text-gray-400"
                  }`}
                  style={active ? { backgroundColor: range.color } : undefined}
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: range.color, opacity: active ? 1 : 0.4 }}
                  />
                  {range.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
