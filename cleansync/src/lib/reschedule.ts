import { nextDayYmd, nextWeekendYmd, todayYmd } from "./dates";
import type { RescheduleRule } from "./types";

export function nextScheduledDate(
  scheduledDate: string,
  rule: RescheduleRule,
  today = todayYmd(),
): string {
  if (rule === "NEXT_WEEKEND") {
    let next = nextWeekendYmd(scheduledDate);
    while (next < today) {
      next = nextWeekendYmd(next);
    }
    return next;
  }

  const next = nextDayYmd(scheduledDate);
  return next < today ? today : next;
}
