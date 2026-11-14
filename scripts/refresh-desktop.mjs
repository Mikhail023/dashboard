import { execFileSync } from "node:child_process";
import { lstat, mkdir, rename, rm, symlink } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const project = new URL("../", import.meta.url).pathname;
const arch = process.arch === "arm64" ? "arm64" : "x64";
const appPath = join(project, "release", "mac", `mac-${arch}`, "Dashboard.app");
const desktop = join(homedir(), "Desktop");
const shortcut = join(desktop, "Dashboard.app");
const temporary = join(desktop, `.Dashboard.app-${process.pid}.tmp`);

try {
  await lstat(join(appPath, "Contents", "Info.plist"));
} catch {
  throw new Error(`Сборка Dashboard не найдена: ${appPath}`);
}

await mkdir(desktop, { recursive: true });
try {
  const current = await lstat(shortcut);
  if (current.isSymbolicLink()) {
    await rm(shortcut);
  } else if (current.isDirectory() && shortcut.endsWith(".app")) {
    const id = execFileSync(
      "/usr/bin/plutil",
      ["-extract", "CFBundleIdentifier", "raw", join(shortcut, "Contents", "Info.plist")],
      { encoding: "utf8" },
    ).trim();
    if (id !== "local.dashboard.desktop")
      throw new Error(`На рабочем столе лежит другое приложение: ${shortcut}`);
    await rm(shortcut, { recursive: true, force: true });
  } else {
    throw new Error(`Не заменяю посторонний файл: ${shortcut}`);
  }
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

await symlink(appPath, temporary, "dir");
await rename(temporary, shortcut);
console.log(`Ярлык обновлён: ${shortcut} → ${appPath}`);
