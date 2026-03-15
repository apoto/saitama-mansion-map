/**
 * /api/cross-prefecture
 *
 * 「{basePrefecture}で{budget}万円の予算で住める駅」を基準に、
 * 他都道府県でも同じ予算で住める駅をランキングして返す。
 *
 * POST body:
 *   { basePrefecture: string, budget: number, targetArea?: number }
 *
 * Response:
 *   { results: PrefResult[] }
 *
 * PrefResult:
 *   { prefecture, stations: StationRow[] }
 */

import { stationData } from "@/data/stations";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { PREFECTURE_ORDER } from "@/lib/constants";

export const runtime = "nodejs";

const LATEST_YEAR = "2025";

export interface CrossPrefStation {
  stationCode: string;
  stationName: string;
  area: string;
  prefecture: string;
  lines: string[];
  medianPrice: number;   // targetArea換算中央値（万円）
  count: number;
  priceRatio: number;    // medianPrice / budget（0〜1）
}

export interface CrossPrefResult {
  prefecture: string;
  stations: CrossPrefStation[];
  medianOfMedians: number;  // その県内 "住める駅" の中央値
}

export interface CrossPrefResponse {
  budget: number;
  targetArea: number;
  basePrefecture: string;
  results: CrossPrefResult[];
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`cross:${ip}`, 30, 60 * 60 * 1000);
  if (!rl.allowed) {
    return Response.json(
      { error: `レートリミット超過。${rl.retryAfterSec}秒後に再試行してください。` },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const { basePrefecture, budget, targetArea = 70 } = await req.json();

  if (typeof basePrefecture !== "string" || !PREFECTURE_ORDER.includes(basePrefecture as never)) {
    return Response.json({ error: "invalid basePrefecture" }, { status: 400 });
  }
  if (!Number.isFinite(budget) || budget <= 0 || budget > 100000) {
    return Response.json({ error: "budget must be a positive number (≤100000)" }, { status: 400 });
  }
  if (!Number.isFinite(targetArea) || targetArea <= 0 || targetArea > 300) {
    return Response.json({ error: "targetArea must be 1–300" }, { status: 400 });
  }

  // 各都道府県の「予算以内で住める駅」を取得
  const results: CrossPrefResult[] = PREFECTURE_ORDER
    .filter((pref) => pref !== basePrefecture)
    .map((pref) => {
      const stations: CrossPrefStation[] = stationData
        .filter((s) => s.prefecture === pref)
        .flatMap((s) => {
          const yd = s.years[LATEST_YEAR];
          if (!yd || yd.all.count === 0) return [];
          const price = Math.round((yd.all.medianPrice70 / 70) * targetArea);
          if (price > budget) return [];
          return [{
            stationCode: s.stationCode,
            stationName: s.stationName,
            area: s.area,
            prefecture: pref,
            lines: s.lines,
            medianPrice: price,
            count: yd.all.count,
            priceRatio: Math.round((price / budget) * 100) / 100,
          }];
        })
        .sort((a, b) => b.medianPrice - a.medianPrice);  // 高い順（予算に近い順）

      const prices = stations.map((s) => s.medianPrice);
      const medianOfMedians = prices.length > 0
        ? prices[Math.floor(prices.length / 2)]
        : 0;

      return { prefecture: pref, stations: stations.slice(0, 20), medianOfMedians };
    })
    .filter((r) => r.stations.length > 0);

  // basePrefecture での "住める駅" も取得
  const baseStations: CrossPrefStation[] = stationData
    .filter((s) => s.prefecture === basePrefecture)
    .flatMap((s) => {
      const yd = s.years[LATEST_YEAR];
      if (!yd || yd.all.count === 0) return [];
      const price = Math.round((yd.all.medianPrice70 / 70) * targetArea);
      if (price > budget) return [];
      return [{
        stationCode: s.stationCode,
        stationName: s.stationName,
        area: s.area,
        prefecture: basePrefecture,
        lines: s.lines,
        medianPrice: price,
        count: yd.all.count,
        priceRatio: Math.round((price / budget) * 100) / 100,
      }];
    })
    .sort((a, b) => b.medianPrice - a.medianPrice);

  const baseMedian = baseStations.length > 0
    ? baseStations[Math.floor(baseStations.length / 2)].medianPrice
    : 0;

  return Response.json({
    budget,
    targetArea,
    basePrefecture,
    baseStations: baseStations.slice(0, 10),
    baseStationCount: baseStations.length,
    baseMedian,
    results,
  } satisfies CrossPrefResponse & { baseStations: CrossPrefStation[]; baseStationCount: number; baseMedian: number });
}
