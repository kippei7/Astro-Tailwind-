import Link from "next/link";
import { notFound } from "next/navigation";
import {
  cancelTaskAction,
  completeTaskAction,
  rescheduleTaskAction,
  updateTaskEventAction,
} from "@/lib/actions";
import { hydrateEvent } from "@/lib/queries";
import { getStore } from "@/lib/store";
import { SubmitButton } from "@/components/SubmitButton";
import { StatusBadge } from "@/components/StatusBadge";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const store = await getStore();
  const raw = store.task_events.find((event) => event.id === id);
  if (!raw) notFound();
  const event = hydrateEvent(store, raw);
  if (!event) notFound();

  const update = updateTaskEventAction.bind(null, event.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/tasks" className="text-sm text-[var(--forest)]">
        ← 予定一覧
      </Link>
      <header className="space-y-2">
        <p className="page-kicker">{event.area.name}</p>
        <h1 className="page-title">{event.master.name}</h1>
        <StatusBadge event={event} />
      </header>

      <section className="card space-y-3">
        <h2 className="font-display text-xl">手順</h2>
        <p className="leading-7 text-[var(--ink-soft)]">
          {event.master.description || "手順メモはまだありません。"}
        </p>
        <p className="text-sm text-[var(--muted)]">
          基本 {event.master.points} pt
          {event.isAlert ? ` → 滞留ボーナスで ${event.effectivePoints} pt` : ""}
          {" · リスケ規則 "}
          {event.master.reschedule_rule === "NEXT_WEEKEND" ? "次の週末" : "翌日"}
          {event.gcal_event_id ? " · Googleカレンダー同期済み" : " · カレンダー未同期"}
        </p>
      </section>

      {event.status === "TODO" ? (
        <div className="flex flex-wrap gap-2">
          <form action={completeTaskAction.bind(null, event.id)}>
            <SubmitButton className="btn-primary">完了する</SubmitButton>
          </form>
          <form action={rescheduleTaskAction.bind(null, event.id)}>
            <SubmitButton className="btn-secondary">ルールどおりリスケ</SubmitButton>
          </form>
          <form action={cancelTaskAction.bind(null, event.id)}>
            <SubmitButton className="btn-ghost">キャンセル</SubmitButton>
          </form>
        </div>
      ) : null}

      <form action={update} className="card space-y-4">
        <h2 className="font-display text-xl">予定の編集</h2>
        <label className="field">
          <span>担当</span>
          <select name="assigned_user_id" defaultValue={event.assigned_user_id}>
            {store.users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>予定日</span>
          <input type="date" name="scheduled_date" defaultValue={event.scheduled_date} />
        </label>
        {event.status !== "DONE" ? (
          <label className="field">
            <span>ステータス</span>
            <select name="status" defaultValue={event.status}>
              <option value="TODO">未完了</option>
              <option value="CANCELLED">キャンセル</option>
            </select>
          </label>
        ) : null}
        <SubmitButton className="btn-secondary">変更を保存</SubmitButton>
      </form>
    </div>
  );
}
