import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";

const root = process.argv[2];
if (!root)
  throw new Error("Usage: merge-update-manifests.mjs <artifacts directory>");
const manifests = readdirSync(root, { withFileTypes: true })
  .filter(
    (entry) => entry.isDirectory() && entry.name.startsWith("dashboard-mac-"),
  )
  .map((entry) =>
    yaml.load(readFileSync(join(root, entry.name, "latest-mac.yml"), "utf8")),
  );
if (manifests.length !== 2)
  throw new Error("Both macOS architectures must be present");
if (manifests.some((manifest) => manifest.version !== manifests[0].version))
  throw new Error("macOS manifest versions do not match");
const merged = {
  ...manifests[0],
  files: manifests.flatMap((manifest) => manifest.files),
};
writeFileSync(join(root, "latest-mac.yml"), yaml.dump(merged));
