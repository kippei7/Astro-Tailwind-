import { currentYearMonth, inYearMonth, weekIndexInMonth } from "./dates";
import { eventPoints } from "./points";
import { hydrateEvents } from "./queries";
import type { StoreData, User } from "./types";
import type { WeekPointRow } from "@/components/PointsChart";

export function monthlyPoints(store: StoreData, year: number, month: number) {
  const events = hydrateEvents(store).filter(
    (event) => event.status === "DONE" && inYearMonth(event.scheduled_date, year, month),
  );

  const byUser = new Map<string, number>();
  for (const user of store.users) byUser.set(user.id, 0);
  for (const event of events) {
    byUser.set(
      event.assigned_user_id,
      (byUser.get(event.assigned_user_id) ?? 0) +
        eventPoints(event, event.master),
    );
  }

  const weeks: WeekPointRow[] = [1, 2, 3, 4, 5].map((week) => {
    const row: WeekPointRow = { week: `第${week}週` };
    for (const user of store.users) row[user.id] = 0;
    return row;
  });

  for (const event of events) {
    const idx = weekIndexInMonth(event.scheduled_date) - 1;
    if (!weeks[idx]) continue;
    const current = Number(weeks[idx][event.assigned_user_id] ?? 0);
    weeks[idx][event.assigned_user_id] =
      current + eventPoints(event, event.master);
  }

  const usedWeeks = weeks.filter((row) =>
    store.users.some((user) => Number(row[user.id]) > 0),
  );

  return {
    byUser,
    weeks: usedWeeks.length ? usedWeeks : weeks.slice(0, 4),
    doneCount: events.length,
  };
}

export function leader(users: User[], byUser: Map<string, number>) {
  return [...users].sort(
    (a, b) => (byUser.get(b.id) ?? 0) - (byUser.get(a.id) ?? 0),
  )[0];
}

export function negotiationCopy(
  users: User[],
  byUser: Map<string, number>,
): string {
  if (users.length < 2) {
    return "ポイントを貯めて、自由時間やご褒美の交渉材料にしましょう。";
  }

  const ranked = [...users].sort(
    (a, b) => (byUser.get(b.id) ?? 0) - (byUser.get(a.id) ?? 0),
  );
  const first = byUser.get(ranked[0].id) ?? 0;
  const second = byUser.get(ranked[1].id) ?? 0;
  const lead = first - second;

  if (first === 0 && second === 0) {
    return "まだ今月の完了がありません。今日の掃除からポイントを積みましょう。";
  }
  if (lead === 0) {
    return "今月のポイントは互角です。お疲れさま。ご褒美の分け方も話し合いやすい状態です。";
  }
  return `${ranked[0].name}が ${lead}pt リード。自由時間やご褒美の交渉材料になります。`;
}

export function dashboardMonthLabel(now = new Date()) {
  const { year, month } = currentYearMonth(now);
  return { year, month, label: `${year}年${month}月` };
}
