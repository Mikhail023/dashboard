import { expect, it } from "vitest";
import { expandRecurrence } from "../src/shared/recurrence";
import { format } from "date-fns";
const dates = (
  start: string,
  rule: Parameters<typeof expandRecurrence>[1],
  from: string,
  to: string,
) =>
  expandRecurrence(
    start,
    rule,
    new Date(from + "T00:00"),
    new Date(to + "T23:59"),
  ).map((d) => format(d, "yyyy-MM-dd"));
it("supports custom intervals, selected weekdays and weekdays", () => {
  expect(
    dates(
      "2026-10-01T14:30",
      { recurrence_rule: "daily", recurrence_interval: 3 },
      "2026-10-01",
      "2026-10-10",
    ),
  ).toEqual(["2026-10-01", "2026-10-04", "2026-10-07", "2026-10-10"]);
  expect(
    dates(
      "2026-10-05T09:00",
      {
        recurrence_rule: "selected",
        recurrence_days: "1,3",
        recurrence_interval: 2,
      },
      "2026-10-05",
      "2026-10-21",
    ),
  ).toEqual(["2026-10-05", "2026-10-07", "2026-10-19", "2026-10-21"]);
  expect(
    dates(
      "2026-10-02",
      { recurrence_rule: "weekdays" },
      "2026-10-02",
      "2026-10-05",
    ),
  ).toEqual(["2026-10-02", "2026-10-05"]);
});
it("clamps leap days, honors an end date and jumps to distant windows", () => {
  expect(
    dates(
      "2024-02-29",
      { recurrence_rule: "yearly" },
      "2025-01-01",
      "2026-12-31",
    ),
  ).toEqual(["2025-02-28", "2026-02-28"]);
  expect(
    dates(
      "2000-01-01",
      { recurrence_rule: "daily", recurrence_until: "2026-10-02" },
      "2026-10-01",
      "2026-10-04",
    ),
  ).toEqual(["2026-10-01", "2026-10-02"]);
});

it("does not truncate long histories or accept invalid date boundaries", () => {
  expect(
    dates(
      "1990-01-01",
      { recurrence_rule: "daily" },
      "1990-01-01",
      "2026-10-06",
    ).length,
  ).toBeGreaterThan(13000);
  expect(
    expandRecurrence(
      "2026-10-01",
      { recurrence_rule: "daily" },
      new Date("invalid"),
      new Date(),
    ),
  ).toEqual([]);
});

it("finds the next occurrence for distant series and respects their end", async () => {
  const { nextRecurrence } = await import("../src/shared/recurrence");
  expect(
    format(
      nextRecurrence(
        "2020-01-31T09:00",
        { recurrence_rule: "monthly", recurrence_interval: 3 },
        new Date("2026-11-01T00:00"),
      )!,
      "yyyy-MM-dd HH:mm",
    ),
  ).toBe("2027-01-31 09:00");
  expect(
    nextRecurrence(
      "2026-01-01",
      { recurrence_rule: "yearly", recurrence_until: "2026-12-31" },
      new Date("2026-10-01"),
    ),
  ).toBeUndefined();
});
