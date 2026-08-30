# CleanSync 要件定義・実装方針

## 1. プロダクト概要

- **目的:** 夫婦間の掃除タスクの実行量をポイント化して可視化し、客観的データに基づく建設的な交渉（自由時間やご褒美の獲得）を支援する。
- **ペルソナ:** 育児中で手が塞がりがちだが、新居を綺麗に保ちたい夫婦。
- **コアバリュー:**
  - ハンズフリーでの実績入力（Alexa連携）
  - タスクの形骸化を防ぐ自動リスケジュール
  - カレンダー連動による予定の透明化

## 2. 推奨技術スタック

- **フロントエンド:** Next.js (TypeScript, App Router), Tailwind CSS, Recharts
- **バックエンド / DB:** Supabase (PostgreSQL, Auth, Edge Functions, pg_cron)
- **デプロイ:** Vercel
- **外部連携:** Google Calendar API / Alexa Skills Kit + AWS Lambda

## 3. データベース設計

- `users` — `id`, `name`, `total_points`
- `areas` — `id`, `name`
- `task_master` — `id`, `area_id`, `name`, `description`, `points`, `reschedule_rule` (`NEXT_DAY` | `NEXT_WEEKEND`)
- `task_events` — `id`, `task_id`, `assigned_user_id`, `scheduled_date`, `completed_at`, `status` (`TODO` | `DONE` | `CANCELLED`), `gcal_event_id`, `reschedule_count`

PostgreSQL 定義は `supabase/migrations/` を参照。

## 4. コア機能

1. **ダッシュボード** — 夫婦の今月ポイント比較。滞留（`reschedule_count >= 3`）は 1.2 倍。
2. **Googleカレンダー同期** — 作成時に eventId を保存。完了時はタイトルに「【済】」、色をグレーへ。設定画面から OAuth 接続。
3. **Alexa** — Phase 4。エリア名から本日（および期限超過）の未完了を完了。
4. **自動リスケ** — 毎日 2:00（JST）。`TODO` かつ予定日が昨日以前のものをルールに従って移動。

## 5. ロードマップ

- Phase 1: Web MVP（ダッシュボード、CRUD、月カレンダー）
- Phase 2: Google Calendar OAuth と予定同期（実装済み）
- Phase 3: Cron 自動化
- Phase 4: 音声インターフェース
