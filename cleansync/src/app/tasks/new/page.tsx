import { TaskEventForm } from "@/components/TaskEventForm";
import { isYmd, safeInternalPath } from "@/lib/calendar";
import { todayYmd } from "@/lib/dates";
import { getStore } from "@/lib/store";

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; from?: string }>;
}) {
  const params = await searchParams;
  const store = await getStore();
  const date = isYmd(params.date) ? params.date : todayYmd();
  const from = safeInternalPath(typeof params.from === "string" ? params.from : undefined);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <p className="page-kicker">NEW EVENT</p>
        <h1 className="page-title">予定を追加</h1>
        <p className="page-lead">
          タスク定義から選んで、担当者と日付を決めるだけです。手順は定義側に残します。
        </p>
      </header>

      <TaskEventForm
        areas={store.areas}
        masters={store.task_master}
        users={store.users}
        defaultDate={date}
        redirectTo={from}
      />
    </div>
  );
}
