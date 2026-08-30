import { todayYmd } from "./dates";
import { effectivePoints, isAlert } from "./points";
import type { StoreData, TaskEvent, TaskEventView, TaskStatus } from "./types";

export function hydrateEvent(store: StoreData, event: TaskEvent): TaskEventView | null {
  const master = store.task_master.find((m) => m.id === event.task_id);
  const assignee = store.users.find((u) => u.id === event.assigned_user_id);
  if (!master || !assignee) return null;
  const area = store.areas.find((a) => a.id === master.area_id);
  if (!area) return null;
  const today = todayYmd();
  return {
    ...event,
    master,
    area,
    assignee,
    isAlert: isAlert(event.reschedule_count),
    isOverdue: event.status === "TODO" && event.scheduled_date < today,
    effectivePoints: effectivePoints(master.points, event.reschedule_count),
  };
}

export function hydrateEvents(store: StoreData): TaskEventView[] {
  return store.task_events
    .map((event) => hydrateEvent(store, event))
    .filter((event): event is TaskEventView => event !== null)
    .sort((a, b) => {
      if (a.scheduled_date !== b.scheduled_date) {
        return a.scheduled_date.localeCompare(b.scheduled_date);
      }
      return a.area.name.localeCompare(b.area.name, "ja");
    });
}

export function filterEvents(
  events: TaskEventView[],
  opts: {
    status?: TaskStatus | "ALL" | "ALERT" | "OVERDUE";
    userId?: string;
    areaId?: string;
    date?: string;
  },
): TaskEventView[] {
  return events.filter((event) => {
    if (opts.userId && event.assigned_user_id !== opts.userId) return false;
    if (opts.areaId && event.area.id !== opts.areaId) return false;
    if (opts.date && event.scheduled_date !== opts.date) return false;
    if (!opts.status || opts.status === "ALL") return true;
    if (opts.status === "ALERT") {
      return event.status === "TODO" && event.isAlert;
    }
    if (opts.status === "OVERDUE") {
      return event.isOverdue;
    }
    return event.status === opts.status;
  });
}
