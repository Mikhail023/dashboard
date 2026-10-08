import type Database from "better-sqlite3";
import { plainSQLite, type DatabaseFactory } from "./storage";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { z } from "zod";
import { richText, localDay } from "../shared/smart-input";
import { expandRecurrence } from "../shared/recurrence";
import {
  schemas,
  tables,
  emptyData,
  type Table,
  type Data,
  type Row,
} from "../shared/model";
export class Repository {
  db: Database.Database;
  constructor(
    path: string,
    migrationDir: string,
    factory: DatabaseFactory = plainSQLite,
  ) {
    this.db = factory.open(path);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.migrate(migrationDir);
    this.db
      .prepare(
        "DELETE FROM notes WHERE deleted_at <> '' AND deleted_at < ? AND id NOT IN (SELECT note_id FROM tasks WHERE note_id <> '') AND id NOT IN (SELECT converted_id FROM inbox WHERE converted_table='notes')",
      )
      .run(new Date(Date.now() - 30 * 86400000).toISOString());
  }
  migrate(dir: string) {
    this.db.exec(
      "CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY)",
    );
    for (const file of readdirSync(dir)
      .filter((f) => /^\d+.*\.sql$/.test(f))
      .sort()) {
      if (
        !this.db
          .prepare("SELECT 1 FROM schema_migrations WHERE version=?")
          .get(file)
      )
        this.db.transaction(() => {
          this.db.exec(readFileSync(join(dir, file), "utf8"));
          this.db.prepare("INSERT INTO schema_migrations VALUES (?)").run(file);
        })();
    }
  }
  rows<T extends Table>(table: T): Row<T>[] {
    if (!tables.includes(table)) throw new Error("Неизвестная таблица");
    const rows = this.db
      .prepare(`SELECT * FROM ${table} ORDER BY created_at DESC`)
      .all() as Record<string, unknown>[];
    for (const row of rows)
      for (const key of ["pinned", "archived", "done", "all_day", "demo"])
        if (key in row) row[key] = Boolean(row[key]);
    return rows as Row<T>[];
  }
  data(): Data {
    const data = emptyData();
    for (const table of tables)
      Object.assign(data, { [table]: this.rows(table) });
    return data;
  }
  save<T extends Table>(
    table: T,
    input: Record<string, unknown>,
    demo = false,
    imported?: { created_at: string; updated_at: string; deleted_at: string },
  ): Row<T> {
    if (!tables.includes(table)) throw new Error("Неизвестная таблица");
    const id = input.id !== undefined ? z.uuid().parse(input.id) : randomUUID();
    const previous = this.db
      .prepare(`SELECT * FROM ${table} WHERE id=?`)
      .get(id) as Record<string, unknown> | undefined;
    const normalized = { ...previous };
    for (const key of ["pinned", "archived", "done", "all_day"])
      if (key in normalized) normalized[key] = Boolean(normalized[key]);
    Object.assign(normalized, input);
    const fields = schemas[table].parse(normalized) as Record<string, unknown>;
    if (table === "daily_goals" && previous) {
      const earliest = this.db
        .prepare(
          "SELECT min(day) AS day FROM daily_goal_entries WHERE goal_id=? AND deleted_at=''",
        )
        .get(id) as { day: string | null };
      if (!imported && earliest.day) {
        if (fields.kind !== previous.kind || fields.unit !== previous.unit)
          throw new Error(
            "У привычки есть история. Для другого типа или единицы создайте новую привычку.",
          );
        if (String(fields.start_date) > earliest.day)
          throw new Error(
            "Дата начала не может быть позже существующих отметок",
          );
      }
    }
    if (table === "daily_goals" && fields.kind === "boolean") {
      fields.target_value = 1;
      fields.unit = "раз";
    }
    if (table === "daily_goal_entries") {
      const goal = this.db
        .prepare("SELECT * FROM daily_goals WHERE id=?")
        .get(fields.goal_id) as Row<"daily_goals"> | undefined;
      if (!goal || (!imported && goal.deleted_at))
        throw new Error("Привычка не найдена");
      if (
        !imported &&
        (String(fields.day) < goal.start_date ||
          String(fields.day) > localDay())
      )
        throw new Error("Выберите день от начала привычки до сегодня");
      if (goal.kind === "boolean" && fields.value !== 0 && fields.value !== 1)
        throw new Error("Для привычки да/нет допустимы только 0 и 1");
    }
    if (table === "budgets") {
      if (
        !imported?.deleted_at &&
        this.db
          .prepare(
            "SELECT id FROM budgets WHERE category_id=? AND currency=? AND deleted_at='' AND id<>?",
          )
          .get(fields.category_id, fields.currency, id)
      )
        throw new Error("Бюджет для этой категории и валюты уже существует");
      if (
        fields.category_id &&
        !this.db
          .prepare("SELECT id FROM categories WHERE id=? AND type='expense'")
          .get(fields.category_id)
      )
        throw new Error("Выберите категорию расходов");
    }
    if (table === "financial_goals")
      fields.status =
        Number(fields.current_amount) >= Number(fields.target_amount)
          ? "completed"
          : "active";
    if ((table === "tasks" || table === "events") && fields.recurrence_rule) {
      const start = String(
        table === "tasks" ? fields.due_date : fields.start_at,
      );
      if (!start) throw new Error("Для повтора укажите дату начала");
      if (
        fields.recurrence_until &&
        String(fields.recurrence_until) < start.slice(0, 10)
      )
        throw new Error("Повтор заканчивается раньше начала");
      if (fields.recurrence_rule === "selected" && !fields.recurrence_days)
        throw new Error("Выберите дни недели");
    }
    if (
      table === "tasks" &&
      fields.recurrence_rule &&
      fields.status === "done" &&
      !imported
    )
      throw new Error(
        "Отметьте выполнение конкретного повтора в задачах или календаре. Для серии выберите статус «К выполнению», «В работе» или «Ожидает».",
      );
    if (table === "tasks")
      fields.completed_at =
        fields.status === "done"
          ? fields.completed_at || new Date().toISOString()
          : "";
    if (
      table === "events" &&
      (!fields.start_at ||
        !fields.end_at ||
        Date.parse(String(fields.end_at)) < Date.parse(String(fields.start_at)))
    )
      throw new Error("Окончание события должно быть после начала");
    if (
      table === "accounts" &&
      previous &&
      previous.currency !== fields.currency &&
      this.db
        .prepare(
          "SELECT id FROM transactions WHERE account_id=? OR to_account_id=? LIMIT 1",
        )
        .get(id, id)
    )
      throw new Error("Нельзя менять валюту счёта с операциями");
    if (table === "transactions") {
      this.validateTransaction(fields, Boolean(imported));
      if (previous?.invoice_id)
        throw new Error(
          "Оплата связана со счётом-фактурой и не может быть изменена отдельно",
        );
    }
    const relations: Record<string, Table> = {
      goal_id: "daily_goals",
      project_id: "projects",
      note_id: "notes",
      folder_id: "note_folders",
      task_id: "tasks",
      category_id: "categories",
      invoice_id: "invoices",
    };
    for (const [field, target] of Object.entries(relations)) {
      const value = fields[field];
      if (
        value &&
        !this.db.prepare(`SELECT id FROM ${target} WHERE id=?`).get(value)
      )
        throw new Error("Связанная запись не найдена");
    }
    if (table === "invoice_items") {
      const invoice = this.db
        .prepare("SELECT status FROM invoices WHERE id=?")
        .get(fields.invoice_id) as { status: string } | undefined;
      if (invoice?.status === "paid")
        throw new Error("Нельзя менять позиции оплаченного счёта");
    }
    if (table === "invoices" && previous?.status === "paid")
      throw new Error("Оплаченный счёт нельзя изменять");
    if (
      table === "invoices" &&
      fields.status === "paid" &&
      previous?.status !== "paid"
    )
      throw new Error("Используйте действие «Отметить оплаченным»");
    const now = new Date().toISOString();
    const row = {
      ...fields,
      id,
      created_at: imported?.created_at ?? previous?.created_at ?? now,
      updated_at: imported?.updated_at ?? now,
      deleted_at: imported?.deleted_at ?? previous?.deleted_at ?? "",
      demo: imported ? demo : (previous?.demo ?? demo),
    };
    const keys = Object.keys(row);
    const values = Object.values(row).map((v) =>
      typeof v === "boolean" ? Number(v) : v,
    ) as (string | number | null)[];
    this.db
      .prepare(
        `INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")}) ON CONFLICT(id) DO UPDATE SET ${keys
          .filter((k) => k !== "id")
          .map((k) => `${k}=excluded.${k}`)
          .join(",")}`,
      )
      .run(...values);
    return { ...row, demo: Boolean(row.demo) } as Row<T>;
  }
  validateTransaction(f: Record<string, unknown>, importing = false) {
    const a = this.db
      .prepare(
        `SELECT * FROM accounts WHERE id=? ${importing ? "" : "AND deleted_at=''"}`,
      )
      .get(f.account_id) as Row<"accounts"> | undefined;
    if (!a) throw new Error("Выберите счёт");
    if (f.type === "transfer") {
      const b = this.db
        .prepare(
          `SELECT * FROM accounts WHERE id=? ${importing ? "" : "AND deleted_at=''"}`,
        )
        .get(f.to_account_id) as Row<"accounts"> | undefined;
      if (!b || b.id === a.id)
        throw new Error("Выберите другой счёт для перевода");
      if (a.currency !== b.currency)
        throw new Error("Перевод доступен между счетами одной валюты");
    }
  }
  convertInbox(id: string, table: "notes" | "tasks" | "projects") {
    return this.db.transaction(() => {
      const item = this.db
        .prepare("SELECT * FROM inbox WHERE id=? AND deleted_at=''")
        .get(z.uuid().parse(id)) as Row<"inbox"> | undefined;
      if (!item || item.status !== "pending")
        throw new Error("Запись уже обработана или удалена");
      const content = item.content || item.title;
      const row = this.save(
        table,
        table === "projects"
          ? { name: item.title, description: content }
          : table === "notes"
            ? {
                title: item.title,
                content_text: content,
                content_json: richText(content),
                tags: item.tags,
                project_id: item.project_id,
              }
            : {
                title: item.title,
                description: content,
                project_id: item.project_id,
              },
      );
      this.save("inbox", {
        id,
        status: "processed",
        converted_table: table,
        converted_id: row.id,
      });
      return row;
    })();
  }
  recordGoal(goalId: string, day: string, value: number, mode: "set" | "add") {
    return this.db.transaction(() => {
      const goal = this.rows("daily_goals").find(
        (g) => g.id === goalId && !g.deleted_at && !g.archived,
      );
      if (!goal) throw new Error("Выберите активную привычку");
      const previous = this.db
        .prepare(
          "SELECT * FROM daily_goal_entries WHERE goal_id=? AND day=? AND deleted_at=''",
        )
        .get(goalId, day) as Row<"daily_goal_entries"> | undefined;
      return this.save("daily_goal_entries", {
        ...(previous ? { id: previous.id } : {}),
        goal_id: goalId,
        day,
        value:
          goal.kind === "boolean"
            ? value
            : mode === "add"
              ? (previous?.value ?? 0) + value
              : value,
      });
    })();
  }
  completeTask(id: string, day: string, completed: boolean) {
    return this.db.transaction(() => {
      const task = this.db
        .prepare("SELECT * FROM tasks WHERE id=? AND deleted_at=''")
        .get(id) as Row<"tasks"> | undefined;
      if (
        !task?.recurrence_rule ||
        !expandRecurrence(
          task.due_date,
          task,
          new Date(day + "T00:00"),
          new Date(day + "T23:59:59.999"),
        ).length
      )
        throw new Error("Такого повтора задачи нет");
      const previous = this.db
        .prepare(
          "SELECT id FROM task_completions WHERE task_id=? AND occurrence_date=? AND deleted_at=''",
        )
        .get(id, day) as { id: string } | undefined;
      if (!completed) {
        if (previous) this.remove("task_completions", previous.id);
        return true;
      }
      if (!previous)
        this.save("task_completions", {
          task_id: id,
          occurrence_date: day,
          completed_at: new Date().toISOString(),
        });
      return true;
    })();
  }
  remove(table: Table, id: string, restore = false) {
    if (!tables.includes(table)) throw new Error("Неизвестная таблица");
    if (table === "invoices") {
      const invoice = this.db
        .prepare("SELECT status FROM invoices WHERE id=?")
        .get(id) as { status: string } | undefined;
      if (invoice?.status === "paid")
        throw new Error("Нельзя удалить оплаченный счёт");
    }
    if (table === "invoice_items") {
      const item = this.db
        .prepare("SELECT invoice_id FROM invoice_items WHERE id=?")
        .get(id) as { invoice_id: string } | undefined;
      const inv = item
        ? (this.db
            .prepare("SELECT status FROM invoices WHERE id=?")
            .get(item.invoice_id) as { status: string })
        : undefined;
      if (inv?.status === "paid")
        throw new Error("Нельзя удалить позицию оплаченного счёта");
    }
    if (
      table === "accounts" &&
      this.db
        .prepare(
          "SELECT id FROM transactions WHERE (account_id=? OR to_account_id=?) AND deleted_at='' LIMIT 1",
        )
        .get(id, id)
    )
      throw new Error("Нельзя удалить счёт с операциями");
    if (table === "transactions") {
      const tx = this.db
        .prepare("SELECT invoice_id FROM transactions WHERE id=?")
        .get(id) as { invoice_id: string } | undefined;
      if (tx?.invoice_id)
        throw new Error("Транзакция связана с оплаченным счётом");
    }
    this.db
      .prepare(`UPDATE ${table} SET deleted_at=?,updated_at=? WHERE id=?`)
      .run(
        restore ? "" : new Date().toISOString(),
        new Date().toISOString(),
        id,
      );
  }
  settings() {
    return Object.fromEntries(
      (
        this.db.prepare("SELECT key,value FROM settings").all() as {
          key: string;
          value: string;
        }[]
      ).map((r) => [r.key, r.value]),
    );
  }
  setSettings(settings: Record<string, string>) {
    const q = this.db.prepare(
      "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    );
    this.db.transaction(() => {
      for (const [k, v] of Object.entries(settings)) q.run(k, v);
    })();
  }
  clearDemo() {
    this.db.transaction(() => {
      const refs: [Table, string, Table][] = [
        ["daily_goal_entries", "goal_id", "daily_goals"],
        ["daily_goals", "project_id", "projects"],
        ["budgets", "category_id", "categories"],
        ["task_completions", "task_id", "tasks"],
        ["inbox", "project_id", "projects"],
        ["notes", "folder_id", "note_folders"],
        ["notes", "project_id", "projects"],
        ["tasks", "project_id", "projects"],
        ["tasks", "note_id", "notes"],
        ["subtasks", "task_id", "tasks"],
        ["events", "project_id", "projects"],
        ["time_entries", "task_id", "tasks"],
        ["time_entries", "project_id", "projects"],
        ["transactions", "account_id", "accounts"],
        ["transactions", "to_account_id", "accounts"],
        ["transactions", "category_id", "categories"],
        ["transactions", "invoice_id", "invoices"],
        ["transactions", "project_id", "projects"],
        ["invoices", "project_id", "projects"],
        ["invoice_items", "invoice_id", "invoices"],
      ];
      // Preserve the minimum demo records that newly created user data depends on.
      for (let pass = 0; pass < 5; pass++) {
        for (const [child, field, parent] of refs)
          this.db
            .prepare(
              `UPDATE ${parent} SET demo=0 WHERE demo=1 AND id IN (SELECT ${field} FROM ${child} WHERE demo=0)`,
            )
            .run();
        this.db
          .prepare(
            "UPDATE invoice_items SET demo=0 WHERE invoice_id IN (SELECT id FROM invoices WHERE demo=0)",
          )
          .run();
      }
      for (const t of [...tables].reverse())
        this.db.prepare(`DELETE FROM ${t} WHERE demo=1`).run();
    })();
  }
  close() {
    this.db.close();
  }
}
