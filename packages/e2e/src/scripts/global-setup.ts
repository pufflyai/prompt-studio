import { mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hideTestOnboarding } from "../helpers/onboarding";

// Fixture extensions use the checkout's installed dependencies. CI shares the
// cache populated by its frozen-lockfile install with child runtimes.
const runId = process.env.E2E_RUN_ID ?? `${Date.now()}-${process.pid}`;
const cacheDir = process.env.E2E_BUN_CACHE_DIR ?? join(tmpdir(), "pstdio-e2e-bun-cache", runId);

export default async function globalSetup() {
  mkdirSync(cacheDir, { recursive: true });
  process.env.BUN_INSTALL_CACHE_DIR = cacheDir;
  const descriptor = JSON.parse(readFileSync(join(process.env.E2E_HOME!, "runtime.json"), "utf8"));
  await hideTestOnboarding(descriptor.origin, { authorization: `Bearer ${descriptor.token}` });
}
