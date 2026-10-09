import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // SQLite backup and antivirus scanning on Windows CI can exceed 5 seconds.
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
