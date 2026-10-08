import { addDays, format } from "date-fns";
import type { Data, Table } from "./model";

export const localDay = (date = new Date()) => format(date, "yyyy-MM-dd");
export function isValidDate(value: string) {
  if (!Number.isFinite(Date.parse(value))) return false;
  const day = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (!day) return true;
  const parsed = new Date(day + "T12:00");
  return Number.isFinite(+parsed) && localDay(parsed) === day;
}
export const richText = (text: string) =>
  JSON.stringify({
    type: "doc",
    content: [
      { type: "paragraph", content: text ? [{ type: "text", text }] : [] },
    ],
  });
export type SmartKind =
  "task" | "note" | "event" | "expense" | "income" | "inbox" | "habit";
export const smartLabels: Record<SmartKind, string> = {
  habit: "Прогресс привычки",
  task: "Задача",
  note: "Заметка",
  event: "Событие",
  expense: "Расход",
  income: "Доход",
  inbox: "Входящее",
};
const weekdays = [
  "воскресенье",
  "понедельник",
  "вторник",
  "среду",
  "четверг",
  "пятницу",
  "субботу",
];
export function parseDate(text: string, now = new Date()) {
  let day = localDay(now),
    found = false,
    time = "",
    warning = "";
  const relative = text.match(
    /послезавтра|завтра|сегодня|вчера|через\s+(\d+)\s+дн[яей]*/i,
  );
  if (relative) {
    const offset = relative[1]
      ? Number(relative[1])
      : ({ послезавтра: 2, завтра: 1, сегодня: 0, вчера: -1 }[
          relative[0].toLowerCase()
        ] ?? 0);
    const candidate = addDays(now, offset);
    if (Number.isFinite(+candidate) && candidate.getFullYear() <= 9999) {
      day = localDay(candidate);
      found = true;
    } else warning = "Слишком далёкая дата. Укажите дату в форме.";
  }

  const explicit =
    text.match(/(?:^|\s)(\d{4})-(\d{2})-(\d{2})(?=\s|$)/) ??
    text.match(/(?:^|\s)(\d{1,2})\.(\d{1,2})\.(\d{4})(?=\s|$)/);
  if (explicit) {
    const parts = explicit[0].includes("-")
      ? [explicit[1], explicit[2], explicit[3]]
      : [explicit[3], explicit[2], explicit[1]];
    const candidate = `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
    if (isValidDate(candidate)) {
      day = candidate;
      found = true;
    } else warning = "Проверьте дату: она не распознана.";
  }
  if (!found)
    weekdays.forEach((word, index) => {
      if (text.toLowerCase().includes(word)) {
        day = localDay(addDays(now, (index - now.getDay() + 7) % 7 || 7));
        found = true;
      }
    });
  const clock = text.match(
    /(?:^|\s)(?:в\s+)?([01]?\d|2[0-3]):([0-5]\d)(?=\s|$)/,
  );
  if (clock) time = `${clock[1].padStart(2, "0")}:${clock[2]}`;
  else if (/утром/i.test(text)) time = "09:00";
  else if (/днём|днем/i.test(text)) time = "13:00";
  else if (/вечером/i.test(text)) time = "18:00";
  return { day, time, found, warning };
}
export function parseHabitInput(text: string, data: Data) {
  const lower = text.toLowerCase();
  const semantic = /читал|прочитал|читала|чтение/.test(lower)
    ? "reading"
    : /учил|учёб|учеб|занимался уч/.test(lower)
      ? "study"
      : /трениров|спорт/.test(lower)
        ? "sport"
        : /воду|воды|вода|выпил/.test(lower)
          ? "water"
          : "";
  const candidates = data.daily_goals.filter(
    (g) =>
      !g.deleted_at &&
      !g.archived &&
      (lower.includes(g.name.toLowerCase()) ||
        g.aliases
          .split(",")
          .some((a) => a.trim() && lower.includes(a.trim().toLowerCase())) ||
        (semantic &&
          (g.icon === semantic ||
            (semantic === "reading" && /чтен|книг/i.test(g.name)) ||
            (semantic === "study" && /уч[её]б|обуч/i.test(g.name)) ||
            (semantic === "sport" && /трениров|спорт/i.test(g.name)) ||
            (semantic === "water" && /вод/i.test(g.name))))),
  );
  const number = (value: string) => Number(value.replace(",", "."));
  const hours = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:час|ч(?=\s|$))/),
    minutes = lower.match(/(\d+(?:[.,]\d+)?)\s*мин/);
  const amount = lower.match(
    /(\d+(?:[.,]\d+)?)\s*(страниц|стр\b|мл|литр|л(?=\s|$))/,
  );
  const value =
    hours || minutes
      ? (hours ? number(hours[1]) * 60 : 0) + (minutes ? number(minutes[1]) : 0)
      : amount
        ? number(amount[1]) * (/^л/.test(amount[2]) ? 1000 : 1)
        : /выполн|сделан|готов/.test(lower)
          ? 1
          : undefined;
  const unit =
    hours || minutes
      ? "мин"
      : amount
        ? /страниц|стр/.test(amount[2])
          ? "страниц"
          : "мл"
        : "раз";
  const matching = candidates.filter((g) =>
    g.kind === "boolean"
      ? unit === "раз"
      : g.unit === unit || (unit === "мин" && /минут|minutes/.test(g.unit)),
  );
  return {
    candidates: matching,
    value,
    recognized: !!semantic || candidates.length > 0,
  };
}
export function parseSmartInput(
  text: string,
  data: Data,
  now = new Date(),
  override?: SmartKind,
) {
  const lower = text.toLowerCase(),
    date = parseDate(text, now),
    habitMatch = parseHabitInput(text, data);
  const inferred: SmartKind = /потратил|расход|заплатил|оплатил|купил/.test(
    lower,
  )
    ? "expense"
    : /получил|доход|зарплата/.test(lower)
      ? "income"
      : /встреча|созвон|совещание|событие/.test(lower)
        ? "event"
        : /идея|заметка|запиши/.test(lower)
          ? "note"
          : /купить|сделать|позвонить|задача|отправить|завтра|сегодня/.test(
                lower,
              )
            ? "task"
            : "inbox";
  const kind =
    override ??
    (habitMatch.recognized &&
    habitMatch.value !== undefined &&
    !["expense", "income", "event", "note"].includes(inferred)
      ? "habit"
      : inferred);
  const currency = /\$|usd|доллар/i.test(text)
    ? "USD"
    : /€|eur|евро/i.test(text)
      ? "EUR"
      : "RUB";
  const amountText = text.replace(
    /\d{4}-\d{2}-\d{2}|\d{1,2}\.\d{1,2}\.\d{4}|\d{1,2}:\d{2}|через\s+\d+\s+дн[яей]*/gi,
    "",
  );
  const amountMatch = amountText.match(
    /(?:\d{1,3}(?:[ \u00a0]\d{3})+|\d+)(?:[.,]\d{1,2})?/,
  );
  const amount = amountMatch
    ? Number(amountMatch[0].replace(/[ \u00a0]/g, "").replace(",", "."))
    : 0;
  const project = data.projects.find(
    (p) => !p.deleted_at && lower.includes(`#${p.name.toLowerCase()}`),
  );
  const categoryName = /такси|метро|бензин|автобус|транспорт/.test(lower)
    ? "Транспорт"
    : /зарплат/.test(lower)
      ? "Зарплата"
      : /еда|продукт|магазин|кофе/.test(lower)
        ? "Продукты"
        : "";
  const category = data.categories.find(
    (c) =>
      !c.deleted_at &&
      c.type === kind &&
      (c.name.toLowerCase() === categoryName.toLowerCase() ||
        lower.includes(c.name.toLowerCase())),
  );
  const account = data.accounts.find(
    (a) => !a.deleted_at && a.currency === currency,
  );
  const title = text.trim().slice(0, 200);
  let table: Table = "inbox",
    fields: Record<string, unknown> = {
      title,
      content: text,
      project_id: project?.id ?? "",
    };
  if (kind === "task") {
    table = "tasks";
    fields = {
      title,
      description: text,
      project_id: project?.id ?? "",
      due_date:
        date.found || date.time
          ? date.day + (date.time ? `T${date.time}` : "")
          : "",
    };
  }
  if (kind === "note") {
    table = "notes";
    fields = {
      title,
      content_text: text,
      content_json: richText(text),
      project_id: project?.id ?? "",
    };
  }
  if (kind === "event") {
    table = "events";
    const start = `${date.day}T${date.time || "09:00"}`;
    fields = {
      title,
      project_id: project?.id ?? "",
      start_at: start,
      end_at: format(
        new Date(+new Date(start) + 3600000),
        "yyyy-MM-dd'T'HH:mm",
      ),
    };
  }
  if (kind === "expense" || kind === "income") {
    table = "transactions";
    fields = {
      note: text,
      type: kind,
      amount,
      date: date.day,
      account_id: account?.id ?? "",
      category_id: category?.id ?? "",
      new_category: category ? "" : categoryName,
      project_id: project?.id ?? "",
    };
  }
  if (kind === "habit") {
    table = "daily_goal_entries";
    fields = {
      goal_id:
        habitMatch.candidates.length === 1 ? habitMatch.candidates[0].id : "",
      day: date.day,
      value: habitMatch.value ?? 0,
    };
  }
  return {
    habitMatch,
    kind,
    table,
    fields,
    date,
    amount,
    currency,
    categoryName,
    category,
    account,
    warning:
      date.warning ||
      (kind === "habit" && !habitMatch.candidates.length
        ? "Подходящая привычка не найдена. Создайте её в разделе «Привычки» или проверьте единицу измерения."
        : "") ||
      ((kind === "expense" || kind === "income") && !account
        ? `Сначала создайте счёт в ${currency} в разделе «Финансы».`
        : ""),
  };
}
