import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

// Every per-project plugin workspace runs `bun install` with `@pstdio/sdk@latest`
// on the request path the first time a ticket hook fires. On a cold CI runner
// the network fetch blows past the 30s test timeout. Pre-warming bun's default
// cache once per run makes those per-project installs offline cache hits
// (~1-2s) instead of network fetches, without needing any env propagation.
const defaultCacheDir = () => process.env.E2E_BUN_CACHE_DIR ?? join(homedir(), ".bun", "install", "cache");

const isPrimed = (cacheDir: string) => existsSync(join(cacheDir, "@pstdio"));

export const primeBunCache = () => {
  const cacheDir = defaultCacheDir();
  mkdirSync(cacheDir, { recursive: true });

  if (isPrimed(cacheDir)) return;

  const primeDir = mkdtempSync(join(tmpdir(), "pstdio-e2e-bun-prime-"));
  writeFileSync(
    join(primeDir, "package.json"),
    `${JSON.stringify({ private: true, type: "module", dependencies: { "@pstdio/sdk": "latest" } }, null, 2)}\n`,
  );

  execFileSync("bun", ["install", "--cache-dir", cacheDir], {
    cwd: primeDir,
    stdio: "inherit",
  });
};
