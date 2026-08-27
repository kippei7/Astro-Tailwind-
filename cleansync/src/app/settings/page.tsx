import {
  completeByAreaNameAction,
  disconnectGoogleAction,
  pushUnsyncedEventsAction,
  resetDemoDataAction,
  runNightlyRescheduleAction,
  updateUserNameAction,
} from "@/lib/actions";
import { isGoogleConfigured, isGoogleConnected } from "@/lib/gcal";
import { isMockCalendar, isOAuthConfigured } from "@/lib/gcal-oauth";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getStore } from "@/lib/store";
import { SubmitButton } from "@/components/SubmitButton";

const GCAL_FLASH: Record<string, string> = {
  connected: "Googleカレンダーを接続しました。これから作る予定が同期されます。",
  mock: "モック連携を開始しました。予定の作成・完了・リスケが同期ログに残ります。",
  error: "Googleカレンダーの接続に失敗しました。リダイレクトURIとクライアント設定を確認してください。",
  missing_env: "GOOGLE_CALENDAR_CLIENT_ID / SECRET が未設定です。.env を確認してください。",
  disconnected: "Googleカレンダー連携を解除しました。",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ gcal?: string }>;
}) {
  const params = await searchParams;
  const store = await getStore();
  const supabase = isSupabaseConfigured();
  const oauthReady = isOAuthConfigured();
  const mock = isMockCalendar();
  const configured = isGoogleConfigured();
  const connected = await isGoogleConnected();
  const unsynced = store.task_events.filter(
    (event) => !event.gcal_event_id && event.status !== "CANCELLED",
  ).length;
  const flash = params.gcal ? GCAL_FLASH[params.gcal] : null;

  return (
    <div className="space-y-8">
      <header>
        <p className="page-kicker">SETTINGS</p>
        <h1 className="page-title">設定とデモ操作</h1>
        <p className="page-lead">
          Phase 2 では世帯の Google カレンダーへ掃除予定を同期します。未設定でもアプリは動きます。
        </p>
      </header>

      {flash ? (
        <p className="card text-sm leading-6 text-[var(--ink-soft)]">{flash}</p>
      ) : null}

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

      <section className="card space-y-4">
        <h2 className="font-display text-2xl">Google カレンダー</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">
          予定を作ると終日イベントを追加し、完了時はタイトルに「【済】」を付けて色をグレー（colorId 8）にします。リスケすると日付も更新します。
        </p>
        <StatusRow
          label="OAuth クライアント"
          value={
            mock
              ? "GCAL_MOCK=1（デモ）"
              : oauthReady
                ? "設定済み"
                : "未設定"
          }
          ok={configured}
        />
        <StatusRow
          label="接続アカウント"
          value={
            connected
              ? store.google.email ?? "接続済み"
              : "未接続"
          }
          ok={connected}
        />
        <StatusRow
          label="カレンダー"
          value={connected ? store.google.calendar_id || "primary" : "—"}
          ok={connected}
        />
        <StatusRow
          label="未同期の予定"
          value={connected ? `${unsynced} 件` : "—"}
          ok={connected && unsynced === 0}
        />

        <div className="flex flex-wrap gap-2">
          {connected ? (
            <>
              <form
                action={async () => {
                  "use server";
                  await pushUnsyncedEventsAction();
                }}
              >
                <SubmitButton className="btn-secondary" pendingLabel="送信中…">
                  未同期の予定を送る
                </SubmitButton>
              </form>
              <form action={disconnectGoogleAction}>
                <SubmitButton className="btn-danger" pendingLabel="解除中…">
                  連携を解除
                </SubmitButton>
              </form>
            </>
          ) : (
            <a href="/api/gcal/connect" className="btn-primary">
              Googleカレンダーを接続
            </a>
          )}
        </div>

        {!oauthReady && !mock ? (
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-[var(--ink-soft)]">
            <li>Google Cloud でプロジェクトを作り、Calendar API を有効化する。</li>
            <li>OAuth クライアント（ウェブ）を作り、リダイレクト URI に <code>/api/gcal/callback</code> を追加する。</li>
            <li>
              <code>GOOGLE_CALENDAR_CLIENT_ID</code> と{" "}
              <code>GOOGLE_CALENDAR_CLIENT_SECRET</code> を環境変数に入れる。
            </li>
            <li>資格情報の前に動作確認するなら <code>GCAL_MOCK=1</code> で同期ログを試せる。</li>
          </ol>
        ) : null}

        {store.google.sync_log.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-[var(--muted)]">最近の同期</h3>
            <ul className="space-y-1 text-sm text-[var(--ink-soft)]">
              {store.google.sync_log.slice(0, 8).map((entry, index) => (
                <li key={`${entry.at}-${index}`}>
                  {actionLabel(entry.action)}
                  {entry.title ? ` · ${entry.title}` : ""}
                  {entry.date ? ` · ${entry.date}` : ""}
                  {entry.mock ? " · mock" : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="card space-y-3">
        <h2 className="font-display text-2xl">連携ステータス</h2>
        <StatusRow label="データストア" value={supabase ? "Supabase 接続済み" : "ローカル JSON"} ok={supabase} />
        <StatusRow
          label="Google Calendar"
          value={connected ? "接続済み（Phase 2）" : configured ? "資格情報あり・未接続" : "未設定"}
          ok={connected}
        />
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
        <p>Phase 1 · 基盤構築 — ダッシュボード、CRUD、ポイント、月カレンダー</p>
        <p>Phase 2 · Google Calendar OAuth と予定の双方向更新（このフェーズ）</p>
        <p>Phase 3 · Vercel Cron / pg_cron による自動リスケ</p>
        <p>Phase 4 · Alexa カスタムスキル → `/api/voice/complete`</p>
      </section>
    </div>
  );
}

function actionLabel(action: string) {
  if (action === "create") return "作成";
  if (action === "done") return "完了";
  if (action === "reschedule") return "リスケ";
  if (action === "delete") return "削除";
  return action;
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
