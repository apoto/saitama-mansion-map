import { GoogleGenAI } from "@google/genai";
import { stationData } from "@/data/stations";

// Node.js runtime（stationDataのインポートのため）
export const runtime = "nodejs";

interface ParsedConditions {
  maxPrice: number | null;       // 予算上限（万円）
  maxAge: number | null;         // 築年数上限
  targetArea: number | null;     // 希望面積（㎡）
  maxWalkMinutes: number | null; // 徒歩分数上限
  preferredAreas: string[];      // エリア・路線キーワード
}

export interface SuggestStation {
  stationCode: string;
  stationName: string;
  area: string;
  lines: string[];
  medianPrice: number;  // targetArea換算・中央値（万円）
  count: number;
  matchScore: number;
  reason: string;
}

export interface SuggestResponse {
  stations: SuggestStation[];
  summary: string;
  conditions: ParsedConditions;
}

const LATEST_YEAR = "2025";

// ── Step 1: 自然言語 → 条件解析 ─────────────────────────────
async function parseConditions(ai: GoogleGenAI, query: string): Promise<ParsedConditions> {
  const result = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `以下の不動産検索条件を解析してJSON形式で返してください。数値は整数か小数で、不明な場合はnullにしてください。

入力: "${query}"

JSON形式（このスキーマに厳密に従うこと）:
{
  "maxPrice": number | null,       // 予算上限（万円）例: "3000万以下"→3000
  "maxAge": number | null,         // 築年数上限 例: "築15年以内"→15
  "targetArea": number | null,     // 希望面積（㎡）例: "70平米"→70
  "maxWalkMinutes": number | null, // 駅徒歩上限 例: "駅徒歩10分以内"→10
  "preferredAreas": string[]       // エリア・路線キーワード 例: ["川口", "京浜東北線"]
}`,
    config: { responseMimeType: "application/json" },
  });

  try {
    const text = result.text ?? "{}";
    return JSON.parse(text);
  } catch {
    return { maxPrice: null, maxAge: null, targetArea: null, maxWalkMinutes: null, preferredAreas: [] };
  }
}

// ── Step 2: 駅データとのマッチング ───────────────────────────
function matchStations(conditions: ParsedConditions): { station: typeof stationData[0]; displayPrice: number; count: number; score: number }[] {
  const area = conditions.targetArea ?? 70;

  return stationData
    .map((station) => {
      const yearData = station.years[LATEST_YEAR];
      if (!yearData) return null;

      // 使う築年数データを選択
      let stats = yearData.all;
      if (conditions.maxAge !== null) {
        if (conditions.maxAge <= 10) stats = yearData.age_0_10;
        else if (conditions.maxAge <= 20) {
          // age_0_10 + age_11_20 の加重平均
          const a = yearData.age_0_10;
          const b = yearData.age_11_20;
          const total = a.count + b.count;
          if (total > 0) {
            stats = {
              count: total,
              avgPrice70: Math.round((a.avgPrice70 * a.count + b.avgPrice70 * b.count) / total),
              medianPrice70: Math.round((a.medianPrice70 * a.count + b.medianPrice70 * b.count) / total),
            };
          }
        } else if (conditions.maxAge <= 30) {
          const keys = ["age_0_10", "age_11_20", "age_21_30"] as const;
          const selected = keys.map((k) => yearData[k]).filter((s) => s.count > 0);
          const total = selected.reduce((s, v) => s + v.count, 0);
          if (total > 0) {
            stats = {
              count: total,
              avgPrice70: Math.round(selected.reduce((s, v) => s + v.avgPrice70 * v.count, 0) / total),
              medianPrice70: Math.round(selected.reduce((s, v) => s + v.medianPrice70 * v.count, 0) / total),
            };
          }
        }
      }

      if (stats.count === 0) return null;

      const displayPrice = Math.round((stats.medianPrice70 / 70) * area);

      // スコアリング（0〜100点）
      let score = 50;

      // 価格条件
      if (conditions.maxPrice !== null) {
        if (displayPrice <= conditions.maxPrice) {
          score += 30 * (1 - displayPrice / conditions.maxPrice); // 安いほど高得点
        } else {
          score -= 40 * ((displayPrice - conditions.maxPrice) / conditions.maxPrice);
        }
      }

      // 取引件数（データ充実度）
      score += Math.min(15, stats.count / 5);

      // エリアキーワードマッチ
      if (conditions.preferredAreas.length > 0) {
        const haystack = `${station.stationName} ${station.area} ${station.lines.join(" ")}`;
        const matched = conditions.preferredAreas.some((kw) => haystack.includes(kw));
        if (matched) score += 20;
      }

      return { station, displayPrice, count: stats.count, score };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null && x.score > 10)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8); // 上位8駅をLLMに渡す
}

// ── Step 3: AI説明生成 ──────────────────────────────────────
async function generateExplanations(
  ai: GoogleGenAI,
  query: string,
  candidates: ReturnType<typeof matchStations>,
  conditions: ParsedConditions
): Promise<{ stations: SuggestStation[]; summary: string }> {
  const area = conditions.targetArea ?? 70;
  const candidateText = candidates
    .map((c, i) => `${i + 1}. ${c.station.stationName}駅（${c.station.area}）: ${c.displayPrice.toLocaleString()}万円 / ${c.count}件`)
    .join("\n");

  const result = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `ユーザーの不動産検索条件「${query}」に対して、以下の駅データからおすすめ上位3〜5駅を選び、JSON形式で返してください。

候補駅（${area}㎡換算中央値）:
${candidateText}

以下のJSON形式で返してください:
{
  "stations": [
    {
      "index": number,      // 候補番号（1始まり）
      "reason": string      // 50字程度の推薦理由（データに基づく具体的な説明）
    }
  ],
  "summary": string         // 全体の一言まとめ（80字程度）
}`,
    config: { responseMimeType: "application/json" },
  });

  try {
    const parsed = JSON.parse(result.text ?? "{}");
    const stations: SuggestStation[] = (parsed.stations ?? [])
      .slice(0, 5)
      .map((item: { index: number; reason: string }) => {
        const c = candidates[item.index - 1];
        if (!c) return null;
        return {
          stationCode: c.station.stationCode,
          stationName: c.station.stationName,
          area: c.station.area,
          lines: c.station.lines,
          medianPrice: c.displayPrice,
          count: c.count,
          matchScore: Math.round(c.score),
          reason: item.reason,
        };
      })
      .filter(Boolean);

    return { stations, summary: parsed.summary ?? "" };
  } catch {
    // フォールバック: AI説明なしで上位5駅を返す
    const stations: SuggestStation[] = candidates.slice(0, 5).map((c) => ({
      stationCode: c.station.stationCode,
      stationName: c.station.stationName,
      area: c.station.area,
      lines: c.station.lines,
      medianPrice: c.displayPrice,
      count: c.count,
      matchScore: Math.round(c.score),
      reason: "",
    }));
    return { stations, summary: "" };
  }
}

// ── Main ────────────────────────────────────────────────────
export async function POST(req: Request) {
  const { query } = await req.json();
  if (!query?.trim()) {
    return Response.json({ error: "query is required" }, { status: 400 });
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY ?? "" });

  const conditions = await parseConditions(ai, query);
  const candidates = matchStations(conditions);

  if (candidates.length === 0) {
    return Response.json({
      stations: [],
      summary: "条件に合う駅が見つかりませんでした。条件を緩めてみてください。",
      conditions,
    });
  }

  const { stations, summary } = await generateExplanations(ai, query, candidates, conditions);

  return Response.json({ stations, summary, conditions } satisfies SuggestResponse);
}
