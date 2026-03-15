import { GoogleGenAI } from "@google/genai";
import { stationData } from "@/data/stations";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

export interface SimilarStation {
  stationCode: string;
  stationName: string;
  area: string;
  lines: string[];
  medianPrice: number;
  count: number;
  score: number;
  reason: string;
}

export interface SimilarResponse {
  aspirational: { stationName: string; medianPrice: number };
  stations: SimilarStation[];
  summary: string;
}

const LATEST_YEAR = "2025";

function getMedianPrice(stationCode: string, targetArea: number): number | null {
  const s = stationData.find((s) => s.stationCode === stationCode);
  if (!s) return null;
  const yd = s.years[LATEST_YEAR];
  if (!yd || yd.all.count === 0) return null;
  return Math.round((yd.all.medianPrice70 / 70) * targetArea);
}

function scoreStation(
  candidate: typeof stationData[0],
  target: typeof stationData[0],
  budgetMax: number,
  targetArea: number
): number | null {
  const yd = candidate.years[LATEST_YEAR];
  if (!yd || yd.all.count === 0) return null;
  const price = Math.round((yd.all.medianPrice70 / 70) * targetArea);

  // 予算内のみ対象
  if (price > budgetMax) return null;
  // 対象駅自身を除外
  if (candidate.stationCode === target.stationCode) return null;

  let score = 0;

  // 同一路線
  const sharedLines = candidate.lines.filter((l) => target.lines.includes(l));
  score += sharedLines.length > 0 ? 30 : 0;

  // 同一エリア
  if (candidate.area === target.area) score += 20;

  // 価格帯（予算の80%以上 = 憧れエリアに近い高さ）
  const priceRatio = price / budgetMax;
  if (priceRatio >= 0.8) score += 20;
  else if (priceRatio >= 0.6) score += 10;

  // 取引件数（データ充実度）
  score += Math.min(10, yd.all.count / 10);

  return score > 5 ? score : null;
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`similar:${ip}`, 10, 60 * 60 * 1000);
  if (!rl.allowed) {
    return Response.json(
      { error: `レートリミット超過。${rl.retryAfterSec}秒後に再試行してください。` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const { stationCode, budgetMax, targetArea = 70 } = await req.json();
  if (!stationCode || typeof stationCode !== "string") {
    return Response.json({ error: "stationCode is required" }, { status: 400 });
  }
  if (!Number.isFinite(budgetMax) || budgetMax <= 0 || budgetMax > 100000) {
    return Response.json({ error: "budgetMax must be a positive number (≤100000)" }, { status: 400 });
  }
  if (!Number.isFinite(targetArea) || targetArea <= 0 || targetArea > 300) {
    return Response.json({ error: "targetArea must be a positive number (≤300)" }, { status: 400 });
  }

  const target = stationData.find((s) => s.stationCode === stationCode);
  if (!target) return Response.json({ error: "station not found" }, { status: 404 });

  const targetPrice = getMedianPrice(stationCode, targetArea) ?? 0;

  // スコアリング
  const candidates = stationData
    .map((s) => {
      const score = scoreStation(s, target, budgetMax, targetArea);
      if (score === null) return null;
      const yd = s.years[LATEST_YEAR]!;
      return {
        station: s,
        score,
        price: Math.round((yd.all.medianPrice70 / 70) * targetArea),
        count: yd.all.count,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  if (candidates.length === 0) {
    return Response.json({
      aspirational: { stationName: target.stationName, medianPrice: targetPrice },
      stations: [],
      summary: "予算内で条件の近いエリアが見つかりませんでした。",
    } satisfies SimilarResponse);
  }

  // AI説明生成
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY ?? "" });
  const candidateText = candidates
    .map((c, i) => `${i + 1}. ${c.station.stationName}駅（${c.station.area}）: ${c.price.toLocaleString()}万円 / ${c.count}件`)
    .join("\n");

  const result = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `ユーザーは「${target.stationName}駅」（${target.area}、${targetPrice.toLocaleString()}万円）に興味がありますが予算${budgetMax.toLocaleString()}万円を超えています。
以下の予算内の類似候補駅から上位3〜4駅を選び、JSON形式で返してください。

候補駅（${targetArea}㎡換算中央値）:
${candidateText}

JSON形式:
{
  "stations": [
    { "index": number, "reason": string }
  ],
  "summary": string
}
・reason: ${target.stationName}と比べた魅力・類似点を40字程度で
・summary: 全体の一言まとめ（60字程度）`,
    config: { responseMimeType: "application/json" },
  });

  try {
    const parsed = JSON.parse(result.text ?? "{}");
    const stations: SimilarStation[] = (parsed.stations ?? [])
      .slice(0, 4)
      .map((item: { index: number; reason: string }) => {
        const c = candidates[item.index - 1];
        if (!c) return null;
        return {
          stationCode: c.station.stationCode,
          stationName: c.station.stationName,
          area: c.station.area,
          lines: c.station.lines,
          medianPrice: c.price,
          count: c.count,
          score: Math.round(c.score),
          reason: item.reason,
        };
      })
      .filter(Boolean);

    return Response.json({
      aspirational: { stationName: target.stationName, medianPrice: targetPrice },
      stations,
      summary: parsed.summary ?? "",
    } satisfies SimilarResponse);
  } catch {
    const stations: SimilarStation[] = candidates.slice(0, 4).map((c) => ({
      stationCode: c.station.stationCode,
      stationName: c.station.stationName,
      area: c.station.area,
      lines: c.station.lines,
      medianPrice: c.price,
      count: c.count,
      score: Math.round(c.score),
      reason: "",
    }));
    return Response.json({
      aspirational: { stationName: target.stationName, medianPrice: targetPrice },
      stations,
      summary: "",
    } satisfies SimilarResponse);
  }
}
