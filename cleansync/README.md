# CleanSync

夫婦の掃除タスクをポイント化して可視化し、自由時間やご褒美の交渉を数字で始められるようにするアプリです。

このフォルダは **独立した Next.js アプリ** です。親リポジトリ（Astro の店舗サイト）とは分離して開発し、専用 GitHub リポジトリへ切り出せます。

要件の全文は [docs/REQUIREMENTS.md](./docs/REQUIREMENTS.md) にあります。

## Phase 2（Google カレンダー）

- 設定画面から Google アカウントを OAuth 接続
- 予定作成時に終日イベントを追加し `gcal_event_id` を保存
- 完了時はタイトルに「【済】」、色をグレー（colorId 8）
- リスケで日付更新、キャンセルでイベント削除
- 資格情報の前に試す場合は `GCAL_MOCK=1`

手順は [docs/GOOGLE_CALENDAR.md](./docs/GOOGLE_CALENDAR.md) を参照してください。

## Phase 1（Web MVP）でできること

- 今月の獲得ポイントを夫婦で比較（Recharts）し、リード差を交渉メモとして表示
- エリア / タスク定義 / 予定の CRUD
- 予定タブの月カレンダー（日付クリックで確認・追加）
- 手順メモ付きの完了・キャンセル・手動リスケ
- 3回以上リスケしたタスクの滞留アラート（完了時 1.2 倍）
- 深夜バッチ相当の自動リスケ（設定画面 or `/api/cron/reschedule`）
- Alexa 相当のエリア完了 API（`POST /api/voice/complete`、部分一致あり）

データはまだ Supabase 未接続でも動くよう、ローカル JSON（`data/store.json`）に保存します。スキーマは `supabase/migrations/` に PostgreSQL 版を置いてあります。

## 起動

```bash
cd cleansync
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開きます。

```bash
npm test    # ポイント・リスケ・音声マッチのユニットテスト
npm run build
```

## 技術スタック

| 層 | 採用 |
| --- | --- |
| フロント | Next.js (App Router, TypeScript), Tailwind CSS, Recharts |
| データ | Phase 1: ローカル JSON。本番: Supabase (PostgreSQL, Auth, Edge Functions, pg_cron) |
| デプロイ | Vercel（`vercel.json` に JST 2:00 = UTC 17:00 の Cron を定義） |
| 外部連携 | Google Calendar（Phase 2 OAuth）、Alexa + Lambda（Phase 4） |

## 環境変数

`.env.example` をコピーして使います。Phase 1 では空のままで動作します。

## 専用リポジトリへの切り出し

`cleansync/` 配下がアプリのルートです。新しい GitHub リポジトリを作ったら、このフォルダの内容をルートにコピー（または `git subtree` / 履歴なしの初期 push）してください。

```bash
cd cleansync
git init
git add .
git commit -m "Initial commit: CleanSync Phase 1 Web MVP"
git remote add origin git@github.com:<you>/cleansync.git
git push -u origin main
```

## ロードマップ

1. **Phase 1** 基盤構築 — この MVP
2. **Phase 2** Google Calendar OAuth と予定の双方向更新
3. **Phase 3** Cron による自動リスケとカレンダー日付更新
4. **Phase 4** Alexa カスタムスキル → `POST /api/voice/complete`

Alexa 発話例: 「アレクサ、掃除管理で『ドラム式』を完了して」
