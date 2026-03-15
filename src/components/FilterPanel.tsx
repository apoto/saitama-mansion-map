"use client";

import type { FilterState, AgeCategoryKey, PriceRange } from "@/lib/types";
import { YEARS, AGE_CATEGORY_OPTIONS, TARGET_AREAS, PRICE_RANGES } from "@/lib/constants";

interface Props {
  filter: FilterState;
  onChange: (filter: FilterState) => void;
}

export default function FilterPanel({ filter, onChange }: Props) {
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
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 bg-white border-b border-gray-200">
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

      {/* 面積 */}
      <div className="flex items-center gap-1.5">
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

      {/* 価格帯 */}
      <div className="flex items-center gap-1.5 ml-auto">
        <span className="text-xs font-medium text-gray-500 whitespace-nowrap">価格帯</span>
        <div className="flex gap-1">
          {PRICE_RANGES.map((range) => {
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
      </div>
    </div>
  );
}
