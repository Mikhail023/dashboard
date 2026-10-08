import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import Database from "better-sqlite3";
import { randomUUID, createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Repository } from "../src/main/database";
import { hashPassword, verifyPassword, LoginLimiter } from "../src/main/auth";
import { seed } from "../src/main/demo";
import {
  budgetProgress,
  remainingBudget,
} from "../src/shared/finance-planning";
import { backup, importData, prepareRestore } from "../src/main/backup";
import {
  progress,
  balance,
  summary,
  occurrences,
} from "../src/shared/calculations";
let repo: Repository, dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "dashboard-test-"));
  repo = new Repository(
    join(dir, "test.db"),
    join(process.cwd(), "migrations"),
  );
});
afterEach(() => {
  repo.close();
  rmSync(dir, { recursive: true, force: true });
});
describe("SQLite and migrations", () => {
  it("round-trips a recurring completion that was undone and completed again", () => {
    const task = repo.save("tasks", {
      title: "Daily",
      due_date: "2026-10-06",
      recurrence_rule: "daily",
    });
    repo.completeTask(task.id, "2026-10-06", true);
    repo.completeTask(task.id, "2026-10-06", false);
    repo.completeTask(task.id, "2026-10-06", true);
    const dump = { version: 2, data: repo.data() };
    const file = join(dir, "roundtrip.json");
    writeFileSync(file, JSON.stringify(dump));
    const target = new Repository(
      join(dir, "roundtrip.db"),
      join(process.cwd(), "migrations"),
    );
    try {
      importData(target, file);
      expect(target.data().task_completions).toEqual(
        dump.data.task_completions,
      );
    } finally {
      target.close();
    }
  });
  it("upgrades a real v1 database and stages legacy restore without changing the source", async () => {
    seed(repo);
    const oldPath = join(dir, "legacy.db"),
      old = new Database(oldPath);
    old.exec(
      readFileSync(join(process.cwd(), "migrations/001_init.sql"), "utf8"),
    );
    old.exec(
      "CREATE TABLE schema_migrations(version TEXT PRIMARY KEY); INSERT INTO schema_migrations VALUES('001_init.sql')",
    );
    const oldTables = old
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[];
    const snapshot = repo.data();
    for (const { name } of oldTables) {
      if (!(name in snapshot)) continue;
      const columns = (
        old.prepare(`PRAGMA table_info(${name})`).all() as { name: string }[]
      ).map((c) => c.name);
      for (const row of snapshot[name as keyof typeof snapshot]) {
        const values = columns.map((c) => {
          const value = (row as unknown as Record<string, unknown>)[c];
          return typeof value === "boolean" ? Number(value) : value;
        });
        old
          .prepare(
            `INSERT INTO ${name} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
          )
          .run(...values);
      }
    }
    const password = hashPassword("legacy-password");
    old
      .prepare("INSERT INTO users VALUES(?,?,?,?,?,?,?)")
      .run(
        randomUUID(),
        "Legacy",
        "",
        password.hash,
        password.salt,
        "🌿",
        new Date().toISOString(),
      );
    old.close();
    const fingerprint = () =>
      createHash("sha256").update(readFileSync(oldPath)).digest("hex");
    const before = fingerprint(),
      staged = await prepareRestore(oldPath, join(process.cwd(), "migrations"));
    try {
      expect(fingerprint()).toBe(before);
      const upgraded = new Repository(
        staged.path,
        join(process.cwd(), "migrations"),
      );
      try {
        expect(upgraded.data().notes).toEqual(snapshot.notes);
        expect(upgraded.data().transactions).toEqual(snapshot.transactions);
        expect(upgraded.data().tasks.map((t) => t.id)).toEqual(
          snapshot.tasks.map((t) => t.id),
        );
        expect(upgraded.data().inbox).toHaveLength(0);
        expect(
          upgraded.db
            .prepare("SELECT count(*) AS n FROM schema_migrations")
            .get(),
        ).toEqual({ n: 3 });
      } finally {
        upgraded.close();
      }
    } finally {
      staged.cleanup();
    }
  });
  it("imports v1 JSON with missing new tables and preserves historical timestamps", () => {
    seed(repo);
    const data = JSON.parse(JSON.stringify(repo.data()));
    for (const table of [
      "inbox",
      "budgets",
      "financial_goals",
      "task_completions",
      "daily_goals",
      "daily_goal_entries",
    ])
      delete data[table];
    for (const task of data.tasks)
      for (const key of [
        "note_id",
        "recurrence_rule",
        "recurrence_interval",
        "recurrence_days",
        "recurrence_until",
      ])
        delete task[key];
    const first = data.notes[0];
    first.updated_at = "2025-01-01T12:00:00.000Z";
    const path = join(dir, "v1.json");
    writeFileSync(path, JSON.stringify({ version: 1, data }));
    importData(repo, path);
    expect(repo.data().notes.find((n) => n.id === first.id)?.updated_at).toBe(
      first.updated_at,
    );
    expect(repo.data().projects).toHaveLength(8);
  });
  it("migrates once and enables foreign keys + WAL", () => {
    repo.migrate(join(process.cwd(), "migrations"));
    expect(
      repo.db.prepare("SELECT count(*) AS n FROM schema_migrations").get(),
    ).toEqual({ n: 3 });
    expect(repo.db.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(repo.db.pragma("journal_mode", { simple: true })).toBe("wal");
  });
  it("persists, updates and soft-deletes notes", () => {
    const n = repo.save("notes", { title: "Локальная заметка" });
    repo.save("notes", { id: n.id, title: "Изменено" });
    repo.close();
    repo = new Repository(
      join(dir, "test.db"),
      join(process.cwd(), "migrations"),
    );
    expect(repo.data().notes[0].title).toBe("Изменено");
    repo.remove("notes", n.id);
    expect(repo.data().notes[0].deleted_at).not.toBe("");
    repo.remove("notes", n.id, true);
    expect(repo.data().notes[0].deleted_at).toBe("");
  });
  it("validates invalid amounts and rejects SQL identifiers", () => {
    expect(() => repo.save("transactions", { amount: -1 })).toThrow();
    expect(() =>
      repo.save("users" as "notes", { title: "injection" }),
    ).toThrow();
  });
  it("seeds the full workspace idempotently and removes only demo records", () => {
    repo.save("notes", { title: "Моя заметка" });
    seed(repo);
    seed(repo);
    expect(repo.data().projects).toHaveLength(8);
    expect(repo.data().transactions).toHaveLength(26);
    repo.clearDemo();
    expect(repo.data().notes.map((n) => n.title)).toEqual(["Моя заметка"]);
    expect(repo.data().projects).toHaveLength(0);
  });
  it("makes a consistent backup and imports JSON atomically", async () => {
    seed(repo);
    const path = await backup(repo, join(dir, "Backups"));
    expect(path).toBeTruthy();
    const dump = { version: 1, data: repo.data() };
    repo.clearDemo();
    const file = join(dir, "export.json");
    writeFileSync(file, JSON.stringify(dump));
    importData(repo, file);
    expect(repo.data().projects).toHaveLength(8);
    dump.data.transactions[0].account_id =
      "00000000-0000-4000-8000-000000000001";
    dump.data.projects[0].name = "Must roll back";
    writeFileSync(file, JSON.stringify(dump));
    expect(() => importData(repo, file)).toThrow();
    expect(repo.data().projects[0].name).not.toBe("Must roll back");
  });
});
describe("Dependent demo records", () => {
  it("stores only recurring completion facts, validates dates and toggles idempotently", () => {
    const task = repo.save("tasks", {
      title: "Repeat",
      due_date: "2026-10-05",
      recurrence_rule: "weekly",
    });
    repo.completeTask(task.id, "2026-10-12", true);
    repo.completeTask(task.id, "2026-10-12", true);
    expect(repo.data().task_completions).toHaveLength(1);
    expect(repo.data().tasks).toHaveLength(1);
    expect(repo.data().tasks[0].status).toBe("todo");
    expect(() => repo.completeTask(task.id, "2026-10-13", true)).toThrow();
    repo.completeTask(task.id, "2026-10-12", false);
    expect(
      repo.data().task_completions.filter((c) => !c.deleted_at),
    ).toHaveLength(0);
  });
  it("converts Inbox atomically and prevents duplicate conversion", () => {
    const project = repo.save("projects", { name: "Dashboard" });
    const item = repo.save("inbox", {
      title: "Идея",
      content: "Полный текст",
      project_id: project.id,
      tags: "работа",
    });
    const note = repo.convertInbox(item.id, "notes");
    expect(note).toMatchObject({
      content_text: "Полный текст",
      project_id: project.id,
      tags: "работа",
    });
    expect(repo.data().inbox[0]).toMatchObject({
      status: "processed",
      converted_id: note.id,
    });
    expect(() => repo.convertInbox(item.id, "tasks")).toThrow();
    expect(repo.data().tasks).toHaveLength(0);
  });
  it("persists task-note links and rejects missing references", () => {
    const note = repo.save("notes", { title: "Idea" });
    const task = repo.save("tasks", { title: "Action", note_id: note.id });
    expect(repo.data().tasks.find((t) => t.id === task.id)?.note_id).toBe(
      note.id,
    );
    expect(() =>
      repo.save("tasks", {
        title: "Invalid",
        note_id: "00000000-0000-4000-8000-000000000001",
      }),
    ).toThrow();
  });
  it("preserves a demo account referenced by a user transaction", () => {
    seed(repo);
    const a = repo.data().accounts[0];
    repo.save("transactions", {
      account_id: a.id,
      type: "income",
      amount: 10,
      date: "2026-10-05",
    });
    repo.clearDemo();
    expect(repo.data().accounts.some((x) => x.id === a.id)).toBe(true);
    expect(repo.data().transactions).toHaveLength(1);
  });
  it("rejects malformed rich text JSON", () => {
    expect(() =>
      repo.save("notes", { title: "Broken", content_json: "not json" }),
    ).toThrow();
  });
});
describe("Authentication", () => {
  it("hashes with unique salts and constant-length hashes", () => {
    const a = hashPassword("password123"),
      b = hashPassword("password123");
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toContain("password");
    expect(verifyPassword("password123", a.salt, a.hash)).toBe(true);
    expect(verifyPassword("wrong", a.salt, a.hash)).toBe(false);
  });
  it("locks after five failures", () => {
    const limiter = new LoginLimiter();
    for (let i = 0; i < 5; i++) limiter.fail();
    expect(() => limiter.check()).toThrow();
    limiter.reset();
    expect(() => limiter.check()).not.toThrow();
  });
});
describe("Calculations", () => {
  it("calculates budgets by month/currency and completes goals from progress", () => {
    const rub = repo.save("accounts", { name: "RUB" }),
      usd = repo.save("accounts", { name: "USD", currency: "USD" });
    const category = repo.save("categories", { name: "Такси" });
    const budget = repo.save("budgets", {
      name: "Транспорт",
      amount: 1000,
      category_id: category.id,
    });
    repo.save("transactions", {
      account_id: rub.id,
      type: "expense",
      amount: 890,
      date: "2026-10-06",
      category_id: category.id,
    });
    repo.save("transactions", {
      account_id: usd.id,
      type: "expense",
      amount: 100,
      date: "2026-10-06",
      category_id: category.id,
    });
    expect(budgetProgress(repo.data(), budget, "2026-10")).toEqual({
      spent: 890,
      remaining: 110,
      percentage: 89,
    });
    expect(remainingBudget(repo.data(), "RUB", "2026-10")).toBe(110);
    expect(() =>
      repo.save("budgets", {
        name: "Дубль",
        amount: 10,
        category_id: category.id,
      }),
    ).toThrow();
    const goal = repo.save("financial_goals", {
      name: "MacBook",
      target_amount: 250000,
      current_amount: 180000,
    });
    expect(
      repo.save("financial_goals", { id: goal.id, current_amount: 250000 })
        .status,
    ).toBe("completed");
  });
  it("calculates task completion and zero denominator", () => {
    expect(progress([])).toBe(0);
    const a = repo.save("tasks", { title: "A", status: "done" }),
      b = repo.save("tasks", { title: "B" });
    expect(progress([a, b])).toBe(50);
  });
  it("handles decimal amounts and transfers without double counting income", () => {
    const a = repo.save("accounts", { name: "A", balance_initial: 100 }),
      b = repo.save("accounts", { name: "B" });
    const date = new Date().toISOString().slice(0, 10);
    repo.save("transactions", {
      account_id: a.id,
      type: "income",
      amount: 0.1,
      date,
    });
    repo.save("transactions", {
      account_id: a.id,
      type: "income",
      amount: 0.2,
      date,
    });
    repo.save("transactions", {
      account_id: a.id,
      to_account_id: b.id,
      type: "transfer",
      amount: 20,
      date,
    });
    const data = repo.data();
    expect(balance(data, a)).toBe(80.3);
    expect(balance(data, b)).toBe(20);
    expect(summary(data).income).toBe(0.3);
    expect(summary(data).balance).toBe(100.3);
  });
  it("rejects transfers between currencies", () => {
    const a = repo.save("accounts", { name: "A" }),
      b = repo.save("accounts", { name: "B", currency: "USD" });
    expect(() =>
      repo.save("transactions", {
        account_id: a.id,
        to_account_id: b.id,
        type: "transfer",
        amount: 20,
        date: "2026-01-01",
      }),
    ).toThrow("валюты");
  });
  it("expands monthly recurrence at month-end without date overflow", () => {
    const event = repo.save("events", {
      title: "Месяц",
      start_at: "2026-01-31T10:00",
      end_at: "2026-01-31T11:00",
      recurrence_rule: "monthly",
    });
    const dates = occurrences(
      event,
      new Date("2026-01-01"),
      new Date("2026-04-01"),
    );
    expect(dates.map((d) => d.getDate())).toEqual([31, 28, 31]);
  });
});

it("imports deleted transactions and their deleted account without losing history", () => {
  const account = repo.save("accounts", { name: "Old account" });
  const tx = repo.save("transactions", {
    account_id: account.id,
    type: "expense",
    amount: 123,
    date: "2026-01-01",
  });
  repo.remove("transactions", tx.id);
  repo.remove("accounts", account.id);
  const dump = { version: 2, data: repo.data() };
  const file = join(dir, "deleted.json");
  writeFileSync(file, JSON.stringify(dump));
  const target = new Repository(
    join(dir, "target.db"),
    join(process.cwd(), "migrations"),
  );
  try {
    importData(target, file);
    expect(target.data().transactions).toEqual(dump.data.transactions);
    expect(target.data().accounts).toEqual(dump.data.accounts);
  } finally {
    target.close();
  }
});

it("rejects impossible calendar dates and compares event times chronologically", () => {
  expect(() =>
    repo.save("tasks", { title: "Bad date", due_date: "2026-02-30" }),
  ).toThrow();
  expect(() =>
    repo.save("tasks", {
      title: "Bad repeat",
      due_date: "2026-02-01",
      recurrence_rule: "daily",
      recurrence_until: "2026-02-30",
    }),
  ).toThrow();
  expect(() =>
    repo.save("events", {
      title: "Offset event",
      start_at: "2026-10-06T10:00:00+05:00",
      end_at: "2026-10-06T06:00:00Z",
    }),
  ).not.toThrow();
});

it("prevents completing a recurring master as if it were a single occurrence", () => {
  expect(() =>
    repo.save("tasks", {
      title: "Repeat",
      due_date: "2026-10-01",
      recurrence_rule: "daily",
      status: "done",
    }),
  ).toThrow(/конкретного повтора/);
});
