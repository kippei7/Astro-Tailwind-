export type RescheduleRule = "NEXT_DAY" | "NEXT_WEEKEND";
export type TaskStatus = "TODO" | "DONE" | "CANCELLED";

export type User = {
  id: string;
  name: string;
  total_points: number;
  color: string;
};

export type Area = {
  id: string;
  name: string;
};

export type TaskMaster = {
  id: string;
  area_id: string;
  name: string;
  description: string;
  points: number;
  reschedule_rule: RescheduleRule;
};

export type TaskEvent = {
  id: string;
  task_id: string;
  assigned_user_id: string;
  scheduled_date: string;
  completed_at: string | null;
  status: TaskStatus;
  gcal_event_id: string | null;
  reschedule_count: number;
};

export type StoreData = {
  users: User[];
  areas: Area[];
  task_master: TaskMaster[];
  task_events: TaskEvent[];
};

export type TaskEventView = TaskEvent & {
  master: TaskMaster;
  area: Area;
  assignee: User;
  isAlert: boolean;
  isOverdue: boolean;
  effectivePoints: number;
};

export const ALERT_RESCHEDULE_THRESHOLD = 3;
export const ALERT_POINT_MULTIPLIER = 1.2;
