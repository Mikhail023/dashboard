import { app, BrowserWindow, dialog, shell } from "electron";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { autoUpdater } from "electron-updater";

const releasesURL = "https://github.com/Mikhail023/dashboard/releases/latest";
const checkIntervalMs = 6 * 60 * 60 * 1000;

/** Only the main process can fetch updates or start an installer. */
export function createUpdateService(
  window: () => BrowserWindow,
  prepareInstall: () => Promise<void>,
  log: (error: unknown) => void,
) {
  let checking = false;
  let promptOpen = false;
  let started = false;
  let interval: ReturnType<typeof setInterval> | undefined;
  const enabled = app.isPackaged && !process.env.DASHBOARD_TEST_DATA;
  const metadata = JSON.parse(
    readFileSync(join(app.getAppPath(), "package.json"), "utf8"),
  ) as { dashboardMacAutoUpdate?: boolean };
  const manualMacInstall =
    process.platform === "darwin" && !metadata.dashboardMacAutoUpdate;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;
  autoUpdater.on("error", log);

  async function check(manual = false) {
    if (checking || promptOpen) return;
    if (!enabled) {
      if (manual)
        await dialog.showMessageBox(window(), {
          type: "info",
          message: "Обновления доступны в установленной версии Dashboard.",
        });
      return;
    }
    checking = true;
    try {
      const result = await autoUpdater.checkForUpdates();
      if (!result?.isUpdateAvailable) {
        if (manual)
          await dialog.showMessageBox(window(), {
            type: "info",
            message: "Установлена последняя версия Dashboard.",
            detail: `Версия ${app.getVersion()}`,
          });
        return;
      }
      promptOpen = true;
      const answer = await dialog.showMessageBox(window(), {
        type: "info",
        message: `Доступен Dashboard ${result.updateInfo.version}`,
        detail: manualMacInstall
          ? "Откройте GitHub Releases, скачайте DMG и замените приложение в Applications. Ваши данные сохранятся."
          : "Скачать обновление? После загрузки вы сможете перезапустить приложение для установки. Ваши данные сохранятся.",
        buttons: [manualMacInstall ? "Открыть установщик" : "Скачать", "Позже"],
        defaultId: 0,
        cancelId: 1,
      });
      if (answer.response !== 0) return;
      if (manualMacInstall) {
        await shell.openExternal(releasesURL);
        return;
      }
      await autoUpdater.downloadUpdate();
      const install = await dialog.showMessageBox(window(), {
        type: "info",
        message: "Обновление готово к установке",
        detail:
          "Dashboard создаст резервную копию и перезапустится. Завершите редактирование перед продолжением.",
        buttons: ["Перезапустить и обновить", "Позже"],
        defaultId: 1,
        cancelId: 1,
      });
      if (install.response === 0) {
        await prepareInstall();
        autoUpdater.quitAndInstall(false, true);
      }
    } catch (error) {
      log(error);
      if (manual)
        await dialog.showMessageBox(window(), {
          type: "warning",
          message: "Не удалось проверить или установить обновление",
          detail:
            "Проверьте интернет-соединение и повторите попытку. Установщики также доступны в GitHub Releases.",
        });
    } finally {
      checking = false;
      promptOpen = false;
    }
  }
  return {
    check,
    start() {
      if (started || !enabled) return;
      started = true;
      void check();
      interval = setInterval(() => void check(), checkIntervalMs);
      interval.unref();
    },
    stop() {
      if (interval) clearInterval(interval);
    },
  };
}
