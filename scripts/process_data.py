#!/usr/bin/env python3
"""
国土交通省 不動産取引価格情報CSV → stations.ts + transactions JSON 変換スクリプト
関東各県（埼玉・千葉・神奈川・茨城・栃木・群馬）対応

Usage:
  # 単一ファイル
  python3 scripts/process_data.py data/raw/foo.csv

  # 複数ファイル（glob展開）
  python3 scripts/process_data.py data/raw/*.csv

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

# 都道府県コードプレフィックス（stationCode に使用）
PREF_CODE = {
    "埼玉県": "R",
    "千葉県": "C",
    "神奈川県": "K",
    "茨城県": "I",
    "栃木県": "T",
    "群馬県": "G",
    "東京都": "TK",
}

AREA_MAP = {
    # ── 埼玉県 ─────────────────────────────────
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
    # ── 神奈川県 ────────────────────────────────
    "横浜市鶴見区": "横浜市",
    "横浜市神奈川区": "横浜市",
    "横浜市西区": "横浜市",
    "横浜市中区": "横浜市",
    "横浜市南区": "横浜市",
    "横浜市保土ケ谷区": "横浜市",
    "横浜市磯子区": "横浜市",
    "横浜市金沢区": "横浜市",
    "横浜市港北区": "横浜市",
    "横浜市戸塚区": "横浜市",
    "横浜市港南区": "横浜市",
    "横浜市旭区": "横浜市",
    "横浜市緑区": "横浜市",
    "横浜市瀬谷区": "横浜市",
    "横浜市栄区": "横浜市",
    "横浜市泉区": "横浜市",
    "横浜市青葉区": "横浜市",
    "横浜市都筑区": "横浜市",
    "川崎市川崎区": "川崎市",
    "川崎市幸区": "川崎市",
    "川崎市中原区": "川崎市",
    "川崎市高津区": "川崎市",
    "川崎市多摩区": "川崎市",
    "川崎市宮前区": "川崎市",
    "川崎市麻生区": "川崎市",
    "相模原市緑区": "相模原市",
    "相模原市中央区": "相模原市",
    "相模原市南区": "相模原市",
    "横須賀市": "横須賀・三浦",
    "三浦市": "横須賀・三浦",
    "藤沢市": "湘南",
    "茅ヶ崎市": "湘南",
    "鎌倉市": "湘南",
    "逗子市": "湘南",
    "葉山町": "湘南",
    "大和市": "県央",
    "海老名市": "県央",
    "座間市": "県央",
    "綾瀬市": "県央",
    "厚木市": "県央",
    "平塚市": "県央",
    "秦野市": "県央",
    "伊勢原市": "県央",
    "小田原市": "小田原・足柄",
    "南足柄市": "小田原・足柄",
    "開成町": "小田原・足柄",
    "愛川町": "県央",
    "清川村": "県央",
    # ── 千葉県 ──────────────────────────────────
    "千葉市中央区": "千葉市",
    "千葉市花見川区": "千葉市",
    "千葉市稲毛区": "千葉市",
    "千葉市若葉区": "千葉市",
    "千葉市緑区": "千葉市",
    "千葉市美浜区": "千葉市",
    "船橋市": "船橋・習志野",
    "習志野市": "船橋・習志野",
    "鎌ケ谷市": "船橋・習志野",
    "市川市": "市川・浦安",
    "浦安市": "市川・浦安",
    "松戸市": "松戸・流山",
    "流山市": "松戸・流山",
    "野田市": "松戸・流山",
    "柏市": "柏・我孫子",
    "我孫子市": "柏・我孫子",
    "白井市": "柏・我孫子",
    "印西市": "柏・我孫子",
    "八千代市": "八千代・佐倉",
    "佐倉市": "八千代・佐倉",
    "四街道市": "八千代・佐倉",
    "成田市": "成田",
    "市原市": "木更津・君津",
    "木更津市": "木更津・君津",
    "袖ケ浦市": "木更津・君津",
    "君津市": "木更津・君津",
    # ── 茨城県 ──────────────────────────────────
    "つくば市": "つくば",
    "守谷市": "つくば",
    "つくばみらい市": "つくば",
    "土浦市": "土浦・牛久",
    "牛久市": "土浦・牛久",
    "稲敷郡阿見町": "土浦・牛久",
    "かすみがうら市": "土浦・牛久",
    "取手市": "取手・龍ケ崎",
    "龍ケ崎市": "取手・龍ケ崎",
    "水戸市": "水戸",
    "ひたちなか市": "水戸",
    "那珂郡東海村": "水戸",
    "古河市": "古河",
    "結城市": "古河",
    "日立市": "日立",
    "高萩市": "日立",
    "鹿嶋市": "鹿嶋・神栖",
    "神栖市": "鹿嶋・神栖",
    "笠間市": "水戸",
    "潮来市": "鹿嶋・神栖",
    "鉾田市": "鹿嶋・神栖",
    # ── 栃木県 ──────────────────────────────────
    "宇都宮市": "宇都宮",
    "芳賀郡益子町": "宇都宮",
    "真岡市": "宇都宮",
    "下野市": "小山・下野",
    "小山市": "小山・下野",
    "足利市": "足利",
    "佐野市": "足利",
    "栃木市": "小山・下野",
    "日光市": "日光・那須",
    "那須塩原市": "日光・那須",
    "那須郡那須町": "日光・那須",
    "那須烏山市": "日光・那須",
    # ── 群馬県 ──────────────────────────────────
    "高崎市": "高崎",
    "前橋市": "前橋",
    "伊勢崎市": "前橋",
    "太田市": "太田・桐生",
    "桐生市": "太田・桐生",
    "館林市": "館林",
    "吾妻郡長野原町": "吾妻郡（草津・嬬恋）",
    "吾妻郡草津町": "吾妻郡（草津・嬬恋）",
    "吾妻郡嬬恋村": "吾妻郡（草津・嬬恋）",
    "利根郡みなかみ町": "利根郡（水上）",
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
            prefecture = row.get("都道府県名", "埼玉県").strip()

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
                "prefecture": prefecture,
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
        "prefecture_counts": defaultdict(int),
        "years": defaultdict(lambda: defaultdict(list)),
        "walk_minutes": [],
    })

    for r in records:
        key = r["station_raw"]
        s = stations[key]
        s["display"] = r["station_display"]
        s["municipalities"].add(r["municipality"])
        s["prefecture_counts"][r["prefecture"]] += 1
        year = r["year"]
        s["years"][year]["all"].append(r["price_70"])
        s["years"][year][r["age_cat"]].append(r["price_70"])
        if r["walk_minutes"] is not None:
            s["walk_minutes"].append(r["walk_minutes"])

    return stations


def compute_stats(prices: list[float]) -> dict:
    if not prices:
        return {"count": 0, "avgPrice70": 0, "medianPrice70": 0}
    return {
        "count": len(prices),
        "avgPrice70": round(statistics.mean(prices)),
        "medianPrice70": round(statistics.median(prices)),
    }


def get_prefecture(sdata: dict) -> str:
    """駅の主要都道府県を返す（最多取引数の都道府県）"""
    counts = sdata["prefecture_counts"]
    if not counts:
        return "埼玉県"
    return max(counts, key=counts.get)


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


def geocode_station(name: str, prefecture: str, cache: dict) -> tuple[float, float] | None:
    # 新フォーマットのキー: "{name}__{prefecture}"
    new_key = f"{name}__{prefecture}"
    # 旧フォーマットの後方互換（埼玉県のみ）
    old_key = name

    if new_key in cache:
        c = cache[new_key]
        return (c["lat"], c["lng"]) if c else None
    # 旧キャッシュのマイグレーション（埼玉県）
    if prefecture == "埼玉県" and old_key in cache and old_key not in (k.split("__")[0] for k in cache if "__" in k):
        c = cache[old_key]
        if c:
            cache[new_key] = c
            save_geocode_cache(cache)
            return (c["lat"], c["lng"])

    query = f"{name}駅 {prefecture}"
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode({
        "q": query, "format": "json", "limit": 1, "countrycodes": "jp"
    })
    req = urllib.request.Request(url, headers={"User-Agent": "KantoMansionMap/1.0"})

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
        if data:
            lat, lng = float(data[0]["lat"]), float(data[0]["lon"])
            cache[new_key] = {"lat": lat, "lng": lng}
            save_geocode_cache(cache)
            return (lat, lng)
        else:
            # retry without prefecture
            query2 = f"{name}駅"
            url2 = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode({
                "q": query2, "format": "json", "limit": 1, "countrycodes": "jp"
            })
            req2 = urllib.request.Request(url2, headers={"User-Agent": "KantoMansionMap/1.0"})
            time.sleep(1.1)
            with urllib.request.urlopen(req2, timeout=10) as resp2:
                data2 = json.loads(resp2.read())
            if data2:
                lat, lng = float(data2[0]["lat"]), float(data2[0]["lon"])
                cache[new_key] = {"lat": lat, "lng": lng}
                save_geocode_cache(cache)
                return (lat, lng)
            cache[new_key] = None
            save_geocode_cache(cache)
            return None
    except Exception as e:
        print(f"  [WARN] Geocode failed for '{name}' ({prefecture}): {e}")
        cache[new_key] = None
        save_geocode_cache(cache)
        return None
    finally:
        time.sleep(1.1)  # Nominatim rate limit


# ──────────────────────────────────────────────
# Step 4: エリア分類
# ──────────────────────────────────────────────

def determine_area(municipalities: set[str], prefecture: str) -> str:
    for m in municipalities:
        if m in AREA_MAP:
            return AREA_MAP[m]
    # AREA_MAPにない場合: 市区町村名をそのまま使用（郡・町・村は市名部分を抽出）
    for m in municipalities:
        if m:
            # 郡名を含む場合は郡名を除去
            clean = re.sub(r"^\S+郡", "", m).strip()
            return clean if clean else m
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

    # stationName + prefecture → stationCode のマップ
    code_map: dict[tuple[str, str], str] = {
        (s["stationName"], s.get("prefecture", "埼玉県")): s["stationCode"]
        for s in result
    }

    # (station_display, prefecture) → 取引レコードリスト
    station_records: dict[tuple[str, str], list] = defaultdict(list)
    for r in records:
        key = (r["station_display"], r["prefecture"])
        if key in code_map:
            station_records[key].append(r)

    written = 0
    for station in result:
        name = station["stationName"]
        pref = station.get("prefecture", "埼玉県")
        code = station["stationCode"]
        txs = station_records.get((name, pref), [])

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
        print("Usage: python3 process_data.py <csv_path> [csv_path2 ...]")
        sys.exit(1)

    csv_paths = sys.argv[1:]
    root = Path(__file__).parent.parent
    output_path = root / "src" / "data" / "stations.ts"
    transactions_dir = root / "public" / "transactions"

    print(f"[1/6] Loading {len(csv_paths)} CSV file(s)...")
    records = []
    for csv_path in sorted(csv_paths):
        batch = load_csv(csv_path)
        print(f"  {Path(csv_path).name}: {len(batch)} records")
        records.extend(batch)
    print(f"  → {len(records)} records total")

    print(f"[2/6] Aggregating by station...")
    stations = aggregate(records)
    print(f"  → {len(stations)} unique stations")

    print(f"[3/6] Geocoding stations (Nominatim, ~1s per station)...")
    cache = load_geocode_cache()
    # キャッシュヒット数を推定（新旧両フォーマット考慮）
    cached_count = 0
    for raw_name, sdata in stations.items():
        display = sdata["display"]
        pref = get_prefecture(sdata)
        new_key = f"{display}__{pref}"
        old_key = display
        if new_key in cache or (pref == "埼玉県" and old_key in cache):
            cached_count += 1
    need_geocode = len(stations) - cached_count
    print(f"  → {cached_count} cached, {need_geocode} to geocode (~{need_geocode}s)")

    print(f"[4/6] Building station data...")
    all_years = sorted(set(r["year"] for r in records if r["year"]))
    print(f"  → Years in data: {all_years}")

    age_cats = ["all", "age_0_10", "age_11_20", "age_21_30", "age_31_plus"]

    # 都道府県ごとにグループ化してから処理（コード割り当てのため）
    # key: prefecture, value: list of (raw_name, sdata, latest_count)
    pref_groups: dict[str, list] = defaultdict(list)
    for raw_name, sdata in stations.items():
        pref = get_prefecture(sdata)
        latest_count = len(sdata["years"].get(all_years[-1], {}).get("all", []))
        pref_groups[pref].append((raw_name, sdata, latest_count))

    # 各都道府県内で最近の取引数降順にソート
    for pref in pref_groups:
        pref_groups[pref].sort(key=lambda x: -x[2])

    result = []
    skipped = []
    total = len(stations)
    processed = 0

    # PREF_CODEに定義された順序で処理（未定義の県はスキップ）
    pref_order = list(PREF_CODE.keys())
    unknown_prefs = [p for p in pref_groups if p not in PREF_CODE]
    if unknown_prefs:
        print(f"  [WARN] Unknown prefectures: {unknown_prefs}")

    for pref in pref_order + unknown_prefs:
        if pref not in pref_groups:
            continue
        prefix = PREF_CODE.get(pref, "X")
        stations_in_pref = pref_groups[pref]

        for i, (raw_name, sdata, _) in enumerate(stations_in_pref):
            display = sdata["display"]
            coords = geocode_station(display, pref, cache)
            processed += 1
            if not coords:
                skipped.append(f"{display} ({pref})")
                continue

            lat, lng = coords
            area = determine_area(sdata["municipalities"], pref)

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
                skipped.append(f"{display} ({pref}, 件数不足: {total_count})")
                continue

            code = f"{prefix}{i:04d}"
            walk_list = sdata["walk_minutes"]
            median_walk = round(statistics.median(walk_list)) if walk_list else None

            entry: dict = {
                "stationCode": code,
                "stationName": display,
                "lat": round(lat, 6),
                "lng": round(lng, 6),
                "lines": [],
                "area": area,
                "prefecture": pref,
                "years": years_obj,
            }
            if median_walk is not None:
                entry["medianWalkMinutes"] = median_walk

            result.append(entry)

            if processed % 20 == 0:
                print(f"  ... {processed}/{total} processed")

    print(f"  → {len(result)} stations with coordinates")
    if skipped:
        print(f"  → {len(skipped)} skipped: {skipped[:10]}{'...' if len(skipped) > 10 else ''}")

    print(f"[5/6] Writing {output_path}")
    generate_ts(result, str(output_path))
    print(f"  → Done! {len(result)} stations written")

    print(f"[6/6] Writing transaction JSONs → {transactions_dir}/")
    written = write_transactions(result, records, transactions_dir)
    print(f"  → {written} files written")

    # Summary by prefecture
    print(f"\n=== Summary ===")
    print(f"  Records: {len(records)}")
    print(f"  Stations: {len(result)}")
    print(f"  Years: {all_years}")
    for pref in pref_order:
        pref_stations = [s for s in result if s.get("prefecture") == pref]
        pref_records = [r for r in records if r["prefecture"] == pref]
        if pref_stations:
            print(f"  {pref}: {len(pref_stations)} stations / {len(pref_records)} records")
    print(f"  Output (stations): {output_path}")
    print(f"  Output (transactions): {transactions_dir}/ ({written} files)")


if __name__ == "__main__":
    main()
