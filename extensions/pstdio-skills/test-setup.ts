import { afterAll, afterEach, beforeEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Keep this extension's tests independent of the host checkout and developer state.
for (const key of Object.keys(process.env)) if (key.startsWith("PSTDIO_")) delete process.env[key];
const home = mkdtempSync(join(tmpdir(), "pstdio-extension-test-"));
process.env.PSTDIO_HOME = home;
process.env.PSTDIO_LOG_PATH = join(home, "logs.jsonl");
process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
afterAll(() => rmSync(home, { recursive: true, force: true }));

let environment: NodeJS.ProcessEnv;
beforeEach(() => {
  environment = { ...process.env };
});
afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in environment)) delete process.env[key];
  Object.assign(process.env, environment);
});
