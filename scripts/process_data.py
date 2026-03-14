#!/usr/bin/env python3
"""
国土交通省 不動産取引価格情報CSV → stations.ts + transactions JSON 変換スクリプト

Usage:
  python3 scripts/process_data.py <input_csv_path>

Output:
  src/data/stations.ts              (TypeScript: 駅別集計データ)
  public/transactions/{code}.json   (JSON: 駅別個別取引データ)
  scripts/geocode_cache.json        (座標キャッシュ)
"""

import csv
import json
import re
import sys
import statistics
import time
import urllib.request
import urllib.parse
from pathlib import Path
from collections import defaultdict

# ──────────────────────────────────────────────
# 設定
# ──────────────────────────────────────────────

AREA_MAP = {
    "さいたま市西区": "さいたま市",
    "さいたま市北区": "さいたま市",
    "さいたま市大宮区": "さいたま市",
    "さいたま市見沼区": "さいたま市",
    "さいたま市中央区": "さいたま市",
    "さいたま市桜区": "さいたま市",
    "さいたま市浦和区": "さいたま市",
    "さいたま市南区": "さいたま市",
    "さいたま市緑区": "さいたま市",
    "さいたま市岩槻区": "さいたま市",
    "川口市": "川口・蕨・戸田",
    "蕨市": "川口・蕨・戸田",
    "戸田市": "川口・蕨・戸田",
    "越谷市": "越谷・草加・三郷",
    "草加市": "越谷・草加・三郷",
    "三郷市": "越谷・草加・三郷",
    "八潮市": "越谷・草加・三郷",
    "吉川市": "越谷・草加・三郷",
    "松伏町": "越谷・草加・三郷",
    "春日部市": "春日部・久喜",
    "久喜市": "春日部・久喜",
    "蓮田市": "春日部・久喜",
    "白岡市": "春日部・久喜",
    "加須市": "春日部・久喜",
    "幸手市": "春日部・久喜",
    "宮代町": "春日部・久喜",
    "杉戸町": "春日部・久喜",
    "所沢市": "所沢・入間・狭山",
    "入間市": "所沢・入間・狭山",
    "狭山市": "所沢・入間・狭山",
    "飯能市": "所沢・入間・狭山",
    "日高市": "所沢・入間・狭山",
    "川越市": "川越・ふじみ野",
    "ふじみ野市": "川越・ふじみ野",
    "富士見市": "川越・ふじみ野",
    "坂戸市": "川越・ふじみ野",
    "鶴ヶ島市": "川越・ふじみ野",
    "朝霞市": "朝霞・新座・和光",
    "新座市": "朝霞・新座・和光",
    "和光市": "朝霞・新座・和光",
    "志木市": "朝霞・新座・和光",
    "上尾市": "上尾・桶川・北本",
    "桶川市": "上尾・桶川・北本",
    "北本市": "上尾・桶川・北本",
    "鴻巣市": "上尾・桶川・北本",
    "伊奈町": "上尾・桶川・北本",
    "熊谷市": "熊谷・深谷・本庄",
    "深谷市": "熊谷・深谷・本庄",
    "本庄市": "熊谷・深谷・本庄",
    "行田市": "熊谷・深谷・本庄",
    "羽生市": "熊谷・深谷・本庄",
    "秩父市": "熊谷・深谷・本庄",
}

REFERENCE_YEAR = 2025


def parse_building_year(s: str) -> int | None:
    """'2019年' → 2019, '昭和48年' → 1973, '平成3年' → 1991 etc."""
    if not s:
        return None
    m = re.match(r"(\d{4})年", s)
    if m:
        return int(m.group(1))
    m = re.match(r"昭和(\d+)年", s)
    if m:
        return 1925 + int(m.group(1))
    m = re.match(r"平成(\d+)年", s)
    if m:
        return 1988 + int(m.group(1))
    m = re.match(r"令和(\d+)年", s)
    if m:
        return 2018 + int(m.group(1))
    return None


def age_category(building_year: int | None) -> str:
    if building_year is None:
        return "all"
    age = REFERENCE_YEAR - building_year
    if age <= 10:
        return "age_0_10"
    elif age <= 20:
        return "age_11_20"
    elif age <= 30:
        return "age_21_30"
    else:
        return "age_31_plus"


def parse_period_year(period: str) -> str:
    """'2024年第4四半期' → '2024'"""
    m = re.match(r"(\d{4})年", period)
    return m.group(1) if m else ""


def normalize_station_name(name: str) -> str:
    """'大宮(埼玉)' → '大宮', remove parenthetical suffixes for display."""
    return re.sub(r"[（(].+?[)）]", "", name).strip()


# ──────────────────────────────────────────────
# Step 1: CSV読み込み → 取引レコード
# ──────────────────────────────────────────────

def load_csv(path: str) -> list[dict]:
    records = []
    with open(path, "r", encoding="cp932") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if "中古マンション" not in row.get("種類", ""):
                continue
            station = row.get("最寄駅：名称", "").strip()
            if not station:
                continue

            try:
                price_raw = int(row["取引価格（総額）"])
                area = float(row["面積（㎡）"])
            except (ValueError, KeyError):
                continue

            if area <= 0:
                continue

            price_man = price_raw / 10000          # 万円
            unit_price = round(price_man / area, 2) # 万円/㎡
            price_70 = price_man / area * 70        # 70㎡換算（万円）

            building_year = parse_building_year(row.get("建築年", ""))
            year = parse_period_year(row.get("取引時期", ""))
            municipality = row.get("市区町村名", "")

            # 徒歩分数
            walk_str = row.get("最寄駅：距離（分）", "").strip()
            try:
                walk_minutes = int(walk_str)
            except (ValueError, TypeError):
                walk_minutes = None

            records.append({
                # 集計用
                "station_raw": station,
                "station_display": normalize_station_name(station),
                "municipality": municipality,
                "price_70": price_70,
                "age_cat": age_category(building_year),
                "year": year,
                # 取引詳細用
                "price": round(price_man),
                "area": area,
                "unit_price": unit_price,
                "building_year": building_year,
                "age": (REFERENCE_YEAR - building_year) if building_year else None,
                "floor_plan": row.get("間取り", "").strip(),
                "structure": row.get("建物の構造", "").strip(),
                "district": row.get("地区名", "").strip(),
                "period": row.get("取引時期", "").strip(),
                "walk_minutes": walk_minutes,
            })
    return records


# ──────────────────────────────────────────────
# Step 2: 駅別集計
# ──────────────────────────────────────────────

def aggregate(records: list[dict]) -> dict:
    stations = defaultdict(lambda: {
        "display": "",
        "municipalities": set(),
        "years": defaultdict(lambda: defaultdict(list)),
    })

    for r in records:
        key = r["station_raw"]
        s = stations[key]
        s["display"] = r["station_display"]
        s["municipalities"].add(r["municipality"])
        year = r["year"]
        s["years"][year]["all"].append(r["price_70"])
        s["years"][year][r["age_cat"]].append(r["price_70"])

    return stations


def compute_stats(prices: list[float]) -> dict:
    if not prices:
        return {"count": 0, "avgPrice70": 0, "medianPrice70": 0}
    return {
        "count": len(prices),
        "avgPrice70": round(statistics.mean(prices)),
        "medianPrice70": round(statistics.median(prices)),
    }


# ──────────────────────────────────────────────
# Step 3: Geocoding (OpenStreetMap Nominatim)
# ──────────────────────────────────────────────

CACHE_PATH = Path(__file__).parent / "geocode_cache.json"


def load_geocode_cache() -> dict:
    if CACHE_PATH.exists():
        return json.loads(CACHE_PATH.read_text("utf-8"))
    return {}


def save_geocode_cache(cache: dict):
    CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2), "utf-8")


def geocode_station(name: str, cache: dict) -> tuple[float, float] | None:
    if name in cache:
        c = cache[name]
        return (c["lat"], c["lng"]) if c else None

    query = f"{name}駅 埼玉県"
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode({
        "q": query, "format": "json", "limit": 1, "countrycodes": "jp"
    })
    req = urllib.request.Request(url, headers={"User-Agent": "SaitamaMansionMap/1.0"})

    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read())
        if data:
            lat, lng = float(data[0]["lat"]), float(data[0]["lon"])
            cache[name] = {"lat": lat, "lng": lng}
            save_geocode_cache(cache)
            return (lat, lng)
        else:
            # retry without 埼玉県
            query2 = f"{name}駅"
            url2 = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode({
                "q": query2, "format": "json", "limit": 1, "countrycodes": "jp"
            })
            req2 = urllib.request.Request(url2, headers={"User-Agent": "SaitamaMansionMap/1.0"})
            time.sleep(1.1)
            with urllib.request.urlopen(req2) as resp2:
                data2 = json.loads(resp2.read())
            if data2:
                lat, lng = float(data2[0]["lat"]), float(data2[0]["lon"])
                cache[name] = {"lat": lat, "lng": lng}
                save_geocode_cache(cache)
                return (lat, lng)
            cache[name] = None
            save_geocode_cache(cache)
            return None
    except Exception as e:
        print(f"  [WARN] Geocode failed for '{name}': {e}")
        cache[name] = None
        save_geocode_cache(cache)
        return None
    finally:
        time.sleep(1.1)  # Nominatim rate limit


# ──────────────────────────────────────────────
# Step 4: エリア分類
# ──────────────────────────────────────────────

def determine_area(municipalities: set[str]) -> str:
    for m in municipalities:
        if m in AREA_MAP:
            return AREA_MAP[m]
    return "その他"


# ──────────────────────────────────────────────
# Step 5: TypeScript出力
# ──────────────────────────────────────────────

def generate_ts(station_list: list[dict], output_path: str):
    lines = [
        'import type { StationData } from "@/lib/types";',
        "",
        "export const stationData: StationData[] = ",
    ]

    json_str = json.dumps(station_list, ensure_ascii=False, indent=2)
    lines.append(json_str + ";")

    Path(output_path).write_text("\n".join(lines), "utf-8")


# ──────────────────────────────────────────────
# Step 6: 駅別取引JSON出力（T-120）
# ──────────────────────────────────────────────

def write_transactions(result: list[dict], records: list[dict], output_dir: Path) -> int:
    """
    駅別の個別取引データを public/transactions/{stationCode}.json に出力する。
    各ファイルは取引時期の降順でソートされたリスト。
    """
    output_dir.mkdir(parents=True, exist_ok=True)

    # stationName → stationCode のマップ
    code_map = {s["stationName"]: s["stationCode"] for s in result}

    # station_display → 取引レコードリスト
    station_records: dict[str, list] = defaultdict(list)
    for r in records:
        display = r["station_display"]
        if display in code_map:
            station_records[display].append(r)

    written = 0
    for station in result:
        name = station["stationName"]
        code = station["stationCode"]
        txs = station_records.get(name, [])

        transactions = []
        for r in sorted(txs, key=lambda x: x["period"], reverse=True):
            transactions.append({
                "price": r["price"],
                "area": r["area"],
                "unitPrice": r["unit_price"],
                "buildingYear": r["building_year"],
                "age": r["age"],
                "floorPlan": r["floor_plan"],
                "structure": r["structure"],
                "district": r["district"],
                "period": r["period"],
                "walkMinutes": r["walk_minutes"],
            })

        out_path = output_dir / f"{code}.json"
        out_path.write_text(
            json.dumps(transactions, ensure_ascii=False),
            "utf-8"
        )
        written += 1

    return written


# ──────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 process_data.py <csv_path>")
        sys.exit(1)

    csv_path = sys.argv[1]
    root = Path(__file__).parent.parent
    output_path = root / "src" / "data" / "stations.ts"
    transactions_dir = root / "public" / "transactions"

    print(f"[1/6] Loading CSV: {csv_path}")
    records = load_csv(csv_path)
    print(f"  → {len(records)} records loaded")

    print(f"[2/6] Aggregating by station...")
    stations = aggregate(records)
    print(f"  → {len(stations)} unique stations")

    print(f"[3/6] Geocoding stations (Nominatim, ~1s per station)...")
    cache = load_geocode_cache()
    cached_count = sum(1 for s in stations if normalize_station_name(s) in cache)
    need_geocode = len(stations) - cached_count
    print(f"  → {cached_count} cached, {need_geocode} to geocode (~{need_geocode}s)")

    print(f"[4/6] Building station data...")
    all_years = sorted(set(r["year"] for r in records if r["year"]))
    print(f"  → Years in data: {all_years}")

    result = []
    age_cats = ["all", "age_0_10", "age_11_20", "age_21_30", "age_31_plus"]
    skipped = []

    for i, (raw_name, sdata) in enumerate(sorted(stations.items(), key=lambda x: -len(x[1]["years"].get(all_years[-1], {}).get("all", [])))):
        display = sdata["display"]
        coords = geocode_station(display, cache)
        if not coords:
            skipped.append(display)
            continue

        lat, lng = coords
        area = determine_area(sdata["municipalities"])

        years_obj = {}
        for y in all_years:
            y_data = sdata["years"].get(y, {})
            year_stats = {}
            for cat in age_cats:
                year_stats[cat] = compute_stats(y_data.get(cat, []))
            years_obj[y] = year_stats

        total_count = sum(
            years_obj.get(y, {}).get("all", {}).get("count", 0) for y in all_years
        )
        if total_count < 3:
            skipped.append(f"{display} (件数不足: {total_count})")
            continue

        code = f"R{i:04d}"
        result.append({
            "stationCode": code,
            "stationName": display,
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "lines": [],
            "area": area,
            "years": years_obj,
        })

        if (i + 1) % 20 == 0:
            print(f"  ... {i + 1}/{len(stations)} processed")

    print(f"  → {len(result)} stations with coordinates")
    if skipped:
        print(f"  → {len(skipped)} skipped: {skipped[:10]}{'...' if len(skipped) > 10 else ''}")

    print(f"[5/6] Writing {output_path}")
    generate_ts(result, str(output_path))
    print(f"  → Done! {len(result)} stations written")

    print(f"[6/6] Writing transaction JSONs → {transactions_dir}/")
    written = write_transactions(result, records, transactions_dir)
    print(f"  → {written} files written")

    # Summary
    print(f"\n=== Summary ===")
    print(f"  Records: {len(records)}")
    print(f"  Stations: {len(result)}")
    print(f"  Years: {all_years}")
    print(f"  Output (stations): {output_path}")
    print(f"  Output (transactions): {transactions_dir}/ ({written} files)")


if __name__ == "__main__":
    main()
