"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import {
  colorForAssignee,
  createCalendarEvent,
  deleteCalendarEvent,
  disconnectGoogle,
  markCalendarEventDone,
  pushUnsyncedEvents,
  updateCalendarEventDate,
} from "./gcal";
import { isoNow, todayYmd } from "./dates";
import { eventPoints } from "./points";
import { hydrateEvent } from "./queries";
import { nextScheduledDate } from "./reschedule";
import { getStore, resetStore, updateStore } from "./store";
import type { RescheduleRule, TaskStatus } from "./types";
import { findAreaByUtterance } from "./voice";

function refresh() {
  revalidatePath("/", "layout");
}

export async function completeTaskAction(eventId: string) {
  let gcalId: string | null = null;
  let title = "";
  await updateStore((store) => {
    const event = store.task_events.find((item) => item.id === eventId);
    if (!event || event.status === "DONE") return store;
    const view = hydrateEvent(store, event);
    if (!view) return store;

    event.status = "DONE";
    event.completed_at = isoNow();
    gcalId = event.gcal_event_id;
    title = `${view.area.name} / ${view.master.name}`;

    const user = store.users.find((item) => item.id === event.assigned_user_id);
    if (user) {
      user.total_points += eventPoints(event, view.master);
    }
    return store;
  });
  if (gcalId) await markCalendarEventDone(gcalId, title);
  refresh();
}

export async function cancelTaskAction(eventId: string) {
  let gcalId: string | null = null;
  await updateStore((store) => {
    const event = store.task_events.find((item) => item.id === eventId);
    if (!event || event.status === "DONE") return store;
    event.status = "CANCELLED";
    gcalId = event.gcal_event_id;
    return store;
  });
  if (gcalId) await deleteCalendarEvent(gcalId);
  refresh();
}

export async function rescheduleTaskAction(eventId: string) {
  let gcalId: string | null = null;
  let nextDate = "";
  await updateStore((store) => {
    const event = store.task_events.find((item) => item.id === eventId);
    if (!event || event.status !== "TODO") return store;
    const master = store.task_master.find((item) => item.id === event.task_id);
    if (!master) return store;
    event.reschedule_count += 1;
    event.scheduled_date = nextScheduledDate(
      event.scheduled_date,
      master.reschedule_rule,
      todayYmd(),
    );
    gcalId = event.gcal_event_id;
    nextDate = event.scheduled_date;
    return store;
  });
  if (gcalId && nextDate) await updateCalendarEventDate(gcalId, nextDate);
  refresh();
}

export async function runNightlyRescheduleAction() {
  const today = todayYmd();
  type Move = { gcalId: string; date: string };
  const calendarMoves: Move[] = [];
  let moved = 0;

  await updateStore((store) => {
    for (const event of store.task_events) {
      if (event.status !== "TODO" || event.scheduled_date >= today) continue;
      const master = store.task_master.find((item) => item.id === event.task_id);
      if (!master) continue;
      event.reschedule_count += 1;
      event.scheduled_date = nextScheduledDate(
        event.scheduled_date,
        master.reschedule_rule,
        today,
      );
      moved += 1;
      if (event.gcal_event_id) {
        calendarMoves.push({
          gcalId: event.gcal_event_id,
          date: event.scheduled_date,
        });
      }
    }
    return store;
  });

  await Promise.all(
    calendarMoves.map((move) => updateCalendarEventDate(move.gcalId, move.date)),
  );
  refresh();
  return { moved };
}

export async function createTaskEventAction(formData: FormData) {
  const taskId = String(formData.get("task_id") ?? "");
  const assignedUserId = String(formData.get("assigned_user_id") ?? "");
  const scheduledDate = String(formData.get("scheduled_date") ?? "");
  if (!taskId || !assignedUserId || !scheduledDate) {
    throw new Error("必須項目が不足しています");
  }

  const store = await getStore();
  const master = store.task_master.find((item) => item.id === taskId);
  const area = store.areas.find((item) => item.id === master?.area_id);
  const user = store.users.find((item) => item.id === assignedUserId);
  if (!master || !area || !user) {
    throw new Error("タスク定義または担当者が見つかりません");
  }

  const gcalEventId = await createCalendarEvent({
    title: `${area.name} / ${master.name}`,
    date: scheduledDate,
    description: `${user.name} 担当\n${master.description}`,
    colorId: colorForAssignee(user),
  });

  await updateStore((current) => {
    current.task_events.push({
      id: randomUUID(),
      task_id: taskId,
      assigned_user_id: assignedUserId,
      scheduled_date: scheduledDate,
      completed_at: null,
      status: "TODO",
      gcal_event_id: gcalEventId,
      reschedule_count: 0,
    });
    return current;
  });
  refresh();
}

export async function updateTaskEventAction(eventId: string, formData: FormData) {
  const assignedUserId = String(formData.get("assigned_user_id") ?? "");
  const scheduledDate = String(formData.get("scheduled_date") ?? "");
  const status = String(formData.get("status") ?? "") as TaskStatus;
  let gcalId: string | null = null;

  await updateStore((store) => {
    const event = store.task_events.find((item) => item.id === eventId);
    if (!event) return store;
    if (assignedUserId) event.assigned_user_id = assignedUserId;
    if (scheduledDate && scheduledDate !== event.scheduled_date) {
      event.scheduled_date = scheduledDate;
      gcalId = event.gcal_event_id;
    }
    if (status && event.status !== "DONE") event.status = status;
    return store;
  });
  if (gcalId && scheduledDate) {
    await updateCalendarEventDate(gcalId, scheduledDate);
  }
  refresh();
}

export async function createAreaAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("エリア名は必須です");
  await updateStore((store) => {
    store.areas.push({ id: randomUUID(), name });
    return store;
  });
  refresh();
}

export async function updateAreaAction(areaId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("エリア名は必須です");
  await updateStore((store) => {
    const area = store.areas.find((item) => item.id === areaId);
    if (area) area.name = name;
    return store;
  });
  refresh();
}

export async function deleteAreaAction(areaId: string) {
  await updateStore((store) => {
    const used = store.task_master.some((item) => item.area_id === areaId);
    if (used) throw new Error("このエリアはタスク定義で使われているため削除できません");
    store.areas = store.areas.filter((item) => item.id !== areaId);
    return store;
  });
  refresh();
}

export async function createMasterAction(formData: FormData) {
  const areaId = String(formData.get("area_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const points = Number(formData.get("points") ?? 0);
  const rescheduleRule = String(formData.get("reschedule_rule") ?? "") as RescheduleRule;
  if (!areaId || !name || !points || !rescheduleRule) {
    throw new Error("必須項目が不足しています");
  }
  await updateStore((store) => {
    store.task_master.push({
      id: randomUUID(),
      area_id: areaId,
      name,
      description,
      points,
      reschedule_rule: rescheduleRule,
    });
    return store;
  });
  refresh();
}

export async function updateMasterAction(masterId: string, formData: FormData) {
  const areaId = String(formData.get("area_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const points = Number(formData.get("points") ?? 0);
  const rescheduleRule = String(formData.get("reschedule_rule") ?? "") as RescheduleRule;
  await updateStore((store) => {
    const master = store.task_master.find((item) => item.id === masterId);
    if (!master) return store;
    if (areaId) master.area_id = areaId;
    if (name) master.name = name;
    master.description = description;
    if (points > 0) master.points = points;
    if (rescheduleRule) master.reschedule_rule = rescheduleRule;
    return store;
  });
  refresh();
}

export async function deleteMasterAction(masterId: string) {
  await updateStore((store) => {
    const used = store.task_events.some((item) => item.task_id === masterId);
    if (used) throw new Error("予定が紐づいているため削除できません");
    store.task_master = store.task_master.filter((item) => item.id !== masterId);
    return store;
  });
  refresh();
}

export async function updateUserNameAction(userId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("名前は必須です");
  await updateStore((store) => {
    const user = store.users.find((item) => item.id === userId);
    if (user) user.name = name;
    return store;
  });
  refresh();
}

export async function resetDemoDataAction() {
  await resetStore();
  refresh();
}

export async function completeByAreaNameAction(areaName: string, userId?: string) {
  const today = todayYmd();
  const completedIds: string[] = [];
  const gcalIds: { id: string; title: string }[] = [];
  let matchedArea: string | null = null;

  await updateStore((store) => {
    const area = findAreaByUtterance(store.areas, areaName);
    if (!area) return store;
    matchedArea = area.name;
    const masterIds = store.task_master
      .filter((item) => item.area_id === area.id)
      .map((item) => item.id);

    const targets = store.task_events.filter(
      (event) =>
        event.status === "TODO" &&
        event.scheduled_date <= today &&
        masterIds.includes(event.task_id),
    );

    for (const event of targets) {
      if (userId) event.assigned_user_id = userId;
      event.status = "DONE";
      event.completed_at = isoNow();
      const view = hydrateEvent(store, event);
      const user = store.users.find((item) => item.id === event.assigned_user_id);
      if (user && view) {
        user.total_points += eventPoints(event, view.master);
      }
      completedIds.push(event.id);
      if (event.gcal_event_id) {
        gcalIds.push({
          id: event.gcal_event_id,
          title: view ? `${view.area.name} / ${view.master.name}` : "",
        });
      }
    }
    return store;
  });

  await Promise.all(gcalIds.map((item) => markCalendarEventDone(item.id, item.title)));
  refresh();
  return {
    completed: completedIds.length,
    ids: completedIds,
    areaName: matchedArea,
  };
}

export async function disconnectGoogleAction() {
  await disconnectGoogle();
  refresh();
  redirect("/settings?gcal=disconnected");
}

export async function pushUnsyncedEventsAction() {
  const pushed = await pushUnsyncedEvents();
  refresh();
  return { pushed };
}
