import { describe, expect, it } from "vitest";
import {
  allDayTimes,
  buildEventResource,
  colorForAssignee,
  COLOR_HUSBAND,
  COLOR_WIFE,
  DONE_COLOR_ID,
  DONE_PREFIX,
  withStatusPrefix,
} from "./gcal";
import { looksLikeMockAccount, needsCalendarPush } from "./gcal";
import {
  authorizationUrl,
  GCAL_SCOPES,
  hasLiveCalendarSync,
  isGoogleClientIdShapeValid,
  isMockCalendarEventId,
  normalizeGoogleClientId,
} from "./gcal-oauth";

describe("gcal event payload", () => {
  it("prefixes done without duplicating", () => {
    expect(withStatusPrefix("ドラム式 / 乾燥フィルター清掃", DONE_PREFIX)).toBe(
      "【済】ドラム式 / 乾燥フィルター清掃",
    );
    expect(withStatusPrefix("【済】ドラム式 / 乾燥フィルター清掃", DONE_PREFIX)).toBe(
      "【済】ドラム式 / 乾燥フィルター清掃",
    );
  });

  it("builds an all-day event whose end date is exclusive", () => {
    expect(allDayTimes("2026-08-29")).toEqual({
      start: { date: "2026-08-29" },
      end: { date: "2026-08-30" },
    });
  });

  it("maps assignees to calendar colors and uses gray when done", () => {
    expect(colorForAssignee({ name: "夫", color: "#2a9d8f" })).toBe(COLOR_HUSBAND);
    expect(colorForAssignee({ name: "妻", color: "#c46b4a" })).toBe(COLOR_WIFE);
    expect(DONE_COLOR_ID).toBe("8");
  });

  it("serializes a calendar resource", () => {
    const resource = buildEventResource({
      title: "キッチン / シンク磨き",
      date: "2026-08-30",
      description: "妻 担当",
      colorId: COLOR_WIFE,
    });
    expect(resource.summary).toBe("キッチン / シンク磨き");
    expect(resource.colorId).toBe(COLOR_WIFE);
    expect(resource.end.date).toBe("2026-08-31");
  });
});

describe("google client id", () => {
  it("extracts the client id from a Cloud Console URL", () => {
    const id = "854967372803-t11qtiovt6aivagb94g5n72ucoc5ma0k.apps.googleusercontent.com";
    expect(
      normalizeGoogleClientId(
        `https://console.cloud.google.com/auth/clients/${id}?project=clean-calendar-506900`,
      ),
    ).toBe(id);
    expect(normalizeGoogleClientId(`  ${id}  `)).toBe(id);
    expect(isGoogleClientIdShapeValid(id)).toBe(true);
    expect(isGoogleClientIdShapeValid("https://console.cloud.google.com/")).toBe(false);
  });
});

describe("mock leftover detection", () => {
  it("recognizes the mock account and mock event ids", () => {
    expect(
      looksLikeMockAccount({
        email: "mock@cleansync.local",
        access_token: "mock-token",
        refresh_token: "mock-refresh",
      }),
    ).toBe(true);
    expect(
      looksLikeMockAccount({
        email: "someone@gmail.com",
        access_token: "ya29.real",
        refresh_token: "1//real",
      }),
    ).toBe(false);
    expect(isMockCalendarEventId("gcal-mock-abc")).toBe(true);
    expect(isMockCalendarEventId("abc123")).toBe(false);
    expect(hasLiveCalendarSync("gcal-mock-abc")).toBe(false);
    expect(hasLiveCalendarSync("abc123")).toBe(true);
    expect(
      needsCalendarPush({ gcal_event_id: "gcal-mock-abc", status: "TODO" }),
    ).toBe(true);
    expect(needsCalendarPush({ gcal_event_id: "abc123", status: "TODO" })).toBe(false);
    expect(
      needsCalendarPush({ gcal_event_id: null, status: "CANCELLED" }),
    ).toBe(false);
  });
});

describe("gcal oauth url", () => {
  it("requests offline calendar.events access", () => {
    const url = authorizationUrl({
      clientId: "client-id",
      redirectUri: "http://localhost:3000/api/gcal/callback",
      state: "abc",
    });
    expect(url).toContain("accounts.google.com/o/oauth2/v2/auth");
    expect(url).toContain("access_type=offline");
    expect(url).toContain(encodeURIComponent("calendar.events"));
    expect(GCAL_SCOPES).toContain("calendar.events");
  });
});
