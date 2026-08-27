import Link from "next/link";
import { TaskCard } from "@/components/TaskCard";
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
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const status = (typeof params.status === "string" ? params.status : "ALL") as FilterId;
  const store = await getStore();
  const events = filterEvents(hydrateEvents(store), {
    status: status as TaskStatus | "ALL" | "ALERT" | "OVERDUE",
  }).sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="page-kicker">TASK EVENTS</p>
          <h1 className="page-title">掃除の予定</h1>
          <p className="page-lead">
            いつ・どこを・どのように掃除するかを一覧できます。手順メモで属人化を防ぎます。
          </p>
        </div>
        <Link href="/tasks/new" className="btn-primary">
          予定を追加
        </Link>
      </header>

      <div className="chip-row">
        {FILTERS.map((filter) => (
          <Link
            key={filter.id}
            href={filter.id === "ALL" ? "/tasks" : `/tasks?status=${filter.id}`}
            className={status === filter.id ? "chip chip-active" : "chip"}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {events.length === 0 ? (
        <div className="card text-sm text-[var(--muted)]">該当する予定はありません。</div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <TaskCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
