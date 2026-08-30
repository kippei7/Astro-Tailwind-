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

export type GcalSyncAction = "create" | "done" | "reschedule" | "delete" | "refresh";

export type GcalSyncEntry = {
  at: string;
  action: GcalSyncAction;
  eventId: string;
  title?: string;
  date?: string;
  mock?: boolean;
  ok?: boolean;
  error?: string;
};

export type GoogleAccount = {
  calendar_id: string;
  email: string | null;
  access_token: string | null;
  refresh_token: string | null;
  expiry: string | null;
  last_error: string | null;
  sync_log: GcalSyncEntry[];
};

export type StoreData = {
  users: User[];
  areas: Area[];
  task_master: TaskMaster[];
  task_events: TaskEvent[];
  google: GoogleAccount;
};

export function emptyGoogleAccount(): GoogleAccount {
  return {
    calendar_id: "primary",
    email: null,
    access_token: null,
    refresh_token: null,
    expiry: null,
    last_error: null,
    sync_log: [],
  };
}

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
