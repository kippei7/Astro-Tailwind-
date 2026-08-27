# CleanSync

夫婦の掃除タスクをポイント化して可視化し、自由時間やご褒美の交渉を数字で始められるようにするアプリです。

このフォルダは独立した Next.js アプリです。専用 GitHub リポジトリへ切り出す前提で、親リポジトリとは分離して開発します。

## Phase 1（Web MVP）でできること

- 今月の獲得ポイントを夫婦で比較（Recharts）
- エリア / タスク定義 / 予定の CRUD
- 手順メモ付きの完了・キャンセル・手動リスケ
- 3回以上リスケしたタスクの滞留アラート（完了時 1.2 倍）
- 深夜バッチ相当の自動リスケ（設定画面 or `/api/cron/reschedule`）
- Alexa 相当のエリア完了 API（`POST /api/voice/complete`）

データはまだ Supabase 未接続でも動くよう、ローカル JSON（`data/store.json`）に保存します。スキーマは `supabase/migrations/` に PostgreSQL 版を置いてあります。

## 起動

```bash
cd cleansync
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000) を開きます。

## 技術スタック

| 層 | 採用 |
| --- | --- |
| フロント | Next.js (App Router, TypeScript), Tailwind CSS, Recharts |
| データ | Phase 1: ローカル JSON。本番: Supabase (PostgreSQL, Auth, Edge Functions, pg_cron) |
| デプロイ | Vercel（`vercel.json` に JST 2:00 = UTC 17:00 の Cron を定義） |
| 外部連携 | Google Calendar（Phase 2）、Alexa + Lambda（Phase 4） |

## 環境変数

`.env.example` をコピーして使います。Phase 1 では空のままで動作します。

## ロードマップ

1. **Phase 1** 基盤構築 — この MVP
2. **Phase 2** Google Calendar OAuth と予定の双方向更新
3. **Phase 3** Cron による自動リスケとカレンダー日付更新
4. **Phase 4** Alexa カスタムスキル → `POST /api/voice/complete`

Alexa 発話例: 「アレクサ、掃除管理で『ドラム式』を完了して」
