import { addDays, format, nextSaturday, parseISO } from "date-fns";

const TOKYO = "Asia/Tokyo";

export function todayYmd(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TOKYO }).format(now);
}

export function formatJaDate(ymd: string): string {
  const d = parseISO(ymd);
  return format(d, "M月d日");
}

export function formatJaDateLong(ymd: string): string {
  const d = parseISO(ymd);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${format(d, "M月d日")}（${weekdays[d.getDay()]}）`;
}

export function currentYearMonth(now = new Date()): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TOKYO,
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  return { year, month };
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function inYearMonth(ymd: string, year: number, month: number): boolean {
  return ymd.startsWith(monthKey(year, month));
}

export function nextDayYmd(ymd: string): string {
  return format(addDays(parseISO(ymd), 1), "yyyy-MM-dd");
}

export function nextWeekendYmd(ymd: string): string {
  const d = parseISO(ymd);
  const saturday = nextSaturday(d);
  return format(saturday, "yyyy-MM-dd");
}

export function weekIndexInMonth(ymd: string): number {
  const day = Number(ymd.slice(8, 10));
  return Math.ceil(day / 7);
}

export function isoNow(now = new Date()): string {
  return now.toISOString();
}
