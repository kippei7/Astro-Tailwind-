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
import { authorizationUrl, GCAL_SCOPES } from "./gcal-oauth";

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
