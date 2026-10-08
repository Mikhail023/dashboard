import { readFileSync } from "node:fs";
const { version } = JSON.parse(readFileSync("package.json", "utf8"));
if (process.env.GITHUB_REF_NAME !== `v${version}`)
  throw new Error(`Release tag must be v${version}`);
