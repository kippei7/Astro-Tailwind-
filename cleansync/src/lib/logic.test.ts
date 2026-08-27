import { describe, expect, it } from "vitest";
import { effectivePoints, eventPoints, isAlert } from "./points";
import { nextScheduledDate } from "./reschedule";
import { findAreaByUtterance, normalizeUtterance } from "./voice";
import { negotiationCopy } from "./dashboard";
import { createSeed } from "./seed";

describe("points", () => {
  it("keeps base points until the alert threshold", () => {
    expect(isAlert(2)).toBe(false);
    expect(effectivePoints(10, 2)).toBe(10);
    expect(isAlert(3)).toBe(true);
    expect(effectivePoints(10, 3)).toBe(12);
    expect(eventPoints({ status: "TODO", reschedule_count: 3 }, { points: 10 })).toBe(
      0,
    );
    expect(eventPoints({ status: "DONE", reschedule_count: 3 }, { points: 10 })).toBe(
      12,
    );
  });
});

describe("reschedule", () => {
  it("moves NEXT_DAY tasks to the next calendar day", () => {
    expect(nextScheduledDate("2026-08-26", "NEXT_DAY", "2026-08-26")).toBe(
      "2026-08-27",
    );
  });

  it("catches overdue NEXT_DAY tasks up to today in one run", () => {
    expect(nextScheduledDate("2026-08-20", "NEXT_DAY", "2026-08-27")).toBe(
      "2026-08-27",
    );
  });

  it("moves NEXT_WEEKEND tasks to the next Saturday on or after today", () => {
    expect(nextScheduledDate("2026-08-21", "NEXT_WEEKEND", "2026-08-22")).toBe(
      "2026-08-22",
    );
    expect(nextScheduledDate("2026-08-15", "NEXT_WEEKEND", "2026-08-27")).toBe(
      "2026-08-29",
    );
  });
});

describe("voice matching", () => {
  const areas = [
    { id: "1", name: "ドラム式" },
    { id: "2", name: "お風呂" },
    { id: "3", name: "リビング" },
  ];

  it("matches exact and partial area names", () => {
    expect(normalizeUtterance("ドラム式を")).toBe("ドラム式");
    expect(findAreaByUtterance(areas, "ドラム式")?.name).toBe("ドラム式");
    expect(findAreaByUtterance(areas, "ドラム")?.name).toBe("ドラム式");
    expect(findAreaByUtterance(areas, "お風呂を")?.name).toBe("お風呂");
    expect(findAreaByUtterance(areas, "ベランダ")).toBeNull();
  });
});

describe("seed + dashboard", () => {
  it("seeds overdue, alert, and today tasks relative to the given date", () => {
    const store = createSeed(new Date("2026-08-27T03:00:00+09:00"));
    expect(
      store.task_events.some(
        (event) => event.id === "ev-alert-tub" && event.reschedule_count >= 3,
      ),
    ).toBe(true);
    expect(
      store.task_events.some((event) => event.id === "ev-overdue-toilet"),
    ).toBe(true);
    expect(
      store.task_events.some(
        (event) =>
          event.id === "ev-today-filter" && event.scheduled_date === "2026-08-27",
      ),
    ).toBe(true);
  });

  it("explains the monthly point gap for negotiation", () => {
    const users = [
      { id: "a", name: "夫", total_points: 0, color: "#000" },
      { id: "b", name: "妻", total_points: 0, color: "#000" },
    ];
    expect(negotiationCopy(users, new Map([["a", 40], ["b", 28]]))).toContain(
      "夫が 12pt リード",
    );
  });
});
