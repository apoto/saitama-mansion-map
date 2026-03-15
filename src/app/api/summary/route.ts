import { GoogleGenAI } from "@google/genai";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const runtime = "edge";

interface YearStats {
  count: number;
  avgPrice70: number;
  medianPrice70: number;
}

interface RequestBody {
  stationName: string;
  area: string;
  lines: string[];
  recentYears: Record<string, {
    all: YearStats;
    age_0_10: YearStats;
    age_11_20: YearStats;
    age_21_30: YearStats;
    age_31_plus: YearStats;
  }>;
}

function buildPrompt(body: RequestBody): string {
  const { stationName, area, lines, recentYears } = body;
  const lineText = lines.length > 0 ? lines.join("・") : area;

  const trendLines = Object.entries(recentYears)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 5)
    .map(([year, data]) => {
      const s = data.all;
      if (s.count === 0) return null;
      return `  ${year}年: ${s.count}件 / 70㎡換算中央値 ${s.medianPrice70.toLocaleString()}万円`;
    })
    .filter(Boolean)
    .join("\n");

  const latestYear = Object.keys(recentYears).sort().reverse()[0];
  const latestData = recentYears[latestYear];
  const ageLines = (
    [
      ["築10年以内", latestData?.age_0_10],
      ["築11〜20年", latestData?.age_11_20],
      ["築21〜30年", latestData?.age_21_30],
      ["築31年以上", latestData?.age_31_plus],
    ] as [string, YearStats][]
  )
    .filter(([, s]) => s?.count > 0)
    .map(([label, s]) => `  ${label}: ${s.count}件 / 中央値 ${s.medianPrice70.toLocaleString()}万円`)
    .join("\n");

  return `あなたは不動産市場アナリストです。以下は${stationName}駅（${lineText}）周辺の中古マンション取引データです。

【直近5年の価格推移（70㎡換算）】
${trendLines || "  データなし"}

【${latestYear}年 築年数別内訳】
${ageLines || "  データなし"}

このデータをもとに、以下の観点で**200字程度**の傾向分析を日本語で生成してください。箇条書きではなく自然な文章で。
1. 価格帯の特徴（埼玉県内での位置づけ）
2. 築年数による価格差の傾向
3. 価格推移のトレンド（上昇・横ばい・下落）
4. この駅で物件を探す人へのひとことアドバイス`;
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = checkRateLimit(`summary:${ip}`, 10, 60 * 60 * 1000);
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ error: `レートリミット超過。${rl.retryAfterSec}秒後に再試行してください。` }),
      { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const body: RequestBody = await req.json();

  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY ?? "" });

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const result = await ai.models.generateContentStream({
          model: "gemini-2.5-flash",
          contents: buildPrompt(body),
        });

        for await (const chunk of result) {
          const text = chunk.text;
          if (text) controller.enqueue(encoder.encode(text));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        controller.enqueue(encoder.encode(`[エラー: ${msg}]`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
