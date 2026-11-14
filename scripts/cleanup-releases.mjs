import { readdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import pkg from "../package.json" with { type: "json" };

const root = fileURLToPath(new URL("../", import.meta.url));
const release = join(root, "release");
const mac = join(release, "mac");
const windows = join(release, "windows");
const appName = process.arch === "arm64" ? "mac-arm64" : "mac-x64";
const currentApp = join(mac, appName);
const version = pkg.version;

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function removeExcept(directory, keep) {
  if (!(await exists(directory))) return;
  for (const name of await readdir(directory))
    if (!keep(name)) await rm(join(directory, name), { recursive: true, force: true });
}

// Keep only artifacts built for this app version and the app bundle used by the Desktop shortcut.
await removeExcept(release, (name) => name === "mac" || name === "windows");
await removeExcept(mac, (name) => {
  if (name === appName) return true;
  return new RegExp(`^Dashboard-${version.replaceAll(".", "\\.")}-[^.]+\\.(dmg|zip|blockmap)$`).test(name) || name === "latest-mac.yml";
});
await removeExcept(currentApp, (name) => name === "Dashboard.app");

// Preserve the newest Windows build until its matching Windows update is produced.
if (await exists(windows)) {
  const files = await readdir(windows);
  const installers = files
    .map((name) => ({ name, match: name.match(/^Dashboard-Setup-(\d+(?:\.\d+)+)-x64\.exe$/) }))
    .filter((item) => item.match)
    .sort((a, b) => b.match[1].localeCompare(a.match[1], undefined, { numeric: true }));
  const latest = installers[0]?.match[1];
  await removeExcept(windows, (name) =>
    name === "latest.yml" ||
    (latest && (name === `Dashboard-Setup-${latest}-x64.exe` || name === `Dashboard-Setup-${latest}-x64.exe.blockmap`)),
  );
}

console.log(`Удалены устаревшие сборки; macOS артефакты оставлены для версии ${version}.`);
