import type { TaskEventView, TaskStatus } from "@/lib/types";

const STATUS_LABEL: Record<TaskStatus, string> = {
  TODO: "未完了",
  DONE: "完了",
  CANCELLED: "キャンセル",
};

export function StatusBadge({ event }: { event: TaskEventView }) {
  if (event.status === "TODO" && event.isAlert) {
    return <span className="badge-alert">滞留アラート ×{event.reschedule_count}</span>;
  }
  if (event.status === "TODO" && event.isOverdue) {
    return <span className="badge-overdue">期限超過</span>;
  }
  if (event.status === "DONE") {
    return <span className="badge-done">{STATUS_LABEL.DONE}</span>;
  }
  if (event.status === "CANCELLED") {
    return <span className="badge-cancel">{STATUS_LABEL.CANCELLED}</span>;
  }
  return <span className="badge-todo">今日 / 予定</span>;
}
