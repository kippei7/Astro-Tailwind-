import {
  completeByAreaNameAction,
  resetDemoDataAction,
  runNightlyRescheduleAction,
  updateUserNameAction,
} from "@/lib/actions";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getStore } from "@/lib/store";
import { SubmitButton } from "@/components/SubmitButton";

export default async function SettingsPage() {
  const store = await getStore();
  const supabase = isSupabaseConfigured();
  const gcal = Boolean(process.env.GOOGLE_CALENDAR_CLIENT_ID);

  return (
    <div className="space-y-8">
      <header>
        <p className="page-kicker">SETTINGS</p>
        <h1 className="page-title">設定とデモ操作</h1>
        <p className="page-lead">
          Phase 1 はローカル JSON ストアで動きます。Supabase / Google Calendar / Alexa は接続状況をここで確認できます。
        </p>
      </header>

      <section className="card space-y-4">
        <h2 className="font-display text-2xl">メンバー</h2>
        {store.users.map((user) => (
          <form
            key={user.id}
            action={updateUserNameAction.bind(null, user.id)}
            className="flex flex-wrap items-center gap-2"
          >
            <span
              className="h-3 w-3 rounded-full"
              style={{ background: user.color }}
            />
            <input
              name="name"
              defaultValue={user.name}
              className="min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-white px-3 py-2"
            />
            <SubmitButton className="btn-secondary">保存</SubmitButton>
          </form>
        ))}
      </section>

      <section className="card space-y-3">
        <h2 className="font-display text-2xl">連携ステータス</h2>
        <StatusRow label="データストア" value={supabase ? "Supabase 接続済み" : "ローカル JSON（Phase 1）"} ok={supabase} />
        <StatusRow label="Google Calendar" value={gcal ? "OAuth 設定あり" : "未設定（Phase 2）"} ok={gcal} />
        <StatusRow label="Alexa / Lambda" value="API は用意済み。スキルは Phase 4" ok={false} />
      </section>

      <section className="card space-y-4">
        <h2 className="font-display text-2xl">デモ操作</h2>
        <p className="text-sm text-[var(--muted)]">
          深夜バッチと Alexa 消し込みを、接続前でも手元で確認できます。
        </p>
        <form
          action={async () => {
            "use server";
            await runNightlyRescheduleAction();
          }}
        >
          <SubmitButton className="btn-secondary">未完了タスクを自動リスケ（2:00相当）</SubmitButton>
        </form>
        <form
          action={async () => {
            "use server";
            await completeByAreaNameAction("ドラム式");
          }}
        >
          <SubmitButton className="btn-secondary">
            「ドラム式」の今日のタスクを完了（Alexa相当）
          </SubmitButton>
        </form>
        <form action={resetDemoDataAction}>
          <SubmitButton className="btn-danger">デモデータを初期化</SubmitButton>
        </form>
      </section>

      <section className="card space-y-3 text-sm leading-7 text-[var(--ink-soft)]">
        <h2 className="font-display text-2xl text-[var(--ink)]">ロードマップ</h2>
        <p>Phase 1 · 基盤構築（このフォルダ）— ダッシュボード、CRUD、ポイント、滞留アラート</p>
        <p>Phase 2 · Google Calendar OAuth と予定の双方向更新</p>
        <p>Phase 3 · Vercel Cron / pg_cron による自動リスケ</p>
        <p>Phase 4 · Alexa カスタムスキル → `/api/voice/complete`</p>
      </section>
    </div>
  );
}

function StatusRow({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--line)] py-2 last:border-0">
      <span className="font-medium">{label}</span>
      <span className={ok ? "text-[var(--forest)]" : "text-[var(--muted)]"}>{value}</span>
    </div>
  );
}
