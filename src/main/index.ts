import {
  app,
  BrowserWindow,
  ipcMain,
  powerMonitor,
  systemPreferences,
  session,
  dialog,
  Notification,
  Tray,
  Menu,
  nativeImage,
} from "electron";
import { join } from "node:path";
import {
  mkdirSync,
  writeFileSync,
  appendFileSync,
  copyFileSync,
  existsSync,
  unlinkSync,
  chmodSync,
  renameSync,
} from "node:fs";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { settingsSchema } from "../shared/settings";
import { Repository } from "./database";
import { hashPassword, verifyPassword, LoginLimiter } from "./auth";
import { backup, importData, prepareRestore } from "./backup";
import { seed } from "./demo";
import {
  tables,
  calendarDay,
  registration,
  type Request,
  type Response,
  type Profile,
  type TimerState,
  type Row,
} from "../shared/model";
import { localDay } from "../shared/smart-input";
import { invoiceTotal, occurrences } from "../shared/calculations";
import { splashEnabled, splashTiming } from "../shared/splash";
import { createUpdateService } from "./updates";
import {
  createSplashWindow,
  getSplashAppearance,
  loadSplashWindow,
} from "./splash";
app.setName("Dashboard");
app.commandLine.appendSwitch("disable-background-networking");
app.commandLine.appendSwitch("disable-component-update");
if (!process.env.DASHBOARD_TEST_DATA && !app.requestSingleInstanceLock())
  app.quit();
app.on("second-instance", () => {
  if (dashboardVisible) {
    win?.show();
    win?.focus();
  } else {
    splash?.show();
    splash?.focus();
  }
});
if (process.env.DASHBOARD_TEST_DATA)
  app.setPath("userData", process.env.DASHBOARD_TEST_DATA);
const userDir = app.getPath("userData"),
  dbPath = join(userDir, "dashboard.db"),
  migrationDir = join(app.getAppPath(), "migrations");
let repo: Repository;
let win: BrowserWindow;
let splash: BrowserWindow | null = null;
let tray: Tray;
let authenticated = false;
let quitting = false;
const limiter = new LoginLimiter();
let activity = Date.now();
const notified = new Set<string>();
let timer: TimerState = {
  task_id: "",
  project_id: "",
  started_at: "",
  running_since: null,
  elapsed: 0,
};
let revealInProgress = false;
let dashboardVisible = false;
let splashShownAt = 0;
let updates: ReturnType<typeof createUpdateService> | undefined;
const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

async function revealDashboard() {
  if (revealInProgress || !win || win.isDestroyed()) return;
  revealInProgress = true;
  const remaining = splash
    ? Math.max(0, splashTiming.minimumVisibleMs - (Date.now() - splashShownAt))
    : 0;
  if (remaining) await wait(remaining);
  if (splash && !splash.isDestroyed())
    splash.webContents.send("dashboard:splash-complete");
  if (splash) await wait(splashTiming.fadeOutMs);
  if (!win.isDestroyed()) {
    dashboardVisible = true;
    win.show();
  }
  if (splash && !splash.isDestroyed()) splash.destroy();
  splash = null;
  updates?.start();
}
const profile = () =>
  repo.db
    .prepare("SELECT id,name,email,avatar_path FROM users LIMIT 1")
    .get() as Profile | undefined;
const authStatus = () => ({
  profile: profile() ?? null,
  authenticated,
  retryAfter: Math.max(0, limiter.until - Date.now()),
  theme: repo.settings().theme ?? "system",
});
function lock() {
  authenticated = false;
  win?.webContents.send("dashboard:locked");
}
function snapshot() {
  return {
    data: repo.data(),
    settings: repo.settings(),
    profile: profile(),
    dbPath,
    touchID:
      process.platform === "darwin" && systemPreferences.canPromptTouchID(),
    timer,
  };
}
function timerCommand(
  command: "start" | "pause" | "stop",
  task_id = "",
  project_id = "",
) {
  if (timer.running_since) {
    timer.elapsed += Math.max(
      0,
      Math.floor((Date.now() - timer.running_since) / 1000),
    );
    timer.running_since = null;
  }
  if (command === "start") {
    if (!timer.started_at) {
      timer.started_at = new Date().toISOString();
      timer.task_id = task_id;
      timer.project_id = project_id;
    }
    timer.running_since = Date.now();
  }
  if (command === "stop") {
    if (timer.elapsed > 0)
      repo.save("time_entries", {
        ...timer,
        seconds: timer.elapsed,
        ended_at: new Date().toISOString(),
      });
    timer = {
      task_id: "",
      project_id: "",
      started_at: "",
      running_since: null,
      elapsed: 0,
    };
  }
  repo.setSettings({ timer: JSON.stringify(timer) });
  win?.webContents.send("dashboard:timer");
  return timer;
}
function log(error: unknown) {
  mkdirSync(join(userDir, "logs"), { recursive: true });
  appendFileSync(
    join(userDir, "logs", "dashboard.log"),
    `${new Date().toISOString()} ${error instanceof Error ? error.message : "Ошибка"}\n`,
  );
}
async function handle(raw: unknown): Promise<unknown> {
  const base = z.object({ action: z.string() }).passthrough().parse(raw);
  const r = base as Request;
  if (r.action === "authStatus") return authStatus();
  if (r.action === "register") {
    if (profile()) throw new Error("Профиль уже существует");
    const data = registration.parse(r.data);
    const { salt, hash } = hashPassword(data.password);
    repo.db
      .prepare("INSERT INTO users VALUES(?,?,?,?,?,?,?)")
      .run(
        randomUUID(),
        data.name,
        data.email,
        hash,
        salt,
        data.avatar_path,
        new Date().toISOString(),
      );
    authenticated = true;
    activity = Date.now();
    return snapshot();
  }
  if (r.action === "login") {
    limiter.check();
    const password = z.string().max(1024).parse(r.password);
    const u = repo.db.prepare("SELECT * FROM users LIMIT 1").get() as
      { salt: string; password_hash: string } | undefined;
    if (!u || !verifyPassword(password, u.salt, u.password_hash)) {
      limiter.fail();
      throw new Error("Неверный пароль");
    }
    limiter.reset();
    authenticated = true;
    activity = Date.now();
    return snapshot();
  }
  if (r.action === "reset") {
    if (r.confirmation !== "УДАЛИТЬ ВСЕ ДАННЫЕ")
      throw new Error("Подтверждение не совпадает");
    const answer = await dialog.showMessageBox(win, {
      type: "warning",
      message: "Удалить профиль и все данные?",
      detail: "Восстановить их без резервной копии будет невозможно.",
      buttons: ["Отмена", "Удалить навсегда"],
      defaultId: 0,
      cancelId: 0,
    });
    if (answer.response !== 1) return false;
    repo.close();
    for (const suffix of ["", "-wal", "-shm"])
      if (existsSync(dbPath + suffix)) unlinkSync(dbPath + suffix);
    repo = new Repository(dbPath, migrationDir);
    timer = {
      task_id: "",
      project_id: "",
      started_at: "",
      running_since: null,
      elapsed: 0,
    };
    limiter.reset();
    lock();
    return true;
  }
  if (r.action === "touchID") {
    if (
      repo.settings().touchID !== "true" ||
      !systemPreferences.canPromptTouchID()
    )
      throw new Error("Touch ID не включён");
    await systemPreferences.promptTouchID("разблокировать Dashboard");
    authenticated = true;
    activity = Date.now();
    return snapshot();
  }
  if (!authenticated) throw new Error("Сначала войдите в приложение");
  activity = Date.now();
  switch (r.action) {
    case "recordGoal":
      return repo.recordGoal(
        z.uuid().parse(r.goal_id),
        calendarDay.parse(r.day),
        z.number().finite().min(0).max(1e9).parse(r.value),
        z.enum(["set", "add"]).parse(r.mode),
      );
    case "completeTask":
      return repo.completeTask(
        z.uuid().parse(r.id),
        z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .parse(r.occurrence_date),
        z.boolean().parse(r.completed),
      );
    case "convertInbox":
      return repo.convertInbox(
        z.uuid().parse(r.id),
        z.enum(["notes", "tasks", "projects"]).parse(r.table),
      );
    case "snapshot":
      return snapshot();
    case "lock":
      lock();
      return true;
    case "save": {
      const table = z
        .enum(tables as [(typeof tables)[number], ...(typeof tables)[number][]])
        .parse(r.table);
      const fields = z.record(z.string(), z.unknown()).parse(r.data);
      return repo.db.transaction(() => {
        if (table === "transactions" && r.categoryName && !fields.category_id) {
          const name = z.string().trim().min(1).max(200).parse(r.categoryName),
            type = z.enum(["expense", "income"]).parse(fields.type);
          const existing = repo.db
            .prepare(
              "SELECT id FROM categories WHERE name=? AND type=? AND deleted_at=''",
            )
            .get(name, type) as { id: string } | undefined;
          fields.category_id =
            existing?.id ?? repo.save("categories", { name, type }).id;
        }
        return repo.save(table, fields);
      })();
    }
    case "remove":
    case "restoreRow":
      repo.remove(
        z
          .enum(
            tables as [(typeof tables)[number], ...(typeof tables)[number][]],
          )
          .parse(r.table),
        z.uuid().parse(r.id),
        r.action === "restoreRow",
      );
      return true;
    case "settings":
      repo.setSettings(settingsSchema.parse(r.data));
      return true;
    case "profile": {
      const p = registration.omit({ password: true }).parse(r.data);
      repo.db
        .prepare("UPDATE users SET name=?,email=?,avatar_path=?")
        .run(p.name, p.email, p.avatar_path);
      return true;
    }
    case "password": {
      z.string().min(8).max(1024).parse(r.password);
      const u = repo.db
        .prepare("SELECT salt,password_hash FROM users")
        .get() as { salt: string; password_hash: string };
      if (
        !verifyPassword(
          z.string().max(1024).parse(r.current),
          u.salt,
          u.password_hash,
        )
      )
        throw new Error("Текущий пароль неверен");
      const h = hashPassword(r.password);
      repo.db
        .prepare("UPDATE users SET salt=?,password_hash=?")
        .run(h.salt, h.hash);
      return true;
    }
    case "demo":
      seed(repo);
      return true;
    case "clearDemo":
      repo.clearDemo();
      return true;
    case "backup":
      return await backup(repo, join(userDir, "Backups"));
    case "exportJSON": {
      const result = await dialog.showSaveDialog(win, {
        defaultPath: "Dashboard.json",
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (result.filePath)
        writeFileSync(
          result.filePath,
          JSON.stringify(
            {
              version: 3,
              data: repo.data(),
              settings: settingsSchema.parse(
                Object.fromEntries(
                  Object.entries(repo.settings()).filter(
                    ([key]) => key in settingsSchema.shape,
                  ),
                ),
              ),
              profile: profile(),
            },
            null,
            2,
          ),
          { mode: 0o600 },
        );
      return !!result.filePath;
    }
    case "importJSON": {
      const result = await dialog.showOpenDialog(win, {
        properties: ["openFile"],
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (result.canceled) return false;
      await backup(repo, join(userDir, "SafetyBackups"));
      importData(repo, result.filePaths[0]);
      return true;
    }
    case "restoreBackup": {
      const result = await dialog.showOpenDialog(win, {
        defaultPath: join(userDir, "Backups"),
        properties: ["openFile"],
        filters: [{ name: "SQLite", extensions: ["db"] }],
      });
      if (result.canceled) return false;
      const staged = await prepareRestore(result.filePaths[0], migrationDir);
      try {
        const confirm = await dialog.showMessageBox(win, {
          type: "warning",
          message: "Заменить данные резервной копией?",
          detail:
            "Текущая база будет сохранена в SafetyBackups. После восстановления войдите с паролем из копии.",
          buttons: ["Отмена", "Восстановить"],
          cancelId: 0,
        });
        if (confirm.response !== 1) return false;
        const safety = await backup(repo, join(userDir, "SafetyBackups"));
        const replacement = dbPath + ".restore";
        copyFileSync(staged.path, replacement);
        chmodSync(replacement, 0o600);
        repo.close();
        try {
          for (const s of ["-wal", "-shm"])
            if (existsSync(dbPath + s)) unlinkSync(dbPath + s);
          renameSync(replacement, dbPath);
          repo = new Repository(dbPath, migrationDir);
        } catch (error) {
          if (safety) copyFileSync(safety, dbPath);
          repo = new Repository(dbPath, migrationDir);
          throw error;
        }
        timer = {
          task_id: "",
          project_id: "",
          started_at: "",
          running_since: null,
          elapsed: 0,
        };
        repo.setSettings({ timer: JSON.stringify(timer) });
        lock();
        return true;
      } finally {
        staged.cleanup();
      }
    }
    case "timer":
      return timerCommand(
        z.enum(["start", "pause", "stop"]).parse(r.command),
        r.task_id ?? "",
        r.project_id ?? "",
      );
    case "payInvoice": {
      const id = z.uuid().parse(r.id),
        accountId = z.uuid().parse(r.account_id);
      repo.db.transaction(() => {
        const data = repo.data(),
          inv = data.invoices.find((i) => i.id === id && !i.deleted_at),
          account = data.accounts.find(
            (a) => a.id === accountId && !a.deleted_at,
          );
        if (!inv || !account) throw new Error("Выберите счёт для зачисления");
        if (inv.status === "paid") throw new Error("Уже оплачено");
        if (inv.currency !== account.currency)
          throw new Error("Валюты счёта и платежа должны совпадать");
        const amount = invoiceTotal(data, id);
        if (amount <= 0) throw new Error("Добавьте позиции счёта");
        repo.save("transactions", {
          account_id: accountId,
          type: "income",
          amount,
          date: localDay(),
          note: `Оплата ${inv.number}`,
          project_id: inv.project_id,
          invoice_id: id,
        });
        repo.db
          .prepare(
            "UPDATE invoices SET status='paid',paid_at=?,updated_at=? WHERE id=?",
          )
          .run(new Date().toISOString(), new Date().toISOString(), id);
      })();
      return true;
    }
    case "export":
      return await exportFile(r);
    default:
      throw new Error("Неизвестное действие");
  }
}
const escapeHTML = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
async function exportFile(r: Extract<Request, { action: "export" }>) {
  const format = z.enum(["csv", "markdown", "pdf", "json"]).parse(r.format);
  const table = z
    .enum(tables as [(typeof tables)[number], ...(typeof tables)[number][]])
    .parse(r.table);
  const rows = (repo.data()[table] as Row[]).filter(
    (row) => !row.deleted_at && (!r.id || row.id === r.id),
  );
  if (!rows.length) throw new Error("Нет данных для экспорта");
  const result = await dialog.showSaveDialog(win, {
    defaultPath: `Dashboard.${format === "markdown" ? "md" : format}`,
  });
  if (!result.filePath) return false;
  if (format === "json") {
    writeFileSync(
      result.filePath,
      JSON.stringify({ version: 3, table, rows }, null, 2),
      { mode: 0o600 },
    );
  } else if (format === "csv") {
    const keys = Object.keys(rows[0]);
    const cell = (v: unknown) => {
      let s = String(v ?? "");
      if (/^[=+@-]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    };
    writeFileSync(
      result.filePath,
      "\uFEFF" +
        [
          keys.map(cell).join(";"),
          ...rows.map((row) =>
            keys
              .map((k) => cell((row as unknown as Record<string, unknown>)[k]))
              .join(";"),
          ),
        ].join("\n"),
    );
  } else if (format === "markdown") {
    const n = rows[0] as Row<"notes">;
    writeFileSync(
      result.filePath,
      `# ${n.title}\n\n${markdown(JSON.parse(n.content_json))}\n`,
    );
  } else {
    let content = "";
    if (table === "invoices") {
      const inv = rows[0] as Row<"invoices">;
      content = `<h1>Счёт ${escapeHTML(inv.number)}</h1><p>${escapeHTML(inv.company)} · ${escapeHTML(inv.client_name)}</p><p>Оплатить до ${escapeHTML(inv.due_date)}</p><table>${repo
        .data()
        .invoice_items.filter((i) => i.invoice_id === inv.id && !i.deleted_at)
        .map(
          (i) =>
            `<tr><td>${escapeHTML(i.title)}</td><td>${i.amount} ${inv.currency}</td></tr>`,
        )
        .join(
          "",
        )}</table><h2>Итого: ${invoiceTotal(repo.data(), inv.id)} ${inv.currency}</h2>`;
    } else {
      const n = rows[0] as Row<"notes">;
      content = `<h1>${escapeHTML(n.title)}</h1>${richHTML(JSON.parse(n.content_json))}`;
    }
    const temp = join(userDir, "print.html");
    writeFileSync(
      temp,
      `<html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none';style-src 'unsafe-inline'"><style>body{font:16px -apple-system;padding:40px;color:#16251c}td{padding:16px;border-bottom:1px solid #ddd}table{width:100%}pre{white-space:pre-wrap;font:inherit}</style></head><body>${content}</body></html>`,
    );
    const print = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: true,
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
    try {
      await print.loadFile(temp);
      writeFileSync(
        result.filePath,
        await print.webContents.printToPDF({
          pageSize: "A4",
          printBackground: true,
        }),
      );
    } finally {
      print.destroy();
      unlinkSync(temp);
    }
  }
  return true;
}
type RichNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  content?: RichNode[];
};
function richHTML(n: RichNode): string {
  let s = n.text
    ? escapeHTML(n.text)
    : (n.content ?? []).map(richHTML).join("");
  for (const mark of n.marks ?? []) {
    if (mark.type === "bold") s = `<strong>${s}</strong>`;
    if (mark.type === "italic") s = `<em>${s}</em>`;
    if (mark.type === "code") s = `<code>${s}</code>`;
    if (mark.type === "link" && /^https?:\/\//.test(String(mark.attrs?.href)))
      s = `<a href="${escapeHTML(String(mark.attrs?.href))}">${s}</a>`;
  }
  switch (n.type) {
    case "heading": {
      const level = Math.max(1, Math.min(6, Number(n.attrs?.level) || 2));
      return `<h${level}>${s}</h${level}>`;
    }
    case "paragraph":
      return `<p>${s}</p>`;
    case "bulletList":
      return `<ul>${s}</ul>`;
    case "orderedList":
      return `<ol>${s}</ol>`;
    case "listItem":
      return `<li>${s}</li>`;
    case "taskList":
      return `<ul style="list-style:none">${s}</ul>`;
    case "taskItem":
      return `<li>${n.attrs?.checked ? "☑" : "☐"} ${s}</li>`;
    case "blockquote":
      return `<blockquote>${s}</blockquote>`;
    case "codeBlock":
      return `<pre>${s}</pre>`;
    case "hardBreak":
      return "<br>";
    default:
      return s;
  }
}
function markdown(n: RichNode): string {
  let s = n.text ?? (n.content ?? []).map(markdown).join("");
  for (const mark of n.marks ?? []) {
    if (mark.type === "bold") s = `**${s}**`;
    if (mark.type === "italic") s = `*${s}*`;
    if (mark.type === "code") s = "`" + s + "`";
    if (mark.type === "link") s = `[${s}](${String(mark.attrs?.href ?? "")})`;
  }
  switch (n.type) {
    case "heading":
      return "#".repeat(Number(n.attrs?.level ?? 1)) + " " + s + "\n\n";
    case "paragraph":
      return s + "\n\n";
    case "listItem":
      return "- " + s.trim() + "\n";
    case "taskItem":
      return `- [${n.attrs?.checked ? "x" : " "}] ${s.trim()}\n`;
    case "blockquote":
      return "> " + s.trim().replace(/\n/g, "\n> ") + "\n\n";
    case "codeBlock":
      return "```\n" + s + "\n```\n\n";
    case "hardBreak":
      return "\n";
    default:
      return s;
  }
}
app.whenReady().then(async () => {
  if (process.platform === "win32")
    app.setAppUserModelId("local.dashboard.desktop");
  mkdirSync(userDir, { recursive: true, mode: 0o700 });
  repo = new Repository(dbPath, migrationDir);
  chmodSync(dbPath, 0o600);
  try {
    const saved = repo.settings().timer;
    if (saved) {
      timer = JSON.parse(saved) as TimerState;
      timer.running_since = null;
    }
  } catch {
    log(new Error("Не удалось восстановить таймер"));
  }
  await backup(repo, join(userDir, "Backups"), true);
  const splashAppearance = getSplashAppearance(repo.settings());
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url;
    const allow =
      url.startsWith("file:") ||
      url.startsWith("devtools:") ||
      (process.env.DASHBOARD_DEV === "1" &&
        (url.startsWith("http://127.0.0.1:5173/") ||
          url.startsWith("ws://127.0.0.1:5173/")));
    callback({ cancel: !allow });
  });
  session.defaultSession.setPermissionRequestHandler(
    (_wc, _permission, callback) => callback(false),
  );
  if (splashEnabled) {
    splash = createSplashWindow(splashAppearance);
    await loadSplashWindow(splash, splashAppearance);
    splash.show();
  }
  splashShownAt = Date.now();
  win = new BrowserWindow({
    width: 1440,
    height: 980,
    minWidth: 1100,
    minHeight: 700,
    title: "Dashboard",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    icon: join(app.getAppPath(), "build/icon.png"),
    show: false,
    backgroundColor: splashAppearance.dark ? "#0c0f14" : "#EEF1EF",
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event) => event.preventDefault());
  ipcMain.handle(
    "dashboard:call",
    async (event, request: unknown): Promise<Response> => {
      try {
        if (
          event.sender !== win.webContents ||
          event.senderFrame !== win.webContents.mainFrame
        )
          throw new Error("Недопустимый отправитель");
        return { ok: true, value: await handle(request) };
      } catch (error) {
        log(error);
        return {
          ok: false,
          error:
            error instanceof z.ZodError
              ? "Проверьте заполненные поля"
              : error instanceof Error
                ? error.message
                : "Не удалось выполнить действие",
        };
      }
    },
  );
  ipcMain.on("dashboard:activity", (event) => {
    if (event.sender === win.webContents && authenticated)
      activity = Date.now();
  });
  ipcMain.on("dashboard:renderer-ready", (event) => {
    if (
      event.sender === win.webContents &&
      event.senderFrame === win.webContents.mainFrame
    )
      void revealDashboard();
  });
  if (process.env.DASHBOARD_DEV === "1")
    await win.loadURL(
      `http://127.0.0.1:5173/?${new URLSearchParams({
        theme: splashAppearance.dark ? "dark" : "light",
        accent: splashAppearance.accent,
      }).toString()}`,
    );
  else
    await win.loadFile(join(app.getAppPath(), "dist/index.html"), {
      query: {
        theme: splashAppearance.dark ? "dark" : "light",
        accent: splashAppearance.accent,
      },
    });
  win.on("close", (event) => {
    if (!quitting) {
      event.preventDefault();
      win.hide();
    }
  });
  powerMonitor.on("suspend", () => {
    if (timer.running_since) timerCommand("pause");
    lock();
  });
  powerMonitor.on("lock-screen", lock);
  const icon =
    process.platform === "darwin"
      ? nativeImage.createFromDataURL(
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAIElEQVR42mNk+M/wn4ECwESJ5lEDRg0YNWDUgFEDBg0AAAjVAh/42YVeAAAAAElFTkSuQmCC",
        )
      : nativeImage
          .createFromPath(join(app.getAppPath(), "build/icon.png"))
          .resize({ width: 32, height: 32 });
  icon.setTemplateImage(process.platform === "darwin");
  tray = new Tray(icon);
  tray.setTitle("◷");
  tray.setToolTip("Dashboard");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Открыть Dashboard", click: () => win.show() },
      {
        label: "Старт / пауза таймера",
        click: () => {
          if (!authenticated) {
            win.show();
            return;
          }
          timerCommand(timer.running_since ? "pause" : "start");
        },
      },
      {
        label: "Остановить таймер",
        click: () => {
          if (authenticated) timerCommand("stop");
        },
      },
      { label: "Заблокировать", click: lock },
      { type: "separator" },
      { label: "Завершить", click: () => app.quit() },
    ]),
  );
  tray.on("click", () => win.show());
  setInterval(() => {
    const minutes = Number(repo.settings().autoLock ?? 5);
    if (authenticated && minutes > 0 && Date.now() - activity > minutes * 60000)
      lock();
    if (!authenticated) return;
    const now = new Date();
    for (const event of repo.rows("events").filter((e) => !e.deleted_at)) {
      const future = new Date(+now + 8 * 86400000);
      for (const date of occurrences(event, new Date(+now - 60000), future)) {
        const key = event.id + date.toISOString();
        const due = +date - event.remind_before_min * 60000;
        if (+now >= due && +now < +date && !notified.has(key)) {
          notified.add(key);
          new Notification({
            title: event.title,
            body: "Событие скоро начнётся",
          }).show();
        }
      }
    }
  }, 15000);
  updates = createUpdateService(
    () => win,
    async () => {
      if (timer.running_since) timerCommand("pause");
      await backup(repo, join(userDir, "Backups"), false);
      quitting = true;
    },
    log,
  );
  if (dashboardVisible) updates.start();
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "Dashboard",
        submenu: [
          { role: "about" },
          {
            label: "Проверить обновления…",
            click: () => void updates?.check(true),
          },
          { type: "separator" },
          {
            label: "Заблокировать",
            accelerator: "CmdOrCtrl+Shift+L",
            click: lock,
          },
          { role: "quit" },
        ],
      },
      {
        label: "Правка",
        submenu: [
          { role: "undo" },
          { role: "redo" },
          { type: "separator" },
          { role: "cut" },
          { role: "copy" },
          { role: "paste" },
          { role: "selectAll" },
        ],
      },
      { label: "Окно", submenu: [{ role: "minimize" }, { role: "zoom" }] },
    ]),
  );
});
app.on("activate", () => {
  if (dashboardVisible) win?.show();
  else splash?.show();
});
app.on("before-quit", () => {
  quitting = true;
  updates?.stop();
  if (repo) {
    if (timer.running_since) timerCommand("pause");
    repo.close();
  }
});
