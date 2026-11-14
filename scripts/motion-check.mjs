import { _electron as electron, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
const dir = mkdtempSync(join(tmpdir(), "dashboard-motion-"));
const evidence = process.env.DASHBOARD_EVIDENCE || join(tmpdir(), "dashboard-motion-evidence");
mkdirSync(evidence, { recursive: true });
const errors = [];
let app, page;
let stage = "cold launch";
const deadline = setTimeout(() => {
  console.error(`Motion check timed out at ${stage}`);
  app?.process().kill();
  process.exitCode = 1;
}, 180000);
deadline.unref();
const key = process.platform === "darwin" ? "Meta+k" : "Control+k";
const call = (request) => page.evaluate(async request => {
  const response = await window.dashboard.call(request);
  if (!response.ok) throw Error(response.error);
  return response.value;
}, request);
async function start() {
  app = await electron.launch({
    executablePath: process.env.DASHBOARD_EXECUTABLE || undefined,
    args: process.env.DASHBOARD_EXECUTABLE ? [] : ["."],
    env: { ...process.env, DASHBOARD_TEST_DATA: dir },
  });
  for (let attempt = 0; attempt < 100; attempt++) {
    for (const candidate of app.windows()) {
      if (await candidate.evaluate(() => !!window.dashboard).catch(() => false)) page = candidate;
    }
    if (page) break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.ok(page, "Dashboard window exists");
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await expect(page.locator(".auth-card")).toBeVisible();
  await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1);
  await app.evaluate(({ BrowserWindow, app }) => { BrowserWindow.getAllWindows()[0].focus(); app.focus({ steal: true }); });
}
async function login() {
  await page.locator('input[type="password"]').first().fill("motion-test-password");
  await page.locator("form .button").last().click();
  await page.getByRole("heading", { name: "Дашборд", exact: true }).waitFor();
}
async function nav(name) {
  stage = `navigate ${name}`;
  await page.locator(".sidebar nav").getByRole("button", { name: new RegExp(`^${name}(?:\\s|$)`) }).click();
  await expect(page.locator(".route-surface[data-exiting]")).toHaveCount(0);
  await page.getByRole("heading", { name, exact: true }).first().waitFor();
  await expect(page.locator(".nav-active-indicator")).toHaveCount(1);
}
async function command(text) {
  await page.keyboard.press(key);
  const input = page.getByRole("combobox", { name: "Поиск и команды" });
  await input.fill(text);
  await expect(page.getByRole("listbox").getByRole("option").first()).toBeVisible();
  await page.keyboard.press("Enter");
}
try {
  await start();
  await call({ action: "register", data: { name: "Motion QA", email: "", avatar_path: "🚀", password: "motion-test-password" } });
  await call({ action: "demo" });
  await call({ action: "settings", data: { autoLock: "0" } });
  await call({ action: "save", table: "daily_goals", data: { name: "Motion Habit", kind: "quantitative", target_value: 120, unit: "мин", icon: "study", color: "#7c3aed", start_date: "2026-01-01" } });
  await page.reload();
  await login();
  stage = "rapid palette / focus";
  const trigger = page.getByRole("button", { name: /Поиск по всему приложению/ });
  for (let i = 0; i < 5; i++) {
    await trigger.click();
    await expect(page.getByRole("combobox", { name: "Поиск и команды" })).toBeFocused();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await page.keyboard.press(key);
    await expect(page.getByRole("combobox", { name: "Поиск и команды" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".modal-backdrop")).toHaveCount(0);
  }
  await expect(page.locator(".modal-backdrop")).toHaveCount(0);
  await command("New Task");
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator(".modal-backdrop")).toHaveCount(0);
  await trigger.click();
  await page.locator(".modal-backdrop").click({ position: { x: 5, y: 5 } });
  await expect(page.locator(".modal-backdrop")).toHaveCount(0);
  stage = "rapid route interruptions";
  const names = ["Задачи", "Финансы", "Проекты", "Календарь", "Привычки", "Настройки", "Дашборд"];
  for (const name of names) {
    await page.locator(".sidebar nav").getByRole("button", { name: new RegExp(`^${name}(?:\\s|$)`) }).click();
  }
  await expect(page.locator(".route-surface")).toHaveCount(1);
  await expect(page.locator(".route-surface")).toHaveCSS("opacity", "1");
  await nav("Привычки");
  stage = "year heatmap / tab keyboard / changed cell";
  const year = page.getByRole("tab", { name: "Год", exact: true });
  await year.focus();
  await page.keyboard.press("Home");
  await expect(page.getByRole("tab", { name: "3 месяца", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("End");
  await expect(year).toHaveAttribute("aria-selected", "true");
  const times = [];
  for (const period of ["3 месяца", "6 месяцев", "Год"]) {
    times.push(await page.evaluate(async label => {
      const button = [...document.querySelectorAll('[role="tab"]')].find(b => b.textContent === label);
      const start = performance.now(); button.click();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return Math.round(performance.now() - start);
    }, period));
  }
  assert.ok(Math.max(...times) < 500, `Heatmap switching took ${times}ms`);
  assert.ok(await page.locator(".habit-cells button").count() >= 365);
  assert.equal(await page.locator(".habit-cells").evaluate(el => el.getAnimations({ subtree: true }).length), 0);
  const today = new Date().toLocaleDateString("sv-SE");
  await page.locator(`.habit-cells [data-day="${today}"]`).click();
  await page.getByRole("dialog").getByRole("spinbutton").fill("120");
  await page.getByRole("button", { name: "Сохранить прогресс" }).click();
  await expect(page.locator(`.habit-cells [data-day="${today}"]`)).toHaveAttribute("data-level", "3");
  await expect(page.locator(".modal-backdrop")).toHaveCount(0);
  await page.screenshot({ path: join(evidence, "motion-habits.png") });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
  await nav("Дашборд");
  await command("Customize Dashboard");
  const dialog = page.getByRole("dialog");
  for (const size of ["S", "M", "L", "S"]) {
    await dialog.getByLabel("Размер Финансы", { exact: true }).selectOption(size);
  }
  await dialog.getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(page.locator(".modal-backdrop")).toHaveCount(0);
  await expect(page.locator(".widget-finance")).toHaveClass(/size-S/);
  await expect(page.locator(".widget-finance")).toHaveCSS("transform", "none");
  await page.getByRole("button", { name: "Переместить виджеты" }).click();
  const before = (await call({ action: "snapshot" })).settings.dashboard;
  await page.getByRole("button", { name: "Переместить выше Финансы" }).click();
  await expect.poll(async () => (await call({ action: "snapshot" })).settings.dashboard).not.toBe(before);
  await page.getByRole("button", { name: "Готово", exact: true }).click();
  const saved = (await call({ action: "snapshot" })).settings.dashboard;
  await page.keyboard.press(key);
  await expect(page.getByRole("dialog")).toHaveCSS("transform", "none");
  await page.keyboard.press("Escape");
  await expect(page.locator(".modal-backdrop")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(page.locator("html")).toHaveAttribute("data-motion", "full");
  await nav("Настройки");
  for (const theme of ["light", "dark"]) {
    await page.getByLabel("Тема", { exact: true }).selectOption(theme);
    const colors = await page.getByLabel("Акцентный цвет", { exact: true }).locator("option").evaluateAll(nodes => nodes.map(n => n.value).filter(v=>/^#[0-9a-f]{6}$/i.test(v)));
    assert.equal(colors.length, 6);
    for (const color of colors) {
      await page.getByLabel("Акцентный цвет", { exact: true }).selectOption(color);
      await expect.poll(()=>page.evaluate(()=>document.documentElement.style.getPropertyValue("--accent-base"))).toBe(color);
    }
  }
  for (const name of ["Дашборд", "Привычки", "Финансы", "Календарь", "Настройки"]) {
    await nav(name);
    for (const width of [1100, 1440, 1800]) {
      await page.setViewportSize({ width, height: 980 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
  }
  await page.screenshot({ path: join(evidence, "motion-settings.png") });
  stage = "reopen and restart";
  await app.evaluate(({ BrowserWindow, app }) => {
    const win = BrowserWindow.getAllWindows()[0];
    win.minimize(); win.restore(); win.hide(); app.emit("activate");
  });
  assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), 1);
  await app.close(); app = undefined; page = undefined;
  await start(); await login();
  assert.equal((await call({ action: "snapshot" })).settings.dashboard, saved);
  const databasePath = await app.evaluate(({ app }) => app.getPath("userData") + "/dashboard.db");
  const integrity = execFileSync("/usr/bin/sqlite3", [databasePath, "PRAGMA integrity_check;"]).toString().trim();
  const foreignKeys = execFileSync("/usr/bin/sqlite3", [databasePath, "PRAGMA foreign_key_check;"]).toString().trim();
  assert.equal(integrity, "ok");
  assert.equal(foreignKeys, "");
  assert.deepEqual(errors, []);
  console.log(`Motion PASS: rapid palette/routes, focus, keyboard tabs, live Reduce Motion, native DnD, S/M/L, responsive themes, year Heatmap (${times.join("/")} ms), reopen, restart, SQLite integrity. Evidence: ${evidence}`);
} catch (error) {
  console.error(`Motion failure at ${stage}:`, error);
  if (page && !page.isClosed()) await page.screenshot({ path: join(evidence, "motion-failure.png") }).catch(() => {});
  throw error;
} finally {
  clearTimeout(deadline);
  if (app) await app.close();
  rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
