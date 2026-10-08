import { z } from "zod";
import { isValidDate } from "./smart-input";
import { recurrenceFields } from "./recurrence";
const text = z.string().max(20000);
const title = z.string().trim().min(1, "Укажите название").max(200);
const ref = z.union([z.uuid(), z.literal("")]).default("");
const date = z
  .string()
  .refine((v) => !v || isValidDate(v), "Некорректная дата")
  .default("");
const color = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .default("#1F7A4D");
export const calendarDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isValidDate, "Некорректная дата");
const money = z.number().finite().min(0).max(1e12);
export const schemas = {
  daily_goals: z.object({
    name: title,
    kind: z.enum(["boolean", "quantitative"]).default("boolean"),
    target_value: z.number().finite().positive().max(1e9).default(1),
    unit: z.string().trim().min(1).max(30).default("раз"),
    icon: z
      .enum(["target", "study", "sport", "reading", "water", "sparkles"])
      .default("target"),
    color: z
      .union([z.literal(""), z.string().regex(/^#[0-9a-fA-F]{6}$/)])
      .default(""),
    project_id: ref,
    start_date: calendarDay,
    aliases: z.string().max(500).default(""),
    archived: z.boolean().default(false),
  }),
  daily_goal_entries: z.object({
    goal_id: z.uuid(),
    day: calendarDay,
    value: z.number().finite().min(0).max(1e9),
  }),
  budgets: z.object({
    name: title,
    category_id: ref,
    amount: money.positive(),
    currency: z.enum(["RUB", "USD", "EUR"]).default("RUB"),
  }),
  financial_goals: z.object({
    name: title,
    target_amount: money.positive(),
    current_amount: money.default(0),
    currency: z.enum(["RUB", "USD", "EUR"]).default("RUB"),
    status: z.enum(["active", "completed"]).default("active"),
  }),
  inbox: z.object({
    title,
    content: text.default(""),
    project_id: ref,
    tags: z.string().max(500).default(""),
    status: z.enum(["pending", "processed"]).default("pending"),
    converted_table: z.enum(["", "notes", "tasks", "projects"]).default(""),
    converted_id: ref,
  }),
  note_folders: z.object({ name: title, color, sort: z.number().default(0) }),
  notes: z.object({
    title,
    content_json: text
      .refine((v) => {
        try {
          const json = JSON.parse(v);
          return (
            json.type === "doc" &&
            (!json.content || Array.isArray(json.content))
          );
        } catch {
          return false;
        }
      }, "Некорректное содержимое заметки")
      .default('{"type":"doc","content":[]}'),
    content_text: text.default(""),
    folder_id: ref,
    project_id: ref,
    tags: z.string().max(500).default(""),
    pinned: z.boolean().default(false),
    color,
    archived: z.boolean().default(false),
  }),
  projects: z.object({
    name: title,
    description: text.default(""),
    status: z
      .enum(["planned", "running", "pending", "ended"])
      .default("planned"),
    color,
    due_date: date,
    progress_cache: z.number().default(0),
  }),
  tasks: z.object({
    ...recurrenceFields,
    title,
    description: text.default(""),
    project_id: ref,
    note_id: ref,
    status: z.enum(["todo", "in_progress", "pending", "done"]).default("todo"),
    priority: z.enum(["low", "medium", "high"]).default("medium"),
    due_date: date,
    assignee_label: z.string().max(200).default(""),
    sort: z.number().default(0),
    completed_at: date,
  }),
  subtasks: z.object({
    task_id: z.uuid(),
    title,
    done: z.boolean().default(false),
  }),
  time_entries: z.object({
    task_id: ref,
    project_id: ref,
    started_at: date,
    ended_at: date,
    seconds: z.number().int().min(0).max(31536000),
  }),
  events: z.object({
    ...recurrenceFields,
    title,
    description: text.default(""),
    start_at: date,
    end_at: date,
    all_day: z.boolean().default(false),
    color,
    remind_before_min: z.number().int().min(0).max(10080).default(15),
    project_id: ref,
  }),
  accounts: z.object({
    name: title,
    type: z.enum(["cash", "card", "bank", "other"]).default("card"),
    currency: z.enum(["RUB", "USD", "EUR"]).default("RUB"),
    balance_initial: z.number().finite().max(1e12).min(-1e12).default(0),
  }),
  transactions: z.object({
    account_id: z.uuid(),
    to_account_id: ref,
    type: z.enum(["income", "expense", "transfer"]),
    amount: money,
    category_id: ref,
    date,
    note: text.default(""),
    project_id: ref,
    invoice_id: ref,
  }),
  categories: z.object({
    name: title,
    type: z.enum(["income", "expense"]).default("expense"),
    color,
  }),
  invoices: z.object({
    number: title,
    client_name: title,
    company: text.default(""),
    project_id: ref,
    status: z
      .enum(["draft", "unsent", "viewed", "paid", "overdue"])
      .default("draft"),
    issue_date: date,
    due_date: date,
    paid_at: date,
    currency: z.enum(["RUB", "USD", "EUR"]).default("RUB"),
    notes: text.default(""),
  }),
  invoice_items: z.object({ invoice_id: z.uuid(), title, amount: money }),
  task_completions: z.object({
    task_id: z.uuid(),
    occurrence_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    completed_at: date,
  }),
};
export type Table = keyof typeof schemas;
export type Row<T extends Table = Table> = {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string;
  demo: boolean;
} & z.infer<(typeof schemas)[T]>;
export type Data = { [K in Table]: Row<K>[] };
export const tables = Object.keys(schemas) as Table[];
export type Profile = {
  id: string;
  name: string;
  email: string;
  avatar_path: string;
};
export type State = {
  data: Data;
  settings: Record<string, string>;
  profile: Profile;
  dbPath: string;
  touchID: boolean;
  timer: TimerState;
};
export type TimerState = {
  task_id: string;
  project_id: string;
  started_at: string;
  running_since: number | null;
  elapsed: number;
};
export type AuthState = {
  profile: Profile | null;
  authenticated: boolean;
  retryAfter: number;
  theme: string;
};
export const registration = z.object({
  name: title,
  email: z.union([z.email(), z.literal("")]),
  avatar_path: z.string().max(32),
  password: z.string().min(8).max(1024),
});
export type Request =
  | {
      action: "recordGoal";
      goal_id: string;
      day: string;
      value: number;
      mode: "set" | "add";
    }
  | {
      action: "completeTask";
      id: string;
      occurrence_date: string;
      completed: boolean;
    }
  | {
      action: "convertInbox";
      id: string;
      table: "notes" | "tasks" | "projects";
    }
  | { action: "authStatus" }
  | { action: "register"; data: z.infer<typeof registration> }
  | { action: "login"; password: string }
  | { action: "lock" }
  | { action: "touchID" }
  | { action: "snapshot" }
  | {
      action: "save";
      table: Table;
      data: Record<string, unknown>;
      categoryName?: string;
    }
  | { action: "remove" | "restoreRow"; table: Table; id: string }
  | { action: "settings"; data: Record<string, string> }
  | {
      action: "profile";
      data: { name: string; email: string; avatar_path: string };
    }
  | { action: "password"; current: string; password: string }
  | {
      action:
        | "demo"
        | "clearDemo"
        | "backup"
        | "restoreBackup"
        | "exportJSON"
        | "importJSON";
    }
  | { action: "reset"; confirmation: string }
  | { action: "payInvoice"; id: string; account_id: string }
  | {
      action: "timer";
      command: "start" | "pause" | "stop";
      task_id?: string;
      project_id?: string;
    }
  | {
      action: "export";
      format: "csv" | "markdown" | "pdf" | "json";
      table: Table;
      id?: string;
    };
export type Response =
  { ok: true; value: unknown } | { ok: false; error: string };
export interface API {
  readonly platform: string;
  call(request: Request): Promise<Response>;
  rendererReady(): void;
  onLock(callback: () => void): () => void;
  onTimer(callback: () => void): () => void;
}
declare global {
  interface Window {
    dashboard: API;
  }
}
export const labels: Record<string, string> = {
  boolean: "Да / нет",
  quantitative: "Количество",
  target: "Цель",
  study: "Учёба",
  sport: "Спорт",
  reading: "Чтение",
  water: "Вода",
  sparkles: "Искра",
  planned: "Запланирован",
  running: "В работе",
  pending: "Ожидает",
  ended: "Завершён",
  todo: "К выполнению",
  in_progress: "В работе",
  done: "Готово",
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  draft: "Черновик",
  unsent: "Не отправлен",
  viewed: "Просмотрен",
  paid: "Оплачен",
  overdue: "Просрочен",
  income: "Доход",
  expense: "Расход",
  transfer: "Перевод",
  cash: "Наличные",
  card: "Карта",
  bank: "Банк",
  other: "Другое",
  daily: "Ежедневно",
  weekly: "Еженедельно",
  monthly: "Ежемесячно",
  yearly: "Ежегодно",
  weekdays: "По рабочим дням",
  selected: "Выбранные дни недели",
  active: "Активно",
  processed: "Обработано",
  archived: "В архиве",
  completed: "Завершено",
};
export const emptyData = (): Data =>
  Object.fromEntries(tables.map((t) => [t, []])) as unknown as Data;
