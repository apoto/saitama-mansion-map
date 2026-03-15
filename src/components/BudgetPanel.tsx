"use client";

import { useState, useMemo } from "react";

const INCOMES = [400, 500, 600, 700, 800, 1000, 1200, 1500];
const ASSETS  = [0, 300, 500, 1000, 1500, 2000, 3000, 5000];

function calcBudget(income: number, assets: number) {
  const loan = income * 6.5;
  const dp   = assets * 0.15;
  const min  = Math.round((income * 5  + assets * 0.10) / 100) * 100;
  const max  = Math.round((income * 8  + assets * 0.20) / 100) * 100;
  const est  = Math.round((loan + dp) / 100) * 100;
  return { est, min, max };
}

interface Props {
  open: boolean;
  onClose: () => void;
  onApply: (budgetMax: number) => void;
}

export default function BudgetPanel({ open, onClose, onApply }: Props) {
  const [income, setIncome] = useState(600);
  const [assets, setAssets] = useState(500);

  const { est, min, max } = useMemo(() => calcBudget(income, assets), [income, assets]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col">

        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xl">💰</span>
            <div>
              <h2 className="text-base font-bold text-gray-800">予算シミュレーター</h2>
              <p className="text-xs text-gray-400">年収・資産から購入予算の目安を計算</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

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
          <div className="bg-blue-50 rounded-xl px-4 py-3 space-y-1">
            <p className="text-xs text-blue-500 font-medium">推定予算</p>
            <p className="text-2xl font-bold text-blue-700">{est.toLocaleString()}<span className="text-base font-normal ml-1">万円</span></p>
            <p className="text-xs text-blue-400">{min.toLocaleString()}万〜{max.toLocaleString()}万円の範囲</p>
            <p className="text-xs text-gray-400 mt-1">目安です。実際のローン審査は金利・属性・物件条件により異なります。詳細は金融機関にご確認ください。</p>
            <p className="text-xs text-gray-400">なお自己資産のうち諸費用（物件価格の5〜7%程度）を差し引いた額が実質的な頭金になります。</p>
          </div>

          {/* マトリクス */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500">年収 × 資産 早見表（推定予算・万円）</p>
            <div className="overflow-x-auto rounded-lg border border-gray-100">
              <table className="text-xs w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-2 py-1.5 text-left text-gray-400 font-medium whitespace-nowrap">年収 ＼ 資産</th>
                    {ASSETS.map((a) => (
                      <th key={a} className={`px-2 py-1.5 text-center font-medium whitespace-nowrap ${a === assets ? "text-blue-600" : "text-gray-400"}`}>
                        {a === 0 ? "なし" : `${a >= 1000 ? `${a/1000}千` : a}万`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {INCOMES.map((inc) => (
                    <tr key={inc} className={inc === income ? "bg-blue-50" : "hover:bg-gray-50"}>
                      <td className={`px-2 py-1.5 font-medium whitespace-nowrap ${inc === income ? "text-blue-600" : "text-gray-500"}`}>
                        {inc.toLocaleString()}万
                      </td>
                      {ASSETS.map((ast) => {
                        const { est: cellEst } = calcBudget(inc, ast);
                        const isActive = inc === income && ast === assets;
                        return (
                          <td key={ast}
                            onClick={() => { setIncome(inc); setAssets(ast); }}
                            className={`px-2 py-1.5 text-center tabular-nums cursor-pointer transition-colors ${
                              isActive
                                ? "bg-blue-500 text-white font-bold rounded"
                                : "text-gray-600 hover:bg-blue-50"
                            }`}>
                            {cellEst.toLocaleString()}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors">
            キャンセル
          </button>
          <button
            onClick={() => { onApply(est); onClose(); }}
            className="flex-2 flex-grow py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm font-medium transition-colors"
          >
            予算 {est.toLocaleString()}万円でマップを絞り込む →
          </button>
        </div>
      </div>
    </div>
  );
}
