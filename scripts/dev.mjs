import "./electron.mjs";
import { createServer } from "vite";
import { spawn } from "node:child_process";
import electron from "electron";
const server = await createServer();
await server.listen();
const app = spawn(electron, ["."], {
  stdio: "inherit",
  env: { ...process.env, DASHBOARD_DEV: "1" },
});
app.on("exit", async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
