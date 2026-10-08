import { _electron as electron, expect } from "@playwright/test";
import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  readFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
const dir = mkdtempSync(join(tmpdir(), "dashboard-acceptance-"));
const evidence =
  process.env.DASHBOARD_EVIDENCE || join(process.cwd(), ".qa", "acceptance");
mkdirSync(evidence, { recursive: true });
let app, page;
const errors = [];
async function dashboardWindow(application) {
  for (let attempt = 0; attempt < 100; attempt++) {
    for (const candidate of application.windows()) {
      if (await candidate.evaluate(() => !!window.dashboard).catch(() => false))
        return candidate;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Dashboard renderer did not become ready");
}
const today = new Date().toLocaleDateString("sv-SE");
const call = (request) =>
  page.evaluate(async (request) => {
    const response = await window.dashboard.call(request);
    if (!response.ok) throw new Error(response.error);
    return response.value;
  }, request);
const snapshot = () => call({ action: "snapshot" });
const nav = async (name) => {
  await page
    .locator(".sidebar nav")
    .getByRole("button", { name: new RegExp(`^${name}`) })
    .click();
  await page.getByRole("heading", { name, exact: true }).first().waitFor();
};
const modal = () => page.getByRole("dialog");
const save = async () => {
  await modal().getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(modal()).toHaveCount(0);
};
const command = async (text) => {
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+k" : "Control+k",
  );
  await modal().getByRole("combobox", { name: "Поиск и команды" }).fill(text);
  await page.keyboard.press("Enter");
};
const login = async () => {
  await page
    .locator('input[type="password"]')
    .first()
    .fill("acceptance-password");
  await page.locator("form .button").last().click();
  await page.getByRole("heading", { name: "Дашборд", exact: true }).waitFor();
};
const start = async () => {
  app = await electron.launch({
    executablePath: process.env.DASHBOARD_EXECUTABLE || undefined,
    args: process.env.DASHBOARD_EXECUTABLE ? [] : ["."],
    env: { ...process.env, DASHBOARD_TEST_DATA: dir },
  });
  page = await dashboardWindow(app);
  page.setDefaultTimeout(15000);
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("Content Security Policy"))
      errors.push(m.text());
  });
  await page.waitForFunction(() => !!window.dashboard);
};
try {
  await start();
  await call({
    action: "register",
    data: {
      name: "Acceptance",
      email: "",
      avatar_path: "🌿",
      password: "acceptance-password",
    },
  });
  await call({ action: "settings", data: { autoLock: "0" } });
  const account = await call({
    action: "save",
    table: "accounts",
    data: { name: "Основной счёт", currency: "RUB" },
  });
  const project = await call({
    action: "save",
    table: "projects",
    data: { name: "Dashboard", status: "running" },
  });
  await page.reload();
  await login();

  // Habits: both goal kinds, their five visual states and editable history.
  const study = await call({
    action: "save",
    table: "daily_goals",
    data: {
      name: "Учёба",
      kind: "quantitative",
      target_value: 120,
      unit: "мин",
      icon: "study",
      color: "#7c3aed",
      start_date: "2026-01-01",
      project_id: project.id,
      aliases: "учился,учёба",
    },
  });
  const sport = await call({
    action: "save",
    table: "daily_goals",
    data: {
      name: "Тренировка",
      kind: "boolean",
      icon: "sport",
      start_date: "2026-01-01",
      aliases: "тренировка,спорт",
    },
  });
  const todayDate = new Date(today + "T12:00");
  for (const [offset, value] of [
    [-4, 1],
    [-3, 48],
    [-2, 60],
    [-1, 120],
    [0, 180],
  ]) {
    const day = new Date(todayDate);
    day.setDate(day.getDate() + offset);
    await call({
      action: "recordGoal",
      goal_id: study.id,
      day: day.toLocaleDateString("sv-SE"),
      value,
      mode: "set",
    });
  }
  await call({
    action: "recordGoal",
    goal_id: sport.id,
    day: today,
    value: 1,
    mode: "set",
  });
  // Fixtures above intentionally use IPC directly; reload the renderer snapshot.
  await page.reload();
  await login();
  await nav("Привычки");
  await expect(
    page.getByRole("heading", { name: "Привычки", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Новая привычка", exact: true })
    .click();
  await modal().getByLabel("Название", { exact: false }).fill("Вода");
  await modal().getByLabel("Тип привычки").selectOption("quantitative");
  await modal().getByLabel("Дневная норма").fill("2000");
  await modal().getByLabel("Единица (мин, страниц, мл, раз)").fill("мл");
  await save();
  await expect(page.getByText("Вода", { exact: true })).toBeVisible();
  await expect(
    page.locator(".habit-tile:not(.outside)[data-level='0']").first(),
  ).toBeVisible();
  await expect(
    page.locator(".habit-tile:not(.outside)[data-level='1']").first(),
  ).toBeVisible();
  await expect(
    page.locator(".habit-tile:not(.outside)[data-level='2']").first(),
  ).toBeVisible();
  await expect(
    page.locator(".habit-tile:not(.outside)[data-level='3']").first(),
  ).toBeVisible();
  await expect(
    page
      .locator(".habit-tile:not(.outside)[data-level='4'] .habit-over")
      .first(),
  ).toBeVisible();
  await page.getByRole("tab", { name: "3 месяца", exact: true }).click();
  await expect(page.locator(".habit-panel").first()).toBeVisible();
  await page.getByRole("tab", { name: "6 месяцев", exact: true }).click();
  await page.getByRole("tab", { name: "Год", exact: true }).click();
  await expect(page.locator(".habit-months").first()).toContainText("янв.");
  await page
    .locator(".habit-card")
    .filter({ hasText: "Учёба" })
    .locator(`.habit-tile[data-day='${today}']`)
    .click();
  await modal().getByRole("spinbutton").fill("90");
  await modal().getByRole("button", { name: "Сохранить прогресс" }).click();
  await expect
    .poll(
      async () =>
        (await snapshot()).data.daily_goal_entries.find(
          (e) => e.goal_id === study.id && e.day === today,
        ).value,
    )
    .toBe(90);
  await page
    .getByRole("button", { name: "Настроить Учёба", exact: true })
    .click();
  await expect(
    modal().getByLabel("Цвет #RRGGBB (пусто — акцент приложения)"),
  ).toHaveValue("#7c3aed");
  await modal().getByRole("button", { name: "Отмена", exact: true }).click();

  // The existing dashboard grid renders genuinely different S/M/L habit content.
  await command("Customize Dashboard");
  await modal().getByLabel("Показать Привычки", { exact: true }).check();
  await modal()
    .getByLabel("Размер Привычки", { exact: true })
    .selectOption("S");
  await modal().getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(page.locator(".widget-habits.size-S .habit-mini")).toBeVisible();
  await command("Customize Dashboard");
  await modal()
    .getByLabel("Размер Привычки", { exact: true })
    .selectOption("M");
  await modal().getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(
    page.locator(".widget-habits.size-M .habit-heatmap"),
  ).toBeVisible();
  await command("Customize Dashboard");
  await modal()
    .getByLabel("Размер Привычки", { exact: true })
    .selectOption("L");
  await modal().getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(
    page.locator(".widget-habits.size-L .habit-stats"),
  ).toBeVisible();

  // Smart Input records the matching local goal, and Timeline shows the fact.
  await page.getByRole("button", { name: "Быстрый ввод", exact: true }).click();
  await modal()
    .getByRole("textbox", { name: "Что хотите добавить?" })
    .fill("Учился 1 час 30 минут");
  await expect(modal()).toContainText("Учёба");
  await modal().getByRole("button", { name: "Сохранить прогресс" }).click();
  await expect
    .poll(
      async () =>
        (await snapshot()).data.daily_goal_entries.find(
          (e) => e.goal_id === study.id && e.day === today,
        ).value,
    )
    .toBe(180);
  await nav("История дня");
  await expect(page.getByText("Учёба", { exact: true })).toBeVisible();
  await page.getByText("Учёба", { exact: true }).click();
  await expect(modal()).toContainText("прогресс дня");
  await modal().getByRole("button", { name: "Отмена", exact: true }).click();

  // Smart Input -> parsed preview -> existing form -> actual persisted finance.
  await page.getByRole("button", { name: "Быстрый ввод", exact: true }).click();
  await modal()
    .getByRole("textbox", { name: "Что хотите добавить?" })
    .fill("Потратил 890 рублей на такси");
  await expect(modal()).toContainText("Транспорт");
  await modal()
    .getByRole("button", { name: "Проверить поля и сохранить" })
    .click();
  await save();
  let state = await snapshot();
  assert.equal(state.data.transactions[0].amount, 890);
  assert.equal(
    state.data.categories.find(
      (c) => c.id === state.data.transactions[0].category_id,
    ).name,
    "Транспорт",
  );

  // Notes -> tasks preserve relationships.
  await command("New Note");
  await modal()
    .getByRole("textbox", { name: "Название", exact: false })
    .fill("План Dashboard");
  await modal().getByLabel("Проект", { exact: true }).selectOption(project.id);
  await save();
  await nav("Заметки");
  await page
    .getByRole("button", { name: "Создать задачу", exact: true })
    .click();
  await save();
  state = await snapshot();
  const linked = state.data.tasks.find((t) => t.note_id);
  assert.equal(linked.project_id, project.id);
  assert.ok(linked.note_id);

  // Autosave must not overwrite metadata changed after the editor mounted.
  await call({
    action: "save",
    table: "notes",
    data: { id: linked.note_id, tags: "audit-tag" },
  });
  await page.getByLabel("Заголовок заметки").fill("План Dashboard обновлён");
  await expect
    .poll(
      async () =>
        (await snapshot()).data.notes.find((n) => n.id === linked.note_id)
          .title,
    )
    .toBe("План Dashboard обновлён");
  assert.equal(
    (await snapshot()).data.notes.find((n) => n.id === linked.note_id).tags,
    "audit-tag",
  );

  // Shared search filters and keyboard command execution.
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+k" : "Control+k",
  );
  await modal().getByLabel("Тип поиска").selectOption("tasks");
  await modal()
    .getByRole("combobox", { name: "Поиск и команды" })
    .fill("План Dashboard");
  await expect(modal().getByRole("listbox").getByRole("option")).toHaveCount(1);
  await modal().getByRole("combobox", { name: "Поиск и команды" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Задачи", exact: true }),
  ).toBeVisible();

  // Inbox conversion runs once and stores its destination.
  await nav("Входящие");
  await page
    .locator(".page-heading")
    .getByRole("button", { name: "Добавить", exact: true })
    .click();
  await modal()
    .getByRole("textbox", { name: "Название", exact: false })
    .fill("Идея из Inbox");
  await save();
  await page.getByRole("button", { name: "В заметку", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Заметки", exact: true }),
  ).toBeVisible();
  state = await snapshot();
  assert.equal(state.data.inbox[0].status, "processed");
  assert.ok(
    state.data.notes.some((n) => n.id === state.data.inbox[0].converted_id),
  );

  // A recurring task stores one series and independent completion facts.
  await command("New Task");
  await modal()
    .getByRole("textbox", { name: "Название", exact: false })
    .fill("Повтор каждые три дня");
  await modal()
    .getByLabel("Дедлайн")
    .fill(today + "T09:00");
  await modal().getByLabel("Повтор", { exact: true }).selectOption("daily");
  await modal().getByLabel("Интервал", { exact: false }).fill("3");
  await save();
  await nav("Задачи");
  const recurringRow = page
    .locator(".task-row")
    .filter({ hasText: "Повтор каждые три дня" })
    .first();
  await recurringRow
    .getByRole("button", { name: "Изменить выполнение" })
    .click();
  await expect(
    recurringRow.getByRole("button", { name: "Изменить выполнение" }),
  ).toHaveClass(/checked/);
  state = await snapshot();
  assert.equal(
    state.data.task_completions.filter((c) => !c.deleted_at).length,
    1,
  );
  assert.equal(
    state.data.tasks.filter((t) => t.title === "Повтор каждые три дня").length,
    1,
  );
  assert.equal(state.data.events.length, 0);

  // A completed occurrence can be dragged back without changing other repeats.
  await page.getByRole("button", { name: "Канбан", exact: true }).click();
  const doneColumn = page.locator(".kanban > section").nth(3);
  const todoColumn = page.locator(".kanban > section").nth(0);
  await doneColumn
    .locator(".task-row")
    .filter({ hasText: "Повтор каждые три дня" })
    .dragTo(todoColumn, { targetPosition: { x: 20, y: 20 } });
  await expect
    .poll(
      async () =>
        (await snapshot()).data.task_completions.filter((c) => !c.deleted_at)
          .length,
    )
    .toBe(0);
  await page.getByRole("button", { name: "Список", exact: true }).click();
  await page
    .locator(".task-row")
    .filter({ hasText: "Повтор каждые три дня" })
    .first()
    .getByRole("button", { name: "Изменить выполнение" })
    .click();
  await expect
    .poll(
      async () =>
        (await snapshot()).data.task_completions.filter((c) => !c.deleted_at)
          .length,
    )
    .toBe(1);

  // Date and status filters must match an occurrence, not the series start.
  const later = new Date(today + "T12:00");
  later.setDate(later.getDate() + 3);
  const laterDay = later.toLocaleDateString("sv-SE");
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+k" : "Control+k",
  );
  await modal().getByLabel("Тип поиска").selectOption("tasks");
  await modal().getByLabel("Дата поиска").fill(laterDay);
  await modal()
    .getByRole("combobox", { name: "Поиск и команды" })
    .fill("Повтор каждые три дня");
  await expect(
    modal().getByRole("option").filter({ hasText: "Повтор каждые три дня" }),
  ).toHaveCount(1);
  await modal().getByLabel("Статус поиска").selectOption("done");
  await expect(modal().getByRole("listbox").getByRole("option")).toHaveCount(0);
  await modal().getByLabel("Дата поиска").fill(today);
  await expect(modal().getByRole("listbox").getByRole("option")).toHaveCount(1);
  await modal().getByRole("combobox", { name: "Поиск и команды" }).focus();
  await page.keyboard.press("Enter");
  await expect(modal()).toContainText("Форма изменяет всю серию");
  await modal().getByRole("button", { name: "Отмена", exact: true }).click();

  // Ended recurrence still has overdue instances well beyond the old 30-day window.
  const oldStart = new Date(today + "T12:00");
  oldStart.setDate(oldStart.getDate() - 60);
  const oldEnd = new Date(today + "T12:00");
  oldEnd.setDate(oldEnd.getDate() - 45);
  const oldTask = await call({
    action: "save",
    table: "tasks",
    data: {
      title: "Старые повторы аудита",
      due_date: oldStart.toLocaleDateString("sv-SE"),
      recurrence_rule: "daily",
      recurrence_until: oldEnd.toLocaleDateString("sv-SE"),
    },
  });
  await nav("Дашборд");
  // Re-login refreshes the renderer after deliberately inserting the fixture through IPC.
  await page.reload();
  await login();
  await nav("Задачи");
  await page.getByLabel("Срок", { exact: true }).selectOption("overdue");
  await expect(
    page.locator(".task-row").filter({ hasText: "Старые повторы аудита" }),
  ).toHaveCount(16);
  await call({ action: "remove", table: "tasks", id: oldTask.id });
  await page.reload();
  await login();

  // Budgets and goal progress through real forms.
  await nav("Финансы");
  await page.getByRole("tab", { name: "Бюджеты", exact: true }).click();
  await page.getByRole("button", { name: "Добавить бюджет" }).click();
  await modal()
    .getByRole("textbox", { name: "Название", exact: false })
    .fill("Транспорт");
  const transport = state.data.categories.find((c) => c.name === "Транспорт");
  await modal()
    .getByLabel("Категория расходов", { exact: false })
    .selectOption(transport.id);
  await modal().getByLabel("Бюджет на месяц").fill("10000");
  await save();
  await expect(page.getByText(/Осталось:.*9.*110/)).toBeVisible();
  await page.getByRole("tab", { name: "Цели", exact: true }).click();
  await page.getByRole("button", { name: "Добавить цель" }).click();
  await modal()
    .getByRole("textbox", { name: "Название", exact: false })
    .fill("MacBook");
  await modal().getByLabel("Целевая сумма").fill("250000");
  await modal().getByLabel("Уже накоплено").fill("180000");
  await save();
  await expect(page.getByText("72%", { exact: true })).toBeVisible();

  // Grid size, visibility and actual HTML drag/drop.
  await command("Customize Dashboard");
  await modal().getByLabel("Размер Финансы", { exact: true }).selectOption("L");
  await modal().getByLabel("Показать Бюджет месяца", { exact: true }).check();
  await modal().getByLabel("Показать Финансовые цели", { exact: true }).check();
  await modal().getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(page.locator(".widget-finance")).toHaveClass(/size-L/);
  await page.getByRole("button", { name: "Переместить виджеты" }).click();
  const beforeDrag = (await snapshot()).settings.dashboard;
  await page.locator(".widget-budgets").dragTo(page.locator(".widget-goals"), {
    sourcePosition: { x: 15, y: 15 },
    targetPosition: { x: 15, y: 15 },
  });
  await expect
    .poll(async () => (await snapshot()).settings.dashboard)
    .not.toBe(beforeDrag);
  await page.getByRole("button", { name: "Готово", exact: true }).click();
  const savedLayout = (await snapshot()).settings.dashboard;

  // Theme / accent and width checks.
  await nav("Настройки");
  await page
    .getByLabel("Акцентный цвет", { exact: true })
    .selectOption("#2463ce");
  await page.getByLabel("Тема", { exact: true }).selectOption("dark");
  await nav("Дашборд");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.screenshot({ path: join(evidence, "dashboard-upgrade-dark.png") });
  await page.setViewportSize({ width: 1100, height: 700 });
  const lockButton = page
    .locator(".sidebar")
    .getByRole("button", { name: "Заблокировать", exact: true });
  await lockButton.scrollIntoViewIfNeeded();
  assert.ok((await lockButton.boundingBox()).y < 700);
  await page.locator(".sidebar").evaluate((element) => {
    element.scrollTop = 0;
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({ path: join(evidence, "dashboard-upgrade-1100.png") });
  await page.setViewportSize({ width: 1440, height: 980 });
  await nav("Настройки");
  await page.getByLabel("Тема", { exact: true }).selectOption("light");
  await nav("Дашборд");
  await page.screenshot({
    path: join(evidence, "dashboard-upgrade-light.png"),
  });

  // Timeline renders actual records and allows a previous day.
  await nav("История дня");
  await expect(page.getByText("Идея из Inbox", { exact: true })).toBeVisible();
  await page.getByLabel("День истории").fill("2020-01-01");
  await expect(page.getByText("В этот день нет записей.")).toBeVisible();
  await page.getByRole("button", { name: "Сегодня", exact: true }).click();
  await page.screenshot({
    path: join(evidence, "dashboard-upgrade-timeline.png"),
  });
  await nav("Дашборд");
  await page.getByRole("button", { name: "Начать день", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Фокус", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Завершить задачу", exact: true })
    .click();
  await expect(
    page.getByText("Главные задачи завершены. Можно выдохнуть."),
  ).toBeVisible();

  // Native exports: intercept only file chooser, keep real exporter code.
  for (const [table, format] of [
    ["tasks", "json"],
    ["projects", "json"],
    ["tasks", "csv"],
    ["transactions", "csv"],
    ["notes", "markdown"],
  ]) {
    const path = join(dir, `${table}.${format}`);
    await app.evaluate(({ dialog }, path) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: path });
    }, path);
    assert.equal(await call({ action: "export", table, format }), true);
    assert.ok(readFileSync(path, "utf8").length > 10);
  }
  const jsonPath = join(dir, "full.json");
  await app.evaluate(({ dialog }, path) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: path });
  }, jsonPath);
  await call({ action: "exportJSON" });
  assert.equal(JSON.parse(readFileSync(jsonPath, "utf8")).version, 3);
  const backup = await call({ action: "backup" });
  assert.ok(existsSync(backup));

  // Restart proves persistence of layout, accent, links and recurrence completion.
  await app.close();
  app = null;
  await start();
  await login();
  state = await snapshot();
  assert.equal(state.settings.dashboard, savedLayout);
  assert.equal(state.settings.accentColor, "#2463ce");
  assert.equal(state.settings.lastStartedDay, today);
  assert.equal(state.data.budgets[0].amount, 10000);
  assert.equal(state.data.financial_goals[0].current_amount, 180000);
  assert.equal(
    state.data.tasks.find((t) => t.id === linked.id).note_id,
    linked.note_id,
  );
  assert.equal(
    state.data.task_completions.filter((c) => !c.deleted_at).length,
    1,
  );
  assert.equal(
    state.data.accounts.find((a) => a.id === account.id).name,
    "Основной счёт",
  );

  // Restore must create a safety copy before replacing the test database.
  await call({
    action: "save",
    table: "notes",
    data: { title: "After backup" },
  });
  await app.evaluate(({ dialog }, path) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [path],
    });
    dialog.showMessageBox = async () => ({ response: 1 });
  }, backup);
  await call({ action: "restoreBackup" });
  await page.locator('input[type="password"]').first().waitFor();
  await login();
  state = await snapshot();
  assert.equal(
    state.data.notes.some((n) => n.title === "After backup"),
    false,
  );
  assert.ok(existsSync(join(dir, "SafetyBackups")));
  assert.deepEqual(errors, []);
  console.log(
    "Acceptance passed: Habits heatmap/Smart Input/Timeline/grid sizes, links, search, Inbox, recurrence, budgets/goals, themes, Focus, exports, restart and safety restore.",
  );
} catch (error) {
  console.error("Acceptance failure:", error);
  if (page && !page.isClosed()) {
    await page
      .screenshot({ path: join(evidence, "dashboard-upgrade-failure.png") })
      .catch(() => {});
    console.error(
      (
        await page
          .locator("body")
          .innerText()
          .catch(() => "Page closed")
      ).slice(-6500),
    );
  }
  throw error;
} finally {
  if (app) await app.close();
  rmSync(dir, { recursive: true, force: true });
}
