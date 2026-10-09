import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  updater: {
    on: vi.fn(),
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    quitAndInstall: vi.fn(),
    autoDownload: true,
    autoInstallOnAppQuit: true,
    allowPrerelease: true,
    allowDowngrade: true,
  },
  dialog: vi.fn(),
  open: vi.fn(),
  app: {
    isPackaged: true,
    getVersion: () => "1.3.0",
    getAppPath: () => process.cwd(),
  },
}));
vi.mock("electron", () => ({
  app: mocks.app,
  dialog: { showMessageBox: mocks.dialog },
  shell: { openExternal: mocks.open },
}));
vi.mock("electron-updater", () => ({
  autoUpdater: mocks.updater,
}));
import { createUpdateService } from "../src/main/updates";
import type { BrowserWindow } from "electron";

describe("release updates", () => {
  const prepare = vi.fn();
  const log = vi.fn();
  const window = () => ({}) as BrowserWindow;
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("DASHBOARD_TEST_DATA", "");
    mocks.app.isPackaged = true;
    vi.spyOn(process, "platform", "get").mockReturnValue("win32");
    mocks.updater.checkForUpdates.mockResolvedValue({
      isUpdateAvailable: true,
      updateInfo: { version: "1.4.0" },
    });
    mocks.updater.downloadUpdate.mockResolvedValue([]);
    prepare.mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });
  it("never downloads without consent", async () => {
    mocks.dialog.mockResolvedValue({ response: 1 });
    await createUpdateService(window, prepare, log).check();
    expect(mocks.updater.autoDownload).toBe(false);
    expect(mocks.updater.autoInstallOnAppQuit).toBe(false);
    expect(mocks.updater.downloadUpdate).not.toHaveBeenCalled();
  });
  it("backs up before installing a downloaded Windows update", async () => {
    const order: string[] = [];
    prepare.mockImplementation(async () => {
      order.push("backup");
    });
    mocks.updater.quitAndInstall.mockImplementation(() => {
      order.push("install");
    });
    mocks.dialog.mockResolvedValue({ response: 0 });
    await createUpdateService(window, prepare, log).check();
    expect(mocks.updater.downloadUpdate).toHaveBeenCalledOnce();
    expect(order).toEqual(["backup", "install"]);
  });
  it("does not install when restart is postponed", async () => {
    mocks.dialog
      .mockResolvedValueOnce({ response: 0 })
      .mockResolvedValueOnce({ response: 1 });
    await createUpdateService(window, prepare, log).check();
    expect(prepare).not.toHaveBeenCalled();
    expect(mocks.updater.quitAndInstall).not.toHaveBeenCalled();
  });
  it("keeps offline automatic checks silent", async () => {
    mocks.updater.checkForUpdates.mockRejectedValue(new Error("offline"));
    await createUpdateService(window, prepare, log).check();
    expect(log).toHaveBeenCalled();
    expect(mocks.dialog).not.toHaveBeenCalled();
  });
  it("reports a failed download after the user accepts an automatic update", async () => {
    mocks.dialog.mockResolvedValue({ response: 0 });
    mocks.updater.downloadUpdate.mockRejectedValueOnce(
      new Error("download failed"),
    );
    await createUpdateService(window, prepare, log).check();
    expect(mocks.dialog).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ type: "warning" }),
    );
    expect(mocks.updater.quitAndInstall).not.toHaveBeenCalled();
  });
  it("offers the official download for unsigned macOS", async () => {
    vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
    mocks.dialog.mockResolvedValue({ response: 0 });
    await createUpdateService(window, prepare, log).check();
    expect(mocks.open).toHaveBeenCalledWith(
      "https://github.com/Mikhail023/dashboard/releases/latest",
    );
    expect(mocks.updater.downloadUpdate).not.toHaveBeenCalled();
  });
  it("does not access the network during development or regression tests", async () => {
    vi.stubEnv("DASHBOARD_TEST_DATA", "/temporary/test-data");
    const service = createUpdateService(window, prepare, log);
    service.start();
    await service.check();
    expect(mocks.updater.checkForUpdates).not.toHaveBeenCalled();
    service.stop();
  });
  it("does not install if safety backup fails", async () => {
    prepare.mockRejectedValue(new Error("backup failed"));
    mocks.dialog.mockResolvedValue({ response: 0 });
    await createUpdateService(window, prepare, log).check();
    expect(mocks.updater.quitAndInstall).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalled();
  });
});
