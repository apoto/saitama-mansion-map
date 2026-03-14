"use client";

import type { FilterState, AgeCategory, PriceRange } from "@/lib/types";
import { YEARS, AGE_CATEGORIES, PRICE_RANGES } from "@/lib/constants";

interface Props {
  filter: FilterState;
  onChange: (filter: FilterState) => void;
}

export default function FilterPanel({ filter, onChange }: Props) {
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
    <div className="flex flex-wrap items-center gap-4 px-4 py-3 bg-white border-b border-gray-200">
      {/* 年度 */}
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-gray-500 whitespace-nowrap">
          年度
        </label>
        <select
          value={filter.year}
          onChange={(e) => onChange({ ...filter, year: e.target.value })}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        >
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}年
            </option>
          ))}
        </select>
      </div>

      {/* 築年数 */}
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-gray-500 whitespace-nowrap">
          築年数
        </label>
        <select
          value={filter.ageCategory}
          onChange={(e) =>
            onChange({ ...filter, ageCategory: e.target.value as AgeCategory })
          }
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        >
          {AGE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* 価格帯 */}
      <div className="flex items-center gap-1.5 ml-auto">
        <span className="text-xs font-medium text-gray-500 mr-1">価格帯</span>
        {PRICE_RANGES.map((range) => {
          const active = filter.visiblePriceRanges.has(range.key);
          return (
            <button
              key={range.key}
              onClick={() => togglePriceRange(range.key)}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                active
                  ? "text-white shadow-sm"
                  : "bg-gray-100 text-gray-400"
              }`}
              style={active ? { backgroundColor: range.color } : undefined}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: range.color, opacity: active ? 1 : 0.4 }}
              />
              {range.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
