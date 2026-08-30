import Link from "next/link";
import {
  cancelTaskAction,
  completeTaskAction,
  rescheduleTaskAction,
} from "@/lib/actions";
import { formatJaDateLong } from "@/lib/dates";
import { hasLiveCalendarSync } from "@/lib/gcal-oauth";
import type { TaskEventView } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import { SubmitButton } from "./SubmitButton";

export function TaskCard({
  event,
  showDate = true,
}: {
  event: TaskEventView;
  showDate?: boolean;
}) {
  const alertClass = event.isAlert && event.status === "TODO" ? "task-card-alert" : "";

  return (
    <article className={`task-card ${alertClass}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium tracking-wide text-[var(--muted)]">
            {event.area.name}
          </p>
          <h3 className="font-display text-xl text-[var(--ink)]">
            <Link href={`/tasks/${event.id}`} className="hover:underline">
              {event.master.name}
            </Link>
          </h3>
          <p className="text-sm text-[var(--muted)]">
            {event.assignee.name}
            {showDate ? ` · ${formatJaDateLong(event.scheduled_date)}` : null}
            {event.reschedule_count > 0 ? ` · リスケ ${event.reschedule_count}回` : null}
            {hasLiveCalendarSync(event.gcal_event_id) ? " · カレンダー同期" : null}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge event={event} />
          <p className="font-display text-2xl tabular-nums text-[var(--ink)]">
            {event.effectivePoints}
            <span className="ml-1 text-sm text-[var(--muted)]">pt</span>
          </p>
          {event.isAlert && event.status === "TODO" ? (
            <p className="text-[11px] font-medium text-[var(--alert)]">滞留ボーナス +20%</p>
          ) : null}
        </div>
      </div>

      {event.master.description ? (
        <p className="mt-3 text-sm leading-6 text-[var(--ink-soft)]">
          {event.master.description}
        </p>
      ) : null}

      {event.status === "TODO" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <form action={completeTaskAction.bind(null, event.id)}>
            <SubmitButton className="btn-primary" pendingLabel="記録中…">
              完了する
            </SubmitButton>
          </form>
          <form action={rescheduleTaskAction.bind(null, event.id)}>
            <SubmitButton className="btn-secondary" pendingLabel="移動中…">
              {event.master.reschedule_rule === "NEXT_WEEKEND"
                ? "次の週末へ"
                : "翌日へ"}
            </SubmitButton>
          </form>
          <form action={cancelTaskAction.bind(null, event.id)}>
            <SubmitButton className="btn-ghost" pendingLabel="取消中…">
              キャンセル
            </SubmitButton>
          </form>
        </div>
      ) : null}
    </article>
  );
}
