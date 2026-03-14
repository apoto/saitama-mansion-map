# 埼玉県 中古マンション・戸建 相場マップ

埼玉県内の不動産（中古マンション・戸建）の取引価格を、駅ごとにマップ上で可視化するWebアプリ。

**「データで、住む街を選ぶ」** — 希望条件で絞り込みながらエリアを比較し、気になった駅の取引実績やAI分析を確認して、購入エリアの意思決定を支援する。

## デモ

`npm run dev` → http://localhost:3000

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| フロントエンド | Next.js 15 (App Router) + TypeScript |
| 地図 | React-Leaflet + OpenStreetMap |
| スタイリング | Tailwind CSS |
| データ加工 | Python |
| データソース | 国土交通省 不動産情報ライブラリ |
| デプロイ | Vercel (予定) |

## セットアップ

```bash
npm install
npm run dev
```

### データ再生成

国交省CSVからの再生成が必要な場合:

```bash
python3 scripts/process_data.py data/raw/Saitama\ Prefecture_20244_20253_中古マンション.csv
```

## プロジェクト構成

```
saitama-mansion-map/
├── docs/                    # 設計ドキュメント
│   ├── 00_プロジェクト概要.md  # ビジョン・機能一覧・Phase定義
│   ├── 01_設計書.md           # アーキテクチャ・データモデル・UI設計
│   ├── 02_TODO.md             # 開発タスク一覧（Phase別）
│   └── images/                # 参考画像
├── data/
│   └── raw/                   # 国交省CSVデータ（元データ）
├── scripts/
│   ├── process_data.py        # CSV → stations.ts 変換
│   └── geocode_cache.json     # Nominatim座標キャッシュ
├── src/
│   ├── app/                   # Next.js App Router
│   ├── components/            # React コンポーネント
│   │   ├── MapView.tsx        # 地図（React-Leaflet）
│   │   ├── StationMarkers.tsx # 駅マーカー（色=価格帯, サイズ=件数）
│   │   ├── FilterPanel.tsx    # フィルタUI
│   │   └── AreaList.tsx       # エリア別駅リスト
│   ├── data/
│   │   └── stations.ts        # 駅別集計データ（148駅, 実データ）
│   └── lib/
│       ├── types.ts           # 型定義
│       ├── constants.ts       # 定数（価格帯・エリア分類）
│       └── utils.ts           # フィルタ・計算ロジック
└── public/
```

## 設計ドキュメント

| ドキュメント | 内容 |
|---|---|
| [docs/00_プロジェクト概要.md](docs/00_プロジェクト概要.md) | ビジョン・機能一覧・Phase定義 |
| [docs/01_設計書.md](docs/01_設計書.md) | アーキテクチャ・データモデル・画面設計・AI機能設計 |
| [docs/02_TODO.md](docs/02_TODO.md) | 開発タスク一覧（Phase 1〜6） |

## 開発ロードマップ

| Phase | 内容 | 状態 |
|-------|------|------|
| 1 | MVP（マップ+フィルタ+実データ148駅） | ✅ 完了 |
| 2 | フィルタ強化（築年数マルチ選択・面積切替・取引詳細） | 📋 次 |
| 3 | AI機能（傾向分析・物件コンシェルジュ） | 📋 |
| 4 | デプロイ（Vercel） | 📋 |
| 5 | 予算シミュレーター + 憧れエリア提案 | 📋 |
| 6 | ハザードマップ・物件リンク・不動産屋連携 | 📋 |

## データソース

- **国土交通省 不動産情報ライブラリ**: https://www.reinfolib.mlit.go.jp/
  - 中古マンション等: 7,625件（2024Q4〜2025Q3）
  - 宅地（土地と建物）: 16,036件（同期間、未使用）
- **OpenStreetMap Nominatim**: 駅座標のジオコーディング

## 参考

- [リバベル都市開発研究所2.0](https://city-development-research.vercel.app/souba) — 都内中古マンション相場マップ
