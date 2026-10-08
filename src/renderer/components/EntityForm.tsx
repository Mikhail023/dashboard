import { useState, useCallback } from "react";
import { format } from "date-fns";
import { localDay } from "../../shared/smart-input";
import { useForm } from "react-hook-form";
import { useApp, action, active, useData } from "../store";
import { labels, type Table } from "../../shared/model";
import { Button, Modal } from "./UI";
type Field = {
  key: string;
  label: string;
  type?:
    | "text"
    | "textarea"
    | "date"
    | "datetime-local"
    | "number"
    | "color"
    | "checkbox";
  weekdays?: boolean;
  options?: string[];
  ref?: Table;
  required?: boolean;
};
const name: Field = { key: "name", label: "Название", required: true },
  title: Field = { key: "title", label: "Название", required: true },
  description: Field = {
    key: "description",
    label: "Описание",
    type: "textarea",
  },
  project: Field = { key: "project_id", label: "Проект", ref: "projects" },
  color: Field = { key: "color", label: "Цвет", type: "color" },
  due: Field = { key: "due_date", label: "Дедлайн", type: "date" };
const recurrence: Field[] = [
  {
    key: "recurrence_rule",
    label: "Повтор",
    options: [
      "",
      "daily",
      "weekly",
      "monthly",
      "yearly",
      "weekdays",
      "selected",
    ],
  },
  {
    key: "recurrence_interval",
    label: "Интервал (дней / недель / месяцев / лет)",
    type: "number",
  },
  { key: "recurrence_days", label: "Дни недели", weekdays: true },
  {
    key: "recurrence_until",
    label: "Повторять до (необязательно)",
    type: "date",
  },
];
export const formFields: Record<Table, Field[]> = {
  daily_goals: [
    name,
    {
      key: "kind",
      label: "Тип привычки",
      options: ["boolean", "quantitative"],
    },
    {
      key: "target_value",
      label: "Дневная норма",
      type: "number",
      required: true,
    },
    { key: "unit", label: "Единица (мин, страниц, мл, раз)", required: true },
    {
      key: "icon",
      label: "Иконка",
      options: ["target", "study", "sport", "reading", "water", "sparkles"],
    },
    { key: "color", label: "Цвет #RRGGBB (пусто — акцент приложения)" },
    { key: "start_date", label: "Дата начала", type: "date", required: true },
    project,
    {
      key: "aliases",
      label: "Ключевые слова для быстрого ввода через запятую",
    },
    { key: "archived", label: "В архиве", type: "checkbox" },
  ],
  daily_goal_entries: [
    { key: "goal_id", label: "Привычка", ref: "daily_goals", required: true },
    { key: "day", label: "День", type: "date", required: true },
    { key: "value", label: "Значение за день", type: "number", required: true },
  ],
  budgets: [
    name,
    {
      key: "category_id",
      label: "Категория расходов (пусто — общий бюджет)",
      ref: "categories",
    },
    { key: "amount", label: "Бюджет на месяц", type: "number", required: true },
    { key: "currency", label: "Валюта", options: ["RUB", "USD", "EUR"] },
  ],
  financial_goals: [
    name,
    {
      key: "target_amount",
      label: "Целевая сумма",
      type: "number",
      required: true,
    },
    {
      key: "current_amount",
      label: "Уже накоплено",
      type: "number",
      required: true,
    },
    { key: "currency", label: "Валюта", options: ["RUB", "USD", "EUR"] },
  ],
  task_completions: [
    { key: "task_id", label: "Задача", ref: "tasks", required: true },
    { key: "occurrence_date", label: "Дата повтора", type: "date" },
    { key: "completed_at", label: "Выполнено", type: "datetime-local" },
  ],
  inbox: [
    title,
    { key: "content", label: "Текст", type: "textarea" },
    project,
    { key: "tags", label: "Теги через запятую" },
  ],
  projects: [
    name,
    description,
    {
      key: "status",
      label: "Статус",
      options: ["planned", "running", "pending", "ended"],
    },
    due,
    color,
  ],
  tasks: [
    title,
    description,
    project,
    { key: "note_id", label: "Связанная заметка", ref: "notes" },
    {
      key: "status",
      label: "Статус",
      options: ["todo", "in_progress", "pending", "done"],
    },
    { key: "priority", label: "Приоритет", options: ["medium", "high", "low"] },
    { ...due, type: "datetime-local" },
    { key: "assignee_label", label: "Исполнитель" },
    ...recurrence,
  ],
  notes: [
    title,
    { key: "folder_id", label: "Папка", ref: "note_folders" },
    project,
    { key: "tags", label: "Теги через запятую" },
    color,
  ],
  note_folders: [name, color],
  subtasks: [
    title,
    { key: "task_id", label: "Задача", ref: "tasks", required: true },
  ],
  events: [
    title,
    description,
    {
      key: "start_at",
      label: "Начало",
      type: "datetime-local",
      required: true,
    },
    {
      key: "end_at",
      label: "Окончание",
      type: "datetime-local",
      required: true,
    },
    { key: "all_day", label: "Весь день", type: "checkbox" },
    project,
    ...recurrence,
    { key: "remind_before_min", label: "Напоминание, минут", type: "number" },
    color,
  ],
  accounts: [
    name,
    { key: "type", label: "Тип", options: ["card", "cash", "bank", "other"] },
    { key: "currency", label: "Валюта", options: ["RUB", "USD", "EUR"] },
    { key: "balance_initial", label: "Начальный баланс", type: "number" },
  ],
  categories: [
    name,
    { key: "type", label: "Тип", options: ["expense", "income"] },
    color,
  ],
  transactions: [
    { key: "account_id", label: "Счёт", ref: "accounts", required: true },
    { key: "type", label: "Тип", options: ["expense", "income", "transfer"] },
    {
      key: "to_account_id",
      label: "Счёт получателя (для перевода)",
      ref: "accounts",
    },
    { key: "amount", label: "Сумма", type: "number", required: true },
    { key: "category_id", label: "Категория", ref: "categories" },
    {
      key: "new_category",
      label: "Новая категория (если не выбрана существующая)",
    },
    { key: "date", label: "Дата", type: "date", required: true },
    { key: "note", label: "Комментарий" },
    project,
  ],
  invoices: [
    { key: "number", label: "Номер", required: true },
    { key: "client_name", label: "Клиент", required: true },
    { key: "company", label: "Компания" },
    project,
    {
      key: "status",
      label: "Статус",
      options: ["draft", "unsent", "viewed", "overdue"],
    },
    { key: "issue_date", label: "Дата выставления", type: "date" },
    due,
    { key: "currency", label: "Валюта", options: ["RUB", "USD", "EUR"] },
    { key: "notes", label: "Примечания", type: "textarea" },
  ],
  invoice_items: [
    title,
    {
      key: "invoice_id",
      label: "Счёт-фактура",
      ref: "invoices",
      required: true,
    },
    { key: "amount", label: "Сумма", type: "number", required: true },
  ],
  time_entries: [
    { key: "task_id", label: "Задача", ref: "tasks" },
    project,
    { key: "seconds", label: "Секунды", type: "number", required: true },
    { key: "started_at", label: "Начало", type: "datetime-local" },
    { key: "ended_at", label: "Окончание", type: "datetime-local" },
  ],
};
const names: Record<Table, string> = {
  daily_goals: "привычку",
  daily_goal_entries: "прогресс привычки",
  budgets: "бюджет",
  financial_goals: "финансовую цель",
  task_completions: "отметку выполнения",
  inbox: "входящее",
  projects: "проект",
  tasks: "задачу",
  notes: "заметку",
  note_folders: "папку",
  events: "событие",
  accounts: "счёт",
  categories: "категорию",
  transactions: "операцию",
  invoices: "счёт-фактуру",
  invoice_items: "позицию",
  subtasks: "подзадачу",
  time_entries: "запись времени",
};
export default function EntityForm() {
  const editor = useApp((s) => s.editor);
  const data = useData();
  const [busy, setBusy] = useState(false);
  const close = useCallback(() => useApp.setState({ editor: null }), []);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Record<string, unknown>>({
    defaultValues: {
      ...Object.fromEntries(
        (editor ? formFields[editor.table] : [])
          .filter((f) => f.options)
          .map((f) => [f.key, f.options![0]]),
      ),
      color: editor?.table === "daily_goals" ? "" : "#1F7A4D",
      target_value: 1,
      unit: "раз",
      start_date: localDay(),
      day: localDay(),
      value: 0,
      remind_before_min: 15,
      date: localDay(),
      issue_date: localDay(),
      balance_initial: 0,
      current_amount: 0,
      recurrence_interval: 1,
      ...editor?.row,
      ...editor?.defaults,
      ...Object.fromEntries(
        (editor ? formFields[editor.table] : [])
          .filter((f) => f.type === "datetime-local")
          .map((f) => {
            const raw = (editor?.defaults?.[f.key] ??
              (editor?.row as unknown as Record<string, unknown> | undefined)?.[
                f.key
              ]) as string | undefined;
            return [
              f.key,
              raw
                ? format(
                    new Date(raw.length === 10 ? raw + "T00:00" : raw),
                    "yyyy-MM-dd'T'HH:mm",
                  )
                : "",
            ];
          }),
      ),
    },
  });
  if (!editor) return null;
  const { table, row } = editor;
  const selectedDays = String(watch("recurrence_days") ?? "")
    .split(",")
    .filter(Boolean);
  return (
    <Modal
      title={`${row ? "Изменить" : "Добавить"} ${names[table]}`}
      onClose={close}
    >
      <form
        className="form-grid"
        onSubmit={handleSubmit(async (values) => {
          setBusy(true);
          try {
            await useApp.getState().run({
              action: "save",
              table,
              data: { ...row, ...values },
              categoryName:
                table === "transactions"
                  ? String(values.new_category ?? "")
                  : undefined,
            });
            close();
          } catch {
            /* toast */
          } finally {
            setBusy(false);
          }
        })}
      >
        {formFields[table]
          .filter(
            (f) =>
              (!f.weekdays || watch("recurrence_rule") === "selected") &&
              !(
                table === "daily_goals" &&
                watch("kind") === "boolean" &&
                ["target_value", "unit"].includes(f.key)
              ),
          )
          .map((f) =>
            f.weekdays ? (
              <fieldset className="full weekday-picker" key={f.key}>
                <legend>{f.label}</legend>
                {[
                  ["1", "Пн"],
                  ["2", "Вт"],
                  ["3", "Ср"],
                  ["4", "Чт"],
                  ["5", "Пт"],
                  ["6", "Сб"],
                  ["0", "Вс"],
                ].map(([value, label]) => (
                  <label className="checkbox-row" key={value}>
                    <input
                      type="checkbox"
                      checked={selectedDays.includes(value)}
                      onChange={(e) =>
                        setValue(
                          "recurrence_days",
                          (e.target.checked
                            ? [...selectedDays, value]
                            : selectedDays.filter((d) => d !== value)
                          ).join(","),
                        )
                      }
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
            ) : (
              <label
                className={f.type === "textarea" ? "full" : ""}
                key={f.key}
              >
                {f.label}
                {f.required ? " *" : ""}
                {f.options || f.ref ? (
                  <select
                    aria-label={f.label}
                    {...register(f.key, { required: f.required })}
                  >
                    {f.ref && (
                      <option value="">
                        {f.required ? "Выберите…" : "Не выбрано"}
                      </option>
                    )}
                    {f.options?.map((o) => (
                      <option key={o} value={o}>
                        {labels[o] ?? (o || "Без повтора")}
                      </option>
                    ))}
                    {f.ref &&
                      active(data[f.ref])
                        .filter(
                          (r) =>
                            f.ref !== "categories" ||
                            !("type" in r) ||
                            (table !== "budgets" && table !== "transactions") ||
                            r.type ===
                              (table === "budgets" ? "expense" : watch("type")),
                        )
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {"name" in r
                              ? r.name
                              : "title" in r
                                ? r.title
                                : "number" in r
                                  ? r.number
                                  : r.id}
                          </option>
                        ))}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea rows={3} {...register(f.key)} />
                ) : (
                  <input
                    type={f.type ?? "text"}
                    step={
                      f.type === "number"
                        ? [
                            "recurrence_interval",
                            "remind_before_min",
                            "seconds",
                          ].includes(f.key)
                          ? "1"
                          : "0.01"
                        : undefined
                    }
                    {...register(f.key, {
                      required: f.required,
                      valueAsNumber: f.type === "number",
                    })}
                  />
                )}{" "}
                {errors[f.key] && (
                  <small className="error">Заполните поле</small>
                )}
              </label>
            ),
          )}
        {table === "tasks" && !!watch("recurrence_rule") && (
          <p className="muted full">
            Форма изменяет всю серию. Выполнение отдельного повтора отмечается в
            списке задач или календаре.
          </p>
        )}
        {table === "daily_goals" && (
          <p className="muted full">
            Норма применяется ко всей истории. Для новой единицы измерения
            создайте отдельную привычку.
          </p>
        )}
        <div className="form-actions full">
          {row && (
            <Button
              type="button"
              secondary
              className="danger-text"
              onClick={async () => {
                if (window.confirm("Переместить запись в корзину?")) {
                  const result = await action({
                    action: "remove",
                    table,
                    id: row.id,
                  });
                  if (result) close();
                }
              }}
            >
              Удалить
            </Button>
          )}
          <Button type="button" secondary onClick={close}>
            Отмена
          </Button>
          <Button disabled={busy}>{busy ? "Сохраняем…" : "Сохранить"}</Button>
        </div>
      </form>
    </Modal>
  );
}
