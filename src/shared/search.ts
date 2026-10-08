import type { Data, Row } from "./model";
import { expandRecurrence, type RecurrenceRule } from "./recurrence";
import { localDay } from "./smart-input";
export const searchTypes = {
  daily_goals: "Привычки",
  notes: "Заметки",
  tasks: "Задачи",
  projects: "Проекты",
  events: "События",
  transactions: "Финансы",
  inbox: "Входящие",
};
export type SearchType = keyof typeof searchTypes;
export type SearchFilters = {
  type?: string;
  date?: string;
  project?: string;
  tag?: string;
  status?: string;
};
export type SearchResult = {
  id: string;
  table: SearchType;
  title: string;
  text: string;
  date: string;
  project: string;
  tags: string;
  status: string;
  updated: string;
  recurrence?: RecurrenceRule & { start: string };
  completedDays?: Set<string>;
};
const dateKey = (s: string) =>
  s ? (s.length === 10 ? s : localDay(new Date(s))) : "";
export function searchIndex(data: Data): SearchResult[] {
  const notes = new Map(
    data.notes.filter((n) => !n.deleted_at).map((n) => [n.id, n]),
  );
  const categories = new Map(data.categories.map((c) => [c.id, c.name]));
  const accounts = new Map(data.accounts.map((a) => [a.id, a.currency]));
  const completed = new Map<string, Set<string>>();
  for (const c of data.task_completions) {
    if (c.deleted_at) continue;
    if (!completed.has(c.task_id)) completed.set(c.task_id, new Set());
    completed.get(c.task_id)!.add(c.occurrence_date);
  }
  const make = (
    table: SearchType,
    r: Row,
    title: string,
    text: string,
    date: string,
    status = "",
    tags = "",
  ): SearchResult => ({
    id: r.id,
    table,
    title,
    text,
    date: dateKey(date),
    status,
    tags,
    project:
      table === "projects" ? r.id : "project_id" in r ? r.project_id : "",
    updated: r.updated_at,
    recurrence:
      "recurrence_rule" in r && r.recurrence_rule
        ? { ...r, start: "due_date" in r ? r.due_date : r.start_at }
        : undefined,
    completedDays: table === "tasks" ? completed.get(r.id) : undefined,
  });
  return [
    ...data.daily_goals
      .filter((g) => !g.deleted_at)
      .map((g) =>
        make(
          "daily_goals",
          g,
          g.name,
          g.aliases,
          g.start_date,
          g.archived ? "archived" : "active",
        ),
      ),
    ...data.notes
      .filter((r) => !r.deleted_at)
      .map((r) =>
        make(
          "notes",
          r,
          r.title,
          r.content_text,
          r.created_at,
          r.archived ? "archived" : "active",
          r.tags,
        ),
      ),
    ...data.tasks
      .filter((r) => !r.deleted_at)
      .map((r) =>
        make(
          "tasks",
          r,
          r.title,
          r.description,
          r.due_date || r.created_at,
          r.status,
          notes.get(r.note_id)?.tags,
        ),
      ),
    ...data.projects
      .filter((r) => !r.deleted_at)
      .map((r) =>
        make(
          "projects",
          r,
          r.name,
          r.description,
          r.due_date || r.created_at,
          r.status,
        ),
      ),
    ...data.events
      .filter((r) => !r.deleted_at)
      .map((r) => make("events", r, r.title, r.description, r.start_at)),
    ...data.transactions
      .filter((r) => !r.deleted_at)
      .map((r) =>
        make(
          "transactions",
          r,
          r.note || "Операция",
          `${r.amount} ${categories.get(r.category_id) ?? ""} ${accounts.get(r.account_id) ?? ""}`,
          r.date,
          r.type,
        ),
      ),
    ...data.inbox
      .filter((r) => !r.deleted_at)
      .map((r) =>
        make("inbox", r, r.title, r.content, r.created_at, r.status, r.tags),
      ),
  ].sort((a, b) => b.updated.localeCompare(a.updated));
}
export function searchEntities(
  index: SearchResult[],
  query: string,
  filters: SearchFilters = {},
) {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return index.flatMap((entry) => {
    let r = entry;
    if (filters.date && entry.recurrence) {
      const rule = entry.recurrence;
      if (
        !expandRecurrence(
          rule.start,
          rule,
          new Date(filters.date + "T00:00"),
          new Date(filters.date + "T23:59:59.999"),
        ).length
      )
        return [];
      r = {
        ...entry,
        date: filters.date,
        status:
          entry.table === "tasks"
            ? entry.completedDays?.has(filters.date)
              ? "done"
              : entry.status === "done"
                ? "todo"
                : entry.status
            : entry.status,
      };
    }
    const text = `${r.title} ${r.text} ${r.tags}`.toLowerCase();
    return (!filters.type || r.table === filters.type) &&
      (!filters.date || r.date === filters.date) &&
      (!filters.project || r.project === filters.project) &&
      (!filters.status || r.status === filters.status) &&
      (!filters.tag ||
        r.tags
          .split(",")
          .some(
            (t) =>
              t.trim().toLowerCase() ===
              filters.tag!.trim().replace(/^#/, "").toLowerCase(),
          )) &&
      words.every((word) => text.includes(word))
      ? [r]
      : [];
  });
}
