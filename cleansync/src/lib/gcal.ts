import { randomUUID } from "crypto";
import { isoNow, nextDayYmd } from "./dates";
import {
  fetchGoogleEmail,
  isMockCalendar,
  isOAuthConfigured,
  refreshAccessToken,
  revokeGoogleToken,
} from "./gcal-oauth";
import { getStore, updateStore } from "./store";
import { emptyGoogleAccount, type GcalSyncAction, type User } from "./types";

export const DONE_PREFIX = "【済】";
export const CANCEL_PREFIX = "【取消】";
export const DONE_COLOR_ID = "8";
export const COLOR_HUSBAND = "10";
export const COLOR_WIFE = "4";

export type GcalEventInput = {
  title: string;
  date: string;
  description?: string;
  colorId?: string;
};

export function withStatusPrefix(title: string, prefix: string): string {
  const stripped = title.replace(/^【済】|^【取消】/, "").trim();
  return `${prefix}${stripped}`;
}

export function allDayTimes(date: string) {
  return {
    start: { date },
    end: { date: nextDayYmd(date) },
  };
}

export function colorForAssignee(user: Pick<User, "name" | "color">): string {
  if (user.name.includes("妻") || user.color.toLowerCase() === "#c46b4a") {
    return COLOR_WIFE;
  }
  return COLOR_HUSBAND;
}

export function buildEventResource(input: GcalEventInput) {
  const range = allDayTimes(input.date);
  return {
    summary: input.title,
    description: input.description ?? "",
    start: range.start,
    end: range.end,
    colorId: input.colorId,
  };
}

export function isGoogleConfigured(): boolean {
  return isOAuthConfigured() || isMockCalendar();
}

export async function isGoogleConnected(): Promise<boolean> {
  if (isMockCalendar()) {
    const store = await getStore();
    return Boolean(store.google?.email);
  }
  const store = await getStore();
  return Boolean(store.google?.refresh_token || store.google?.access_token);
}

async function appendLog(
  action: GcalSyncAction,
  eventId: string,
  extra?: { title?: string; date?: string; mock?: boolean },
) {
  await updateStore((store) => {
    store.google.sync_log.unshift({
      at: isoNow(),
      action,
      eventId,
      title: extra?.title,
      date: extra?.date,
      mock: extra?.mock,
    });
    store.google.sync_log = store.google.sync_log.slice(0, 20);
    return store;
  });
}

async function getAccessToken(): Promise<string | null> {
  if (isMockCalendar()) return "mock-token";
  if (!isOAuthConfigured()) return null;

  const store = await getStore();
  const account = store.google;
  if (!account.refresh_token && !account.access_token) return null;

  const expiry = account.expiry ? Date.parse(account.expiry) : 0;
  const stillValid =
    account.access_token && expiry - Date.now() > 60_000;
  if (stillValid && account.access_token) return account.access_token;

  if (!account.refresh_token) return account.access_token;

  const refreshed = await refreshAccessToken(account.refresh_token);
  const nextExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await updateStore((current) => {
    current.google.access_token = refreshed.access_token;
    current.google.expiry = nextExpiry;
    return current;
  });
  return refreshed.access_token;
}

async function calendarRequest(
  path: string,
  init: RequestInit = {},
): Promise<Response | null> {
  const token = await getAccessToken();
  if (!token || isMockCalendar()) return null;

  const store = await getStore();
  const calendarId = encodeURIComponent(store.google.calendar_id || "primary");
  const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  return response;
}

export async function createCalendarEvent(
  input: GcalEventInput,
): Promise<string | null> {
  if (isMockCalendar()) {
    const connected = await isGoogleConnected();
    if (!connected) return null;
    const id = `gcal-mock-${randomUUID()}`;
    await appendLog("create", id, { title: input.title, date: input.date, mock: true });
    return id;
  }

  if (!(await isGoogleConnected())) return null;

  try {
    const response = await calendarRequest("/events", {
      method: "POST",
      body: JSON.stringify(buildEventResource(input)),
    });
    if (!response) return null;
    if (!response.ok) {
      console.error("gcal create failed", response.status, await response.text());
      return null;
    }
    const data = (await response.json()) as { id?: string };
    const id = data.id ?? null;
    if (id) {
      await appendLog("create", id, { title: input.title, date: input.date });
    }
    return id;
  } catch (error) {
    console.error("gcal create error", error);
    return null;
  }
}

export async function markCalendarEventDone(gcalEventId: string): Promise<void> {
  if (!gcalEventId) return;

  if (isMockCalendar()) {
    await appendLog("done", gcalEventId, {
      title: withStatusPrefix("event", DONE_PREFIX),
      mock: true,
    });
    return;
  }

  if (!(await isGoogleConnected())) return;

  try {
    const current = await calendarRequest(`/events/${encodeURIComponent(gcalEventId)}`);
    let summary = DONE_PREFIX;
    if (current?.ok) {
      const data = (await current.json()) as { summary?: string };
      summary = withStatusPrefix(data.summary || "", DONE_PREFIX);
    }
    const response = await calendarRequest(`/events/${encodeURIComponent(gcalEventId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        summary,
        colorId: DONE_COLOR_ID,
      }),
    });
    if (response && !response.ok && response.status !== 404) {
      console.error("gcal done failed", response.status, await response.text());
      return;
    }
    await appendLog("done", gcalEventId, { title: summary });
  } catch (error) {
    console.error("gcal done error", error);
  }
}

export async function updateCalendarEventDate(
  gcalEventId: string,
  date: string,
): Promise<void> {
  if (!gcalEventId) return;

  if (isMockCalendar()) {
    await appendLog("reschedule", gcalEventId, { date, mock: true });
    return;
  }

  if (!(await isGoogleConnected())) return;

  try {
    const range = allDayTimes(date);
    const response = await calendarRequest(`/events/${encodeURIComponent(gcalEventId)}`, {
      method: "PATCH",
      body: JSON.stringify({
        start: range.start,
        end: range.end,
      }),
    });
    if (response && !response.ok && response.status !== 404) {
      console.error("gcal reschedule failed", response.status, await response.text());
      return;
    }
    await appendLog("reschedule", gcalEventId, { date });
  } catch (error) {
    console.error("gcal reschedule error", error);
  }
}

export async function deleteCalendarEvent(gcalEventId: string): Promise<void> {
  if (!gcalEventId) return;

  if (isMockCalendar()) {
    await appendLog("delete", gcalEventId, { mock: true });
    return;
  }

  if (!(await isGoogleConnected())) return;

  try {
    const response = await calendarRequest(`/events/${encodeURIComponent(gcalEventId)}`, {
      method: "DELETE",
    });
    if (response && !response.ok && response.status !== 404) {
      console.error("gcal delete failed", response.status, await response.text());
      return;
    }
    await appendLog("delete", gcalEventId);
  } catch (error) {
    console.error("gcal delete error", error);
  }
}

export async function connectMockAccount(): Promise<void> {
  await updateStore((store) => {
    store.google.email = "mock@cleansync.local";
    store.google.access_token = "mock-token";
    store.google.refresh_token = "mock-refresh";
    store.google.expiry = new Date(Date.now() + 3600_000).toISOString();
    return store;
  });
}

export async function saveOAuthTokens(opts: {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}): Promise<void> {
  const email = await fetchGoogleEmail(opts.accessToken);
  await updateStore((store) => {
    store.google.access_token = opts.accessToken;
    if (opts.refreshToken) store.google.refresh_token = opts.refreshToken;
    store.google.expiry = new Date(Date.now() + opts.expiresIn * 1000).toISOString();
    store.google.email = email;
    return store;
  });
}

export async function disconnectGoogle(): Promise<void> {
  const store = await getStore();
  const token = store.google.refresh_token || store.google.access_token;
  if (token && !isMockCalendar()) {
    await revokeGoogleToken(token);
  }
  await updateStore((current) => {
    current.google = emptyGoogleAccount();
    return current;
  });
}
