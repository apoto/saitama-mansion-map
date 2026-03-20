"use client";

import { useState, useMemo } from "react";
import type { SuggestResponse } from "@/app/api/suggest/route";

// ── 予算計算（BudgetPanelと同じロジック）─────────────────────────
const INCOMES = [400, 500, 600, 700, 800, 1000, 1200, 1500];
const ASSETS  = [0, 300, 500, 1000, 1500, 2000, 3000, 5000];

function calcBudget(income: number, assets: number) {
  const loan = income * 6.5;
  const dp   = assets * 0.15;
  const est  = Math.round((loan + dp) / 100) * 100;
  const min  = Math.round((income * 5  + assets * 0.10) / 100) * 100;
  const max  = Math.round((income * 8  + assets * 0.20) / 100) * 100;
  return { est, min, max };
}

// ── 世帯人数の選択肢 ─────────────────────────────────────────────
const HOUSEHOLD_OPTIONS = [
  {
    emoji: "🧑",
    label: "おひとり様 / 投資",
    sub: "30㎡目安（1K・1LDK）",
    targetArea: 30,
  },
  {
    emoji: "👫",
    label: "2人暮らし",
    sub: "60㎡目安（2LDK）",
    targetArea: 60,
  },
  {
    emoji: "👨‍👩‍👧",
    label: "ファミリー",
    sub: "80㎡目安（3LDK）",
    targetArea: 80,
  },
] as const;

// ── Props ────────────────────────────────────────────────────────
interface Props {
  onComplete: (params: {
    budgetMax: number;
    targetArea: number;
    suggestQuery: string | null;
    suggestResult: SuggestResponse | null;
  }) => void;
}

// ── メインコンポーネント ─────────────────────────────────────────
export default function OnboardingWizard({ onComplete }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // STEP 1
  const [income, setIncome] = useState(600);
  const [assets, setAssets] = useState(500);
  const { est, min, max } = useMemo(() => calcBudget(income, assets), [income, assets]);

  // STEP 2
  const [targetArea, setTargetArea] = useState<30 | 60 | 80>(70 as never);

  // STEP 3
  const [areaText, setAreaText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── 完了処理 ──────────────────────────────────────────────────
  async function handleComplete(skip: boolean) {
    // wizard_area_text を保存（G-26）
    if (!skip && areaText.trim()) {
      try { localStorage.setItem("wizard_area_text", areaText.trim()); } catch {}
    }

    if (skip || !areaText.trim()) {
      finish(null, null);
      return;
    }

    // 予算を自動付加してAI提案
    const query = `予算${est.toLocaleString()}万円以内で、${areaText.trim()}`;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, targetArea }),
      });
      if (!res.ok) throw new Error("APIエラー");
      const data: SuggestResponse = await res.json();
      finish(query, data);
    } catch {
      setError("AI提案の取得に失敗しました。スキップして続けることができます。");
      setLoading(false);
    }
  }

  function finish(query: string | null, result: SuggestResponse | null) {
    // 完了フラグを保存（G-06）
    try {
      localStorage.setItem("onboarding_completed", "1");
      localStorage.setItem("budget_callout_dismissed", "1");
    } catch {}
    onComplete({ budgetMax: est, targetArea, suggestQuery: query, suggestResult: result });
  }

  // ── ステップインジケーター ────────────────────────────────────
  const steps = [
    { n: 1, label: "予算" },
    { n: 2, label: "世帯" },
    { n: 3, label: "エリア" },
  ];

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-white">
      <div className="w-full max-w-md mx-auto px-6 py-8 flex flex-col gap-6 min-h-screen sm:min-h-0 sm:bg-white sm:rounded-2xl sm:shadow-2xl sm:px-8 sm:py-10">

        {/* ステップインジケーター */}
        <div className="flex items-center justify-center gap-3">
          {steps.map(({ n, label }) => (
            <div key={n} className="flex items-center gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step === n
                  ? "bg-blue-500 text-white"
                  : step > n
                  ? "bg-blue-200 text-blue-600"
                  : "bg-gray-100 text-gray-400"
              }`}>
                {step > n ? "✓" : n}
              </div>
              <span className={`text-xs ${step === n ? "text-blue-600 font-medium" : "text-gray-400"}`}>
                {label}
              </span>
              {n < 3 && <div className="w-6 h-px bg-gray-200 mx-1" />}
            </div>
          ))}
        </div>

        {/* ── STEP 1: 予算 ──────────────────────────────────── */}
        {step === 1 && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-xl font-bold text-gray-800">あなたの購入予算を確認しましょう</h2>
              <p className="text-sm text-gray-400 mt-1">年収と自己資産を選んでください</p>
            </div>

            {/* 年収 */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-500">年収（万円）</label>
              <div className="flex flex-wrap gap-1.5">
                {INCOMES.map((v) => (
                  <button key={v} onClick={() => setIncome(v)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      income === v ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}>
                    {v.toLocaleString()}万
                  </button>
                ))}
              </div>
            </div>

            {/* 自己資産 */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-500">自己資産・頭金（万円）</label>
              <div className="flex flex-wrap gap-1.5">
                {ASSETS.map((v) => (
                  <button key={v} onClick={() => setAssets(v)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      assets === v ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}>
                    {v === 0 ? "なし" : `${v.toLocaleString()}万`}
                  </button>
                ))}
              </div>
            </div>

            {/* 推定予算 */}
            <div className="bg-blue-50 rounded-xl px-4 py-3 space-y-0.5">
              <p className="text-xs text-blue-500 font-medium">推定予算の目安</p>
              <p className="text-2xl font-bold text-blue-700">
                {est.toLocaleString()}<span className="text-base font-normal ml-1">万円</span>
              </p>
              <p className="text-xs text-blue-400">{min.toLocaleString()}万〜{max.toLocaleString()}万円の範囲</p>
              <p className="text-xs text-gray-400 mt-2">
                ※ あくまで目安です。実際の借入可能額は金利・属性・物件条件により異なります。詳細は金融機関にご確認ください。
              </p>
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-colors"
            >
              次へ: 何人で住みますか？ →
            </button>
          </div>
        )}

        {/* ── STEP 2: 世帯人数 ──────────────────────────────── */}
        {step === 2 && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-xl font-bold text-gray-800">何人で住む予定ですか？</h2>
              <p className="text-sm text-gray-400 mt-1">面積の目安が自動で設定されます</p>
            </div>

            <div className="flex flex-col gap-3">
              {HOUSEHOLD_OPTIONS.map((opt) => (
                <button
                  key={opt.targetArea}
                  onClick={() => setTargetArea(opt.targetArea as 30 | 60 | 80)}
                  className={`flex items-center gap-4 px-5 py-4 rounded-xl border-2 transition-all text-left ${
                    targetArea === opt.targetArea
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <span className="text-3xl">{opt.emoji}</span>
                  <div>
                    <div className={`font-bold ${targetArea === opt.targetArea ? "text-blue-700" : "text-gray-800"}`}>
                      {opt.label}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{opt.sub}</div>
                  </div>
                </button>
              ))}
            </div>

            <p className="text-xs text-gray-400 text-center">面積はあとでフィルターパネルから変更できます</p>

            <div className="flex gap-2">
              <button
                onClick={() => setStep(1)}
                className="px-4 py-3 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors"
              >
                ← 戻る
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!targetArea}
                className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-200 text-white rounded-xl font-medium transition-colors"
              >
                次へ: 住みたいエリアは？ →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: 住みたいエリア ────────────────────────── */}
        {step === 3 && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-xl font-bold text-gray-800">住みたいエリアの希望は？</h2>
              <p className="text-sm text-gray-400 mt-1">自由に入力してください（任意）</p>
            </div>

            <div className="bg-blue-50 rounded-lg px-3 py-2 text-xs text-blue-600">
              💰 予算 {est.toLocaleString()}万円の条件で提案します
            </div>

            <div className="space-y-2">
              <textarea
                value={areaText}
                onChange={(e) => setAreaText(e.target.value)}
                placeholder={"例: 大宮に近くて静かなエリア\n新宿に通いやすい沿線\n子育てしやすい駅など"}
                rows={4}
                className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none placeholder:text-gray-300"
              />
            </div>

            {error && (
              <div className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</div>
            )}

            {loading && (
              <div className="flex items-center justify-center gap-2 py-2 text-gray-400 text-sm">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                AIが提案を生成中...
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setStep(2)}
                disabled={loading}
                className="px-4 py-3 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors disabled:opacity-40"
              >
                ← 戻る
              </button>
              <button
                onClick={() => handleComplete(false)}
                disabled={loading || !areaText.trim()}
                className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-200 text-white rounded-xl font-medium transition-colors"
              >
                {loading ? "生成中..." : "AIエリア提案を見る →"}
              </button>
            </div>

            <button
              onClick={() => handleComplete(true)}
              disabled={loading}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors text-center disabled:opacity-40"
            >
              スキップしてマップを見る（あとでAI提案ボタンから試せます）
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
