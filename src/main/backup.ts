import {
  existsSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
  readFileSync,
  statSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";
import { z } from "zod";
import { settingsSchema } from "../shared/settings";
import { schemas, tables, type Table } from "../shared/model";
import { Repository } from "./database";
const metadataSchema = z.object({
  created_at: z.string().refine((v) => !Number.isNaN(Date.parse(v))),
  updated_at: z.string().refine((v) => !Number.isNaN(Date.parse(v))),
  deleted_at: z.string().refine((v) => !v || !Number.isNaN(Date.parse(v))),
  demo: z.boolean(),
});
export async function prepareRestore(source: string, migrationDir: string) {
  const dir = mkdtempSync(join(tmpdir(), "dashboard-restore-")),
    path = join(dir, "validated.db");
  const cleanup = () => rmSync(dir, { recursive: true, force: true });
  try {
    const candidate = new Database(source, {
      readonly: true,
      fileMustExist: true,
    });
    try {
      if (candidate.pragma("integrity_check", { simple: true }) !== "ok")
        throw new Error("Резервная копия повреждена");
      const known = new Set(
        readdirSync(migrationDir).filter((f) => f.endsWith(".sql")),
      );
      const versions = candidate
        .prepare("SELECT version FROM schema_migrations")
        .all() as { version: string }[];
      if (versions.some((v) => !known.has(v.version)))
        throw new Error("Копия создана более новой версией Dashboard");
      await candidate.backup(path);
    } finally {
      candidate.close();
    }
    const staged = new Repository(path, migrationDir);
    try {
      const data = staged.data();
      for (const table of tables)
        for (const row of data[table]) {
          schemas[table].parse(row);
          z.uuid().parse(row.id);
          metadataSchema.parse(row);
        }
      const users = staged.db.prepare("SELECT * FROM users").all();
      if (users.length !== 1)
        throw new Error("В копии должен быть один профиль");
      z.object({
        id: z.uuid(),
        name: z.string(),
        email: z.string(),
        avatar_path: z.string(),
        salt: z.string().regex(/^[a-f0-9]{64}$/),
        password_hash: z.string().regex(/^[a-f0-9]{128}$/),
      }).parse(users[0]);
      if ((staged.db.pragma("foreign_key_check") as unknown[]).length)
        throw new Error("Связи в копии повреждены");
      staged.db.pragma("wal_checkpoint(TRUNCATE)");
    } finally {
      staged.close();
    }
    return { path, cleanup };
  } catch (error) {
    cleanup();
    throw error;
  }
}
export async function backup(repo: Repository, dir: string, daily = false) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const today = new Date().toISOString().slice(0, 10);
  if (daily && readdirSync(dir).some((f) => f.startsWith(today))) return;
  const file = join(dir, `${today}-${Date.now()}.db`);
  await repo.db.backup(file);
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".db"))
    .sort()
    .reverse();
  for (const old of files.slice(14)) unlinkSync(join(dir, old));
  repo.setSettings({ lastBackup: new Date().toISOString() });
  return file;
}
export function importData(repo: Repository, path: string) {
  if (!existsSync(path) || statSync(path).size > 50 * 1024 * 1024)
    throw new Error("Файл отсутствует или превышает 50 МБ");
  const input = z
    .object({
      version: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      settings: settingsSchema.optional(),
      profile: z
        .object({
          name: z.string().min(1).max(200),
          email: z.union([z.email(), z.literal("")]),
          avatar_path: z.string().max(32),
        })
        .optional(),
      data: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
    })
    .parse(JSON.parse(readFileSync(path, "utf8")));
  const order: Table[] = [
    "note_folders",
    "projects",
    "accounts",
    "categories",
    "notes",
    "tasks",
    "subtasks",
    "events",
    "invoices",
    "invoice_items",
    "transactions",
    "time_entries",
    "inbox",
    "task_completions",
    "budgets",
    "financial_goals",
    "daily_goals",
    "daily_goal_entries",
  ];
  for (const t of tables) {
    if (
      !input.data[t] &&
      [
        "inbox",
        "task_completions",
        "budgets",
        "financial_goals",
        "daily_goals",
        "daily_goal_entries",
      ].includes(t)
    )
      input.data[t] = [];
    if (!input.data[t]) throw new Error(`Нет раздела ${t}`);
    for (const row of input.data[t]) {
      z.uuid().parse(row.id);
      schemas[t].parse(row);
      metadataSchema.parse(row);
    }
  }
  repo.db.transaction(() => {
    if (input.settings)
      repo.setSettings(input.settings as Record<string, string>);
    if (input.profile)
      repo.db
        .prepare("UPDATE users SET name=?,email=?,avatar_path=?")
        .run(
          input.profile.name,
          input.profile.email,
          input.profile.avatar_path,
        );
    for (const t of order)
      for (const row of input.data[t]) {
        const existing = repo.db
          .prepare(`SELECT * FROM ${t} WHERE id=?`)
          .get(row.id) as Record<string, unknown> | undefined;
        if (t === "invoices" && existing?.status === "paid")
          repo.db
            .prepare("UPDATE invoices SET status='unsent' WHERE id=?")
            .run(row.id);
        if (t === "transactions" && existing?.invoice_id)
          repo.db
            .prepare("UPDATE transactions SET invoice_id='' WHERE id=?")
            .run(row.id);
        repo.save(
          t,
          t === "invoices" && row.status === "paid"
            ? { ...row, status: "unsent" }
            : row,
          Boolean(row.demo),
          metadataSchema.parse(row),
        );
      }
    for (const row of input.data.invoices)
      if (row.status === "paid")
        repo.db
          .prepare("UPDATE invoices SET status='paid' WHERE id=?")
          .run(row.id);
  })();
}
