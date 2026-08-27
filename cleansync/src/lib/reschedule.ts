import { nextDayYmd, nextWeekendYmd } from "./dates";
import type { RescheduleRule } from "./types";

export function nextScheduledDate(
  scheduledDate: string,
  rule: RescheduleRule,
): string {
  if (rule === "NEXT_WEEKEND") {
    return nextWeekendYmd(scheduledDate);
  }
  return nextDayYmd(scheduledDate);
}
