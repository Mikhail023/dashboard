import { endOfDay, startOfDay } from "date-fns";
import type { Data } from "./model";
import { formatHabitValue } from "./habits";
import { localDay } from "./smart-input";
import { occurrences, progress } from "./calculations";
import { tasksInRange, nextRecurrence } from "./recurrence";
export type TimelineItem = {
  key: string;
  id: string;
  table: "tasks" | "notes" | "events" | "transactions" | "daily_goal_entries";
  title: string;
  time: string;
  label: string;
  project_id: string;
  amount?: number;
  currency?: string;
  unknownTime?: boolean;
  occurrence_date?: string;
};
export function dailyOverview(data: Data, day: string, currency = "RUB") {
  const from = startOfDay(new Date(day + "T12:00")),
    to = endOfDay(from);
  const sameDay = (s: string) => !!s && localDay(new Date(s)) === day;
  const scheduled = tasksInRange(data, from, to).filter(
    (t) => t.due_date.slice(0, 10) === day,
  );
  const items: TimelineItem[] = [];
  const tasksById = new Map(
    data.tasks.filter((t) => !t.deleted_at).map((t) => [t.id, t]),
  );
  const currencies = new Map(data.accounts.map((a) => [a.id, a.currency]));
  for (const t of data.tasks.filter(
    (t) =>
      !t.deleted_at &&
      !t.recurrence_rule &&
      t.status === "done" &&
      sameDay(t.completed_at),
  ))
    items.push({
      key: `task-${t.id}`,
      id: t.id,
      table: "tasks",
      title: t.title,
      time: t.completed_at,
      label: "Задача выполнена",
      project_id: t.project_id,
    });
  for (const c of data.task_completions.filter(
    (c) => !c.deleted_at && sameDay(c.completed_at),
  )) {
    const t = tasksById.get(c.task_id);
    if (t)
      items.push({
        key: `completion-${c.id}`,
        occurrence_date: c.occurrence_date,
        id: t.id,
        table: "tasks",
        title: t.title,
        time: c.completed_at,
        label: `Выполнен повтор за ${c.occurrence_date}`,
        project_id: t.project_id,
      });
  }
  for (const n of data.notes.filter(
    (n) => !n.deleted_at && sameDay(n.created_at),
  ))
    items.push({
      key: `note-${n.id}`,
      id: n.id,
      table: "notes",
      title: n.title,
      time: n.created_at,
      label: "Заметка создана",
      project_id: n.project_id,
    });
  for (const e of data.events.filter((e) => !e.deleted_at))
    for (const at of occurrences(e, from, to))
      items.push({
        key: `event-${e.id}-${at.toISOString()}`,
        id: e.id,
        table: "events",
        title: e.title,
        time: at.toISOString(),
        label: e.all_day ? "Событие на весь день" : "Событие по расписанию",
        project_id: e.project_id,
        unknownTime: e.all_day,
      });
  for (const t of data.transactions.filter(
    (t) => !t.deleted_at && t.date.slice(0, 10) === day,
  ))
    items.push({
      key: `tx-${t.id}`,
      id: t.id,
      table: "transactions",
      title:
        t.note ||
        (t.type === "expense"
          ? "Расход"
          : t.type === "income"
            ? "Доход"
            : "Перевод"),
      time: sameDay(t.created_at) ? t.created_at : day + "T00:00",
      unknownTime: !sameDay(t.created_at),
      label:
        t.type === "expense"
          ? "Расход"
          : t.type === "income"
            ? "Доход"
            : "Перевод",
      project_id: t.project_id,
      amount: t.amount,
      currency: currencies.get(t.account_id) ?? "RUB",
    });
  const goals = new Map(
    data.daily_goals.filter((g) => !g.deleted_at).map((g) => [g.id, g]),
  );
  for (const entry of data.daily_goal_entries.filter(
    (e) => !e.deleted_at && e.day === day && e.value > 0,
  )) {
    const goal = goals.get(entry.goal_id);
    if (goal)
      items.push({
        key: `habit-${entry.id}`,
        id: entry.id,
        table: "daily_goal_entries",
        title: goal.name,
        time: sameDay(entry.updated_at) ? entry.updated_at : day + "T00:00",
        unknownTime: !sameDay(entry.updated_at),
        label: `${entry.value >= goal.target_value ? "Привычка выполнена" : "Прогресс привычки"} · ${formatHabitValue(entry.value, goal.unit)} / ${formatHabitValue(goal.target_value, goal.unit)}`,
        project_id: goal.project_id,
      });
  }
  const completed = items.filter((i) => i.table === "tasks").length;
  const completedUnscheduled = items.filter(
    (i) =>
      i.table === "tasks" &&
      !scheduled.some(
        (t) => t.id === i.id && t.occurrence_date === i.occurrence_date,
      ),
  ).length;
  const weights = new Map<string, number>();
  for (const p of [...items, ...scheduled]
    .map((i) => i.project_id)
    .filter(Boolean))
    weights.set(p, (weights.get(p) ?? 0) + 1);
  const mainProject = data.projects
    .filter((p) => !p.deleted_at && weights.has(p.id))
    .sort((a, b) => (weights.get(b.id) ?? 0) - (weights.get(a.id) ?? 0))[0];
  return {
    items: items.sort((a, b) => +new Date(a.time) - +new Date(b.time)),
    scheduled,
    completed,
    total: Math.max(completed, scheduled.length + completedUnscheduled),
    notes: items.filter((i) => i.table === "notes").length,
    events: items.filter((i) => i.table === "events").length,
    expenses:
      items
        .filter(
          (i) =>
            i.table === "transactions" &&
            i.label === "Расход" &&
            i.currency === currency,
        )
        .reduce((s, i) => s + Math.round((i.amount ?? 0) * 100), 0) / 100,
    mainProject,
    projectProgress: mainProject
      ? progress(
          data.tasks.filter(
            (t) => !t.deleted_at && t.project_id === mainProject.id,
          ),
        )
      : 0,
  };
}
export function focusPlan(data: Data, now = new Date()) {
  const day = localDay(now),
    priority = { high: 0, medium: 1, low: 2 };
  const tasks = tasksInRange(data, undefined, endOfDay(now))
    .filter(
      (t) =>
        t.status !== "done" && (!t.due_date || t.due_date.slice(0, 10) <= day),
    )
    .sort(
      (a, b) =>
        priority[a.priority] - priority[b.priority] ||
        (a.due_date || "9999").localeCompare(b.due_date || "9999"),
    );
  const nextEvent = data.events
    .filter((e) => !e.deleted_at)
    .flatMap((e) =>
      [nextRecurrence(e.start_at, e, now)]
        .filter((at): at is Date => !!at)
        .map((at) => ({ event: e, at })),
    )
    .sort((a, b) => +a.at - +b.at)[0];
  return {
    tasks,
    nextEvent,
    overdue: tasks.filter((t) => t.due_date && t.due_date.slice(0, 10) < day)
      .length,
  };
}
