import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
  subMonths,
  format,
} from "date-fns";
import type { Row } from "./model";
export const habitDay = (date: Date) => format(date, "yyyy-MM-dd");
export const habitProgress = (value: number, target: number) =>
  target > 0 ? value / target : 0;
export const habitLevel = (progress: number) =>
  progress <= 0
    ? 0
    : progress < 0.5
      ? 1
      : progress < 1
        ? 2
        : progress === 1
          ? 3
          : 4;
export function formatHabitValue(value: number, unit: string) {
  if (/^(мин|минуты|минут|minutes)$/i.test(unit)) {
    const hours = Math.floor(value / 60),
      minutes = Math.round((value % 60) * 100) / 100;
    return [
      hours ? `${hours} ч` : "",
      minutes || !hours ? `${minutes} мин` : "",
    ]
      .filter(Boolean)
      .join(" ");
  }
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value)} ${unit}`;
}
export function goalEntries(entries: Row<"daily_goal_entries">[], id: string) {
  return new Map(
    entries
      .filter((e) => e.goal_id === id && !e.deleted_at)
      .map((e) => [e.day, e]),
  );
}
export function habitStats(
  goal: Row<"daily_goals">,
  entries: Map<string, Row<"daily_goal_entries">>,
  today: string,
) {
  const completed = [...entries.values()]
    .filter(
      (e) =>
        e.day >= goal.start_date &&
        e.day <= today &&
        e.value >= goal.target_value,
    )
    .map((e) => e.day)
    .sort();
  let longest = 0,
    run = 0,
    previous = "";
  for (const day of completed) {
    run =
      previous &&
      differenceInCalendarDays(
        new Date(day + "T12:00"),
        new Date(previous + "T12:00"),
      ) === 1
        ? run + 1
        : 1;
    longest = Math.max(longest, run);
    previous = day;
  }
  const days = new Set(completed);
  let cursor = new Date(today + "T12:00"),
    current = 0;
  if (!days.has(today)) cursor = addDays(cursor, -1);
  while (days.has(habitDay(cursor))) {
    current++;
    cursor = addDays(cursor, -1);
  }
  const elapsed = Math.max(
    0,
    differenceInCalendarDays(
      new Date(today + "T12:00"),
      new Date(goal.start_date + "T12:00"),
    ) + 1,
  );
  return {
    current,
    longest,
    completedDays: completed.length,
    completionRate: elapsed
      ? Math.round((completed.length / elapsed) * 100)
      : 0,
  };
}
export function heatmapRange(months: 3 | 6 | 12, anchor: string) {
  const date = new Date(anchor + "T12:00");
  const from =
    months === 12
      ? new Date(date.getFullYear(), 0, 1, 12)
      : startOfMonth(subMonths(date, months - 1));
  const to =
    months === 12 ? new Date(date.getFullYear(), 11, 31, 12) : endOfMonth(date);
  const start = startOfWeek(from, { weekStartsOn: 1 }),
    end = endOfWeek(to, { weekStartsOn: 1 });
  const cells: { day: string; outside: boolean }[] = [];
  for (let d = start; d <= end; d = addDays(d, 1))
    cells.push({
      day: habitDay(d),
      outside: habitDay(d) < habitDay(from) || habitDay(d) > habitDay(to),
    });
  return { cells, from: habitDay(from), to: habitDay(to) };
}
