import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const tag = process.env.GITHUB_REF_NAME;
if (!/^v\d+\.\d+\.\d+$/.test(tag ?? ""))
  throw new Error("A stable version tag is required");
const gh = (...args) =>
  execFileSync("gh", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
const existing = spawnSync(
  "gh",
  ["release", "view", tag, "--json", "isDraft"],
  { encoding: "utf8" },
);
if (existing.status === 0) {
  if (!JSON.parse(existing.stdout).isDraft)
    throw new Error(
      `Release ${tag} is already published. Publish a new version instead of overwriting installers.`,
    );
} else {
  gh(
    "release",
    "create",
    tag,
    "--draft",
    "--verify-tag",
    "--title",
    `Dashboard ${tag}`,
    "--notes-file",
    "docs/release-notes.md",
  );
}
function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}
const assets = files("release-artifacts").filter(
  (path) => !path.endsWith("latest-mac.yml"),
);
const names = assets.map((path) => path.split(/[\\/]/).pop());
if (new Set(names).size !== names.length)
  throw new Error("Duplicate release asset names");
gh("release", "upload", tag, "--clobber", ...assets);
gh("release", "upload", tag, "release-artifacts/latest-mac.yml", "--clobber");
gh("release", "edit", tag, "--draft=false", "--latest");
