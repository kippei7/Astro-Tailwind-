import {
  ALERT_POINT_MULTIPLIER,
  ALERT_RESCHEDULE_THRESHOLD,
  type TaskEvent,
  type TaskMaster,
} from "./types";

export function isAlert(rescheduleCount: number): boolean {
  return rescheduleCount >= ALERT_RESCHEDULE_THRESHOLD;
}

export function effectivePoints(basePoints: number, rescheduleCount: number): number {
  const raw = isAlert(rescheduleCount)
    ? basePoints * ALERT_POINT_MULTIPLIER
    : basePoints;
  return Math.round(raw);
}

export function eventPoints(
  event: Pick<TaskEvent, "reschedule_count" | "status">,
  master: Pick<TaskMaster, "points">,
): number {
  if (event.status !== "DONE") return 0;
  return effectivePoints(master.points, event.reschedule_count);
}
