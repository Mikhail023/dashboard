import { _electron as electron } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
const dir = mkdtempSync(join(tmpdir(), "dashboard-smoke-"));
let app;
const deadline = setTimeout(() => {
  console.error("Electron smoke exceeded 90 seconds");
  app?.process().kill();
  process.exit(1);
}, 90000);
deadline.unref();
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
try {
  app = await electron.launch({
    executablePath: process.env.DASHBOARD_EXECUTABLE || undefined,
    args: process.env.DASHBOARD_EXECUTABLE ? [] : ["."],
    env: { ...process.env, DASHBOARD_TEST_DATA: dir },
  });
  const page = await dashboardWindow(app);
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.waitForFunction(() => !!window.dashboard);
  const result = await page.evaluate(async () => {
    const call = async (request) => {
      const response = await window.dashboard.call(request);
      if (!response.ok) throw new Error(response.error);
      return response.value;
    };
    await call({
      action: "register",
      data: {
        name: "Smoke",
        email: "",
        avatar_path: "🌿",
        password: "smoke-password",
      },
    });
    await call({ action: "demo" });
    return await call({ action: "snapshot" });
  });
  assert.equal(result.data.projects.length, 8);
  await page.reload();
  await page.locator('input[type="password"]').first().fill("smoke-password");
  await page.locator('form button[type="submit"], form .button').last().click();
  await page.getByRole("heading", { name: "Дашборд", exact: true }).waitFor();
  for (const name of [
    "Заметки",
    "Задачи",
    "Календарь",
    "Финансы",
    "Проекты",
    "Настройки",
    "Дашборд",
  ]) {
    await page
      .locator(".sidebar nav")
      .getByRole("button", { name: new RegExp(`^${name}`) })
      .click();
    await page.getByRole("heading", { name, exact: true }).first().waitFor();
  }
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+k" : "Control+k",
  );
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  assert.deepEqual(errors, []);
  console.log(
    "Electron smoke: launch, IPC, demo, existing pages, Command Palette OK",
  );
} finally {
  if (app) await app.close();
  rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  clearTimeout(deadline);
}
