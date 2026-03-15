"use client";

import { PREFECTURE_ORDER, PREFECTURE_VIEWS } from "@/lib/constants";

interface Props {
  selected: string | null;
  onChange: (pref: string | null) => void;
}

export default function PrefectureBar({ selected, onChange }: Props) {
  return (
    <div className="bg-white border-b border-gray-200 px-2 py-1.5 overflow-x-auto">
      <div className="flex gap-1 min-w-max">
        {/* 全関東タブ */}
        <button
          onClick={() => onChange(null)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
            selected === null
              ? "bg-gray-800 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          全関東
        </button>
        {PREFECTURE_ORDER.map((pref) => (
          <button
            key={pref}
            onClick={() => onChange(pref)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
              selected === pref
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {PREFECTURE_VIEWS[pref]?.label ?? pref}
          </button>
        ))}
      </div>
    </div>
  );
}
