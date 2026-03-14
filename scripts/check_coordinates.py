#!/usr/bin/env python3
"""
stations.ts の座標精度を確認するスクリプト。
埼玉県の境界ボックス外にある駅を検出して報告する。

Usage:
  python3 scripts/check_coordinates.py

Output:
  - 埼玉県境界外の駅一覧
  - None座標の駅一覧
  - 正常な駅数の集計
"""

import json
import re
from pathlib import Path

# 埼玉県のおおよその境界ボックス（余裕を持たせた値）
SAITAMA_BOUNDS = {
    "lat_min": 35.7,
    "lat_max": 36.3,
    "lng_min": 138.7,
    "lng_max": 139.9,
}

def load_stations_from_ts(ts_path: Path) -> list[dict]:
    text = ts_path.read_text("utf-8")
    # TypeScript形式: "export const stationData: StationData[] = \n[...];"
    match = re.search(r"export const stationData: StationData\[\] =\s*(\[.*?\]);", text, re.DOTALL)
    if not match:
        raise ValueError("stationData が見つかりません")
    return json.loads(match.group(1))

def check_coordinates(stations: list[dict]) -> dict:
    results = {
        "ok": [],
        "out_of_bounds": [],
        "missing": [],
    }
    b = SAITAMA_BOUNDS
    for s in stations:
        lat = s.get("lat")
        lng = s.get("lng")
        name = s.get("stationName", "?")
        code = s.get("stationCode", "?")

        if lat is None or lng is None or lat == 0 or lng == 0:
            results["missing"].append({"code": code, "name": name, "lat": lat, "lng": lng})
            continue

        if not (b["lat_min"] <= lat <= b["lat_max"] and b["lng_min"] <= lng <= b["lng_max"]):
            results["out_of_bounds"].append({
                "code": code,
                "name": name,
                "lat": lat,
                "lng": lng,
                "note": f"lat={lat}, lng={lng}",
            })
        else:
            results["ok"].append(name)

    return results

def main():
    root = Path(__file__).parent.parent
    ts_path = root / "src" / "data" / "stations.ts"

    if not ts_path.exists():
        print(f"[ERROR] {ts_path} が見つかりません")
        return

    print(f"[INFO] 読み込み: {ts_path}")
    stations = load_stations_from_ts(ts_path)
    print(f"[INFO] 駅数: {len(stations)}")
    print()

    results = check_coordinates(stations)

    print(f"✅ 正常 ({len(results['ok'])}駅):")
    # 正常なものは件数だけ表示
    print(f"   {', '.join(results['ok'][:10])}{'...' if len(results['ok']) > 10 else ''}")
    print()

    if results["out_of_bounds"]:
        print(f"⚠️  埼玉県境界外 ({len(results['out_of_bounds'])}駅):  ← 手動確認要")
        for s in results["out_of_bounds"]:
            print(f"   {s['code']} {s['name']}: {s['note']}")
            print(f"   → https://www.google.com/maps?q={s['lat']},{s['lng']}")
    else:
        print("✅ 境界外の駅: なし")
    print()

    if results["missing"]:
        print(f"❌ 座標なし ({len(results['missing'])}駅):")
        for s in results["missing"]:
            print(f"   {s['code']} {s['name']}")
    else:
        print("✅ 座標なし: なし")

    print()
    print("=== サマリ ===")
    print(f"  正常: {len(results['ok'])}駅")
    print(f"  境界外（要確認）: {len(results['out_of_bounds'])}駅")
    print(f"  座標なし: {len(results['missing'])}駅")
    print()
    print(f"埼玉県境界ボックス（参考）:")
    print(f"  緯度: {SAITAMA_BOUNDS['lat_min']} 〜 {SAITAMA_BOUNDS['lat_max']}")
    print(f"  経度: {SAITAMA_BOUNDS['lng_min']} 〜 {SAITAMA_BOUNDS['lng_max']}")

if __name__ == "__main__":
    main()
