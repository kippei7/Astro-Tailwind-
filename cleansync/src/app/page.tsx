import Link from "next/link";
import { PointsChart } from "@/components/PointsChart";
import { TaskCard } from "@/components/TaskCard";
import { dashboardMonthLabel, monthlyPoints } from "@/lib/dashboard";
import { todayYmd } from "@/lib/dates";
import { filterEvents, hydrateEvents } from "@/lib/queries";
import { getStore } from "@/lib/store";

export default async function DashboardPage() {
  const store = await getStore();
  const { year, month, label } = dashboardMonthLabel();
  const today = todayYmd();
  const stats = monthlyPoints(store, year, month);
  const events = hydrateEvents(store);
  const todayTasks = filterEvents(events, { status: "TODO", date: today });
  const alerts = filterEvents(events, { status: "ALERT" });
  const overdue = filterEvents(events, { status: "OVERDUE" }).filter(
    (event) => !event.isAlert,
  );

  const maxPoints = Math.max(
    ...store.users.map((user) => stats.byUser.get(user.id) ?? 0),
    1,
  );

  return (
    <div className="space-y-8">
      <header>
        <p className="page-kicker">{label}</p>
        <h1 className="page-title">今月の掃除ポイント</h1>
        <p className="page-lead">
          誰がどれだけ担ったかを見える化して、自由時間やご褒美の交渉を数字で始められるようにする。
        </p>
      </header>

      <section className="grid-2">
        {store.users.map((user) => {
          const points = stats.byUser.get(user.id) ?? 0;
          const ratio = Math.round((points / maxPoints) * 100);
          return (
            <article key={user.id} className="card">
              <p className="text-sm font-medium text-[var(--muted)]">{user.name}</p>
              <p className="mt-2 font-display text-5xl tabular-nums tracking-tight">
                {points}
                <span className="ml-2 text-lg text-[var(--muted)]">pt</span>
              </p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--linen)]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${ratio}%`, background: user.color }}
                />
              </div>
              <p className="mt-3 text-xs text-[var(--muted)]">
                累計 {user.total_points} pt
              </p>
            </article>
          );
        })}
      </section>

      <section className="card">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl">週ごとの比較</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              完了 {stats.doneCount} 件 · Recharts
            </p>
          </div>
          <Link href="/tasks/new" className="btn-primary">
            予定を追加
          </Link>
        </div>
        <PointsChart data={stats.weeks} users={store.users} />
      </section>

      {alerts.length > 0 ? (
        <section className="space-y-3">
          <div>
            <h2 className="font-display text-2xl">滞留アラート</h2>
            <p className="text-sm text-[var(--muted)]">
              自動リスケが3回以上。完了するとポイントが1.2倍になります。
            </p>
          </div>
          {alerts.map((event) => (
            <TaskCard key={event.id} event={event} />
          ))}
        </section>
      ) : null}

      {overdue.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-2xl">期限超過</h2>
          {overdue.map((event) => (
            <TaskCard key={event.id} event={event} />
          ))}
        </section>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-2xl">今日やること</h2>
          <Link href="/tasks" className="text-sm font-medium text-[var(--forest)]">
            すべての予定
          </Link>
        </div>
        {todayTasks.length === 0 ? (
          <div className="card text-sm text-[var(--muted)]">
            今日の未完了タスクはありません。お疲れさまです。
          </div>
        ) : (
          todayTasks.map((event) => (
            <TaskCard key={event.id} event={event} showDate={false} />
          ))
        )}
      </section>
    </div>
  );
}
