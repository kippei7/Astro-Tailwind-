import Link from "next/link";
import { TaskCalendar } from "@/components/TaskCalendar";
import { TaskCard } from "@/components/TaskCard";
import { TaskEventForm } from "@/components/TaskEventForm";
import { resolveMonthSelection, tasksHref } from "@/lib/calendar";
import { formatJaDateLong } from "@/lib/dates";
import { filterEvents, hydrateEvents } from "@/lib/queries";
import { getStore } from "@/lib/store";
import type { TaskStatus } from "@/lib/types";

const FILTERS = [
  { id: "ALL", label: "すべて" },
  { id: "TODO", label: "未完了" },
  { id: "OVERDUE", label: "期限超過" },
  { id: "ALERT", label: "滞留" },
  { id: "DONE", label: "完了" },
  { id: "CANCELLED", label: "キャンセル" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; month?: string; date?: string }>;
}) {
  const params = await searchParams;
  const status = (typeof params.status === "string" ? params.status : "ALL") as FilterId;
  const { year, month, monthKey, selectedDate, today, label } = resolveMonthSelection({
    month: params.month,
    date: params.date,
  });

  const store = await getStore();
  const events = filterEvents(hydrateEvents(store), {
    status: status as TaskStatus | "ALL" | "ALERT" | "OVERDUE",
  });
  const dayEvents = events
    .filter((event) => event.scheduled_date === selectedDate)
    .sort((a, b) => a.area.name.localeCompare(b.area.name, "ja"));

  const dayHref = tasksHref({ month: monthKey, date: selectedDate, status });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="page-kicker">TASK EVENTS · {label}</p>
          <h1 className="page-title">掃除の予定</h1>
          <p className="page-lead">
            カレンダーから日付を選んで確認し、その日の掃除を追加できます。
          </p>
        </div>
        <Link href={`/tasks/new?date=${selectedDate}`} className="btn-primary">
          予定を追加
        </Link>
      </header>

      <div className="chip-row">
        {FILTERS.map((filter) => (
          <Link
            key={filter.id}
            href={tasksHref({
              month: monthKey,
              date: selectedDate,
              status: filter.id,
            })}
            className={status === filter.id ? "chip chip-active" : "chip"}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      <TaskCalendar
        year={year}
        month={month}
        today={today}
        selectedDate={selectedDate}
        events={events}
        status={status}
      />

      <section className="space-y-4" id="day-panel">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl">{formatJaDateLong(selectedDate)}</h2>
            <p className="text-sm text-[var(--muted)]">
              {dayEvents.length === 0
                ? "この日の予定はまだありません。"
                : `${dayEvents.length} 件の予定`}
            </p>
          </div>
        </div>

        {dayEvents.length === 0 ? null : (
          <div className="space-y-3">
            {dayEvents.map((event) => (
              <TaskCard key={event.id} event={event} showDate={false} />
            ))}
          </div>
        )}

        <div className="card space-y-4">
          <h3 className="font-display text-xl">この日に予定を追加</h3>
          <TaskEventForm
            areas={store.areas}
            masters={store.task_master}
            users={store.users}
            defaultDate={selectedDate}
            showDate={false}
            compact
            redirectTo={dayHref}
            submitLabel="この日に追加"
          />
        </div>
      </section>
    </div>
  );
}
