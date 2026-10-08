import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Repository } from "../src/main/database";
import { importData } from "../src/main/backup";
import {
  habitLevel,
  habitProgress,
  habitStats,
  goalEntries,
  heatmapRange,
  formatHabitValue,
} from "../src/shared/habits";
import { parseSmartInput } from "../src/shared/smart-input";
import { dailyOverview } from "../src/shared/daily";
let dir: string, repo: Repository;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "dashboard-habits-"));
  repo = new Repository(
    join(dir, "test.db"),
    join(process.cwd(), "migrations"),
  );
});
afterEach(() => {
  repo.close();
  rmSync(dir, { recursive: true, force: true });
});
const study = () =>
  repo.save("daily_goals", {
    name: "Учёба",
    kind: "quantitative",
    target_value: 120,
    unit: "мин",
    icon: "study",
    start_date: "2026-01-01",
  });
describe("Daily goals", () => {
  it("persists goals, updates a single day atomically and preserves entries across restart", () => {
    const g = study();
    repo.recordGoal(g.id, "2026-01-01", 60, "add");
    repo.recordGoal(g.id, "2026-01-01", 90, "add");
    expect(repo.data().daily_goal_entries).toHaveLength(1);
    expect(repo.data().daily_goal_entries[0].value).toBe(150);
    repo.recordGoal(g.id, "2026-01-01", 30, "set");
    repo.close();
    repo = new Repository(
      join(dir, "test.db"),
      join(process.cwd(), "migrations"),
    );
    expect(repo.data().daily_goal_entries[0].value).toBe(30);
    expect(repo.data().daily_goals[0].target_value).toBe(120);
  });
  it("normalizes Boolean goals and rejects invalid dates and values", () => {
    const g = repo.save("daily_goals", {
      name: "Тренировка",
      kind: "boolean",
      target_value: 20,
      start_date: "2026-01-01",
    });
    expect(g.target_value).toBe(1);
    repo.recordGoal(g.id, "2026-01-02", 1, "add");
    repo.recordGoal(g.id, "2026-01-02", 1, "add");
    expect(repo.data().daily_goal_entries[0].value).toBe(1);
    expect(() => repo.recordGoal(g.id, "2026-01-02", 2, "set")).toThrow();
    expect(() => repo.recordGoal(g.id, "2026-02-30", 1, "set")).toThrow();
    expect(() => repo.recordGoal(g.id, "2025-12-31", 1, "set")).toThrow();
    expect(() => repo.recordGoal(g.id, "2099-01-01", 1, "set")).toThrow();
    expect(() => repo.recordGoal(g.id, "2026-01-02", -1, "set")).toThrow();
  });
  it("computes all five intensity states without stored percentages", () => {
    expect(
      [0, 1, 49, 50, 99, 100, 120].map((v) =>
        habitLevel(habitProgress(v, 100)),
      ),
    ).toEqual([0, 1, 1, 2, 2, 3, 4]);
    expect(formatHabitValue(92, "мин")).toBe("1 ч 32 мин");
  });
  it("computes streaks, permits unfinished today and recalculates edited history", () => {
    const g = study();
    for (const d of [1, 2, 3, 5, 6])
      repo.recordGoal(g.id, `2026-01-0${d}`, 120, "set");
    const stats = () =>
      habitStats(
        g,
        goalEntries(repo.data().daily_goal_entries, g.id),
        "2026-01-07",
      );
    expect(stats()).toEqual({
      current: 2,
      longest: 3,
      completedDays: 5,
      completionRate: 71,
    });
    repo.recordGoal(g.id, "2026-01-04", 150, "set");
    expect(stats()).toMatchObject({ current: 6, longest: 6, completedDays: 6 });
    repo.recordGoal(g.id, "2026-01-06", 60, "set");
    expect(stats()).toMatchObject({ current: 0, longest: 5, completedDays: 5 });
  });
  it("renders full calendar ranges including leap day and future placeholders", () => {
    expect(
      heatmapRange(12, "2024-07-06").cells.filter((c) => !c.outside),
    ).toHaveLength(366);
    expect(
      heatmapRange(12, "2026-07-06").cells.filter((c) => !c.outside),
    ).toHaveLength(365);
    expect(heatmapRange(3, "2026-01-06")).toMatchObject({
      from: "2025-11-01",
      to: "2026-01-31",
    });
    expect(heatmapRange(6, "2026-10-06")).toMatchObject({
      from: "2026-05-01",
      to: "2026-10-31",
    });
  });
  it("recognizes the three requested local Smart Input phrases", () => {
    const g = study();
    repo.save("daily_goals", {
      name: "Чтение",
      kind: "quantitative",
      target_value: 30,
      unit: "страниц",
      icon: "reading",
      start_date: "2026-01-01",
    });
    repo.save("daily_goals", {
      name: "Тренировка",
      icon: "sport",
      start_date: "2026-01-01",
    });
    const parse = (text: string) =>
      parseSmartInput(text, repo.data(), new Date("2026-01-07T12:00"));
    expect(parse("Учился 1 час 30 минут")).toMatchObject({
      kind: "habit",
      fields: { goal_id: g.id, value: 90 },
    });
    expect(parse("Сегодня читал 20 страниц")).toMatchObject({
      kind: "habit",
      fields: { value: 20, day: "2026-01-07" },
    });
    expect(parse("Тренировка выполнена")).toMatchObject({
      kind: "habit",
      fields: { value: 1 },
    });
    repo.save("daily_goals", {
      name: "Учёба 2",
      kind: "quantitative",
      unit: "мин",
      icon: "study",
      start_date: "2026-01-01",
    });
    expect(parse("Учился 1 час").habitMatch.candidates).toHaveLength(2);
  });
  it("adds completed habits to the selected historical Timeline without duplicating tasks", () => {
    const g = study();
    repo.recordGoal(g.id, "2026-01-07", 120, "set");
    const overview = dailyOverview(repo.data(), "2026-01-07");
    expect(overview.items).toHaveLength(1);
    expect(overview.items[0]).toMatchObject({
      table: "daily_goal_entries",
      title: "Учёба",
      unknownTime: true,
    });
    expect(repo.data().tasks).toHaveLength(0);
  });
  it("round-trips goals and entries in a version 3 backup", () => {
    const g = study();
    repo.recordGoal(g.id, "2026-01-01", 150, "set");
    const dump = repo.data(),
      path = join(dir, "backup.json");
    writeFileSync(path, JSON.stringify({ version: 3, data: dump }));
    const target = new Repository(
      join(dir, "target.db"),
      join(process.cwd(), "migrations"),
    );
    try {
      importData(target, path);
      expect(target.data().daily_goals).toEqual(dump.daily_goals);
      expect(target.data().daily_goal_entries).toEqual(dump.daily_goal_entries);
    } finally {
      target.close();
    }
  });
});
