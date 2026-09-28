import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "../..");
const CATALOG_PATH = path.join(ROOT, "packages/pstdio-api/files/extension-catalog.json");

// The host installs catalog extensions outside this workspace. Each ships its own lockfile so a
// runtime-only install resolves from it instead of downloading every development dependency.
// Repo-local extensions under .pstdio keep their lockfiles out of Git (see .pstdio/.gitignore).
export const catalogExtensionDirs = () => {
  const catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf8")) as { extensions: { origin: { path: string } }[] };
  return catalog.extensions.map((entry) => entry.origin.path).filter((dir) => dir.startsWith("extensions/"));
};

const syncExtensionLockfile = (dir: string) => {
  const temp = mkdtempSync(path.join(tmpdir(), "pstdio-extension-lockfile-"));
  try {
    copyFileSync(path.join(ROOT, dir, "package.json"), path.join(temp, "package.json"));
    // Starting from the existing lockfile keeps resolved versions until a dependency range changes.
    if (existsSync(path.join(ROOT, dir, "bun.lock"))) {
      copyFileSync(path.join(ROOT, dir, "bun.lock"), path.join(temp, "bun.lock"));
    }
    const result = Bun.spawnSync(["bun", "install", "--lockfile-only"], {
      cwd: temp,
      stdout: "inherit",
      stderr: "inherit",
    });
    if (result.exitCode !== 0) throw new Error(`Could not resolve the lockfile for ${dir}`);
    copyFileSync(path.join(temp, "bun.lock"), path.join(ROOT, dir, "bun.lock"));
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
};

if (import.meta.main) {
  for (const dir of catalogExtensionDirs()) {
    syncExtensionLockfile(dir);
    console.log(`Synced ${dir}/bun.lock`);
  }
}
