import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Runtime workspaces can run `bun install` with `@pstdio/sdk@latest` on the
// request path. On a cold CI runner this network fetch blows past the 30s test
// timeout and cascades disposed-context errors into every following
// API-dependent test. We pre-warm a per-run bun install cache once here so
// those installs become offline cache hits without inheriting a stale partial
// extraction from an interrupted local run.
const runId = process.env.E2E_RUN_ID ?? `${Date.now()}-${process.pid}`;
const cacheDir = process.env.E2E_BUN_CACHE_DIR ?? join(tmpdir(), "pstdio-e2e-bun-cache", runId);

const primeBunCache = () => {
  const primeDir = mkdtempSync(join(tmpdir(), "pstdio-e2e-bun-prime-"));

  writeFileSync(
    join(primeDir, "package.json"),
    `${JSON.stringify({ private: true, type: "module", dependencies: { "@pstdio/sdk": "latest" } }, null, 2)}\n`,
  );

  execFileSync("bun", ["install"], {
    cwd: primeDir,
    stdio: "inherit",
    env: { ...process.env, BUN_INSTALL_CACHE_DIR: cacheDir },
  });
};

export default async function globalSetup() {
  mkdirSync(cacheDir, { recursive: true });
  primeBunCache();
  process.env.BUN_INSTALL_CACHE_DIR = cacheDir;
}
