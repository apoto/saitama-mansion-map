// シンプルな in-memory レートリミッター（プロセス内共有）
// Vercel シングルインスタンスで有効。複数インスタンス間は非共有だが個人プロジェクトには十分。

interface Entry {
  count: number;
  windowStart: number;
}

const store = new Map<string, Entry>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

/**
 * @param key     識別子（例: "summary:1.2.3.4"）
 * @param limit   ウィンドウ内の最大リクエスト数
 * @param windowMs ウィンドウの長さ（ミリ秒）
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.windowStart > windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: limit - 1, retryAfterSec: 0 };
  }

  if (entry.count >= limit) {
    const retryAfterSec = Math.ceil((windowMs - (now - entry.windowStart)) / 1000);
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count, retryAfterSec: 0 };
}

export function getClientIp(req: Request): string {
  // x-forwarded-forの末尾を使う（先頭はクライアントが偽装可能。Vercelは実際のIPを末尾に追記する）
  return (
    req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}
