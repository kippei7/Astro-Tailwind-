import { currentYearMonth, inYearMonth, monthKey, todayYmd } from "./dates";
import type { TaskEventView } from "./types";

export const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

export type CalendarCell = {
  date: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  weekday: number;
};

export function parseYearMonth(value: string | undefined): {
  year: number;
  month: number;
} | null {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  if (month < 1 || month > 12) return null;
  return { year, month };
}

export function isYmd(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export function shiftYearMonth(year: number, month: number, delta: number) {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

export function ymdFromParts(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function monthGrid(
  year: number,
  month: number,
  today = todayYmd(),
): CalendarCell[] {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const prev = shiftYearMonth(year, month, -1);
  const daysInPrev = new Date(Date.UTC(prev.year, prev.month, 0)).getUTCDate();
  const next = shiftYearMonth(year, month, 1);

  const cells: CalendarCell[] = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    const day = daysInPrev - firstWeekday + 1 + i;
    const date = ymdFromParts(prev.year, prev.month, day);
    cells.push({
      date,
      day,
      inMonth: false,
      isToday: date === today,
      weekday: cells.length % 7,
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = ymdFromParts(year, month, day);
    cells.push({
      date,
      day,
      inMonth: true,
      isToday: date === today,
      weekday: cells.length % 7,
    });
  }

  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    const date = ymdFromParts(next.year, next.month, nextDay);
    cells.push({
      date,
      day: nextDay,
      inMonth: false,
      isToday: date === today,
      weekday: cells.length % 7,
    });
    nextDay += 1;
  }

  return cells;
}

export function eventsByDate(
  events: TaskEventView[],
): Map<string, TaskEventView[]> {
  const map = new Map<string, TaskEventView[]>();
  for (const event of events) {
    const list = map.get(event.scheduled_date) ?? [];
    list.push(event);
    map.set(event.scheduled_date, list);
  }
  return map;
}

export function resolveMonthSelection(opts: {
  month?: string;
  date?: string;
  now?: Date;
}) {
  const today = todayYmd(opts.now);
  const current = currentYearMonth(opts.now);
  const parsedMonth = parseYearMonth(opts.month);
  const date = isYmd(opts.date) ? opts.date : null;

  let year = current.year;
  let month = current.month;
  if (parsedMonth) {
    year = parsedMonth.year;
    month = parsedMonth.month;
  } else if (date) {
    year = Number(date.slice(0, 4));
    month = Number(date.slice(5, 7));
  }

  const selectedDate =
    date ??
    (inYearMonth(today, year, month) ? today : ymdFromParts(year, month, 1));

  return {
    year,
    month,
    monthKey: monthKey(year, month),
    selectedDate,
    today,
    label: `${year}年${month}月`,
  };
}

export function tasksHref(opts: {
  month?: string;
  date?: string;
  status?: string;
}) {
  const params = new URLSearchParams();
  if (opts.month) params.set("month", opts.month);
  if (opts.date) params.set("date", opts.date);
  if (opts.status && opts.status !== "ALL") params.set("status", opts.status);
  const query = params.toString();
  return query ? `/tasks?${query}` : "/tasks";
}

export function safeInternalPath(path: string | undefined): string | undefined {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("://")) {
    return undefined;
  }
  return path;
}
