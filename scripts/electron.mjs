import { build } from "esbuild";
await build({
  entryPoints: ["src/main/index.ts"],
  outfile: "dist-electron/main.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron", "better-sqlite3", "electron-updater"],
});
await build({
  entryPoints: ["src/preload/index.ts"],
  outfile: "dist-electron/preload.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron"],
});
await build({
  entryPoints: ["src/preload/splash.ts"],
  outfile: "dist-electron/splash-preload.cjs",
  bundle: true,
  platform: "node",
  format: "cjs",
  external: ["electron"],
});

import { existsSync, readFileSync, writeFileSync } from "node:fs";
if (existsSync("dist/index.html"))
  writeFileSync(
    "dist/index.html",
    readFileSync("dist/index.html", "utf8").replace(
      "connect-src 'self' ws://127.0.0.1:5173",
      "connect-src 'none'",
    ),
  );
