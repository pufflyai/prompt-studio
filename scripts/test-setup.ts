/// <reference types="node" />
import { afterEach, beforeEach } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

type ImportMetaWithEnv = ImportMeta & {
  env?: Record<string, string | undefined>;
};

const importMetaEnv = (import.meta as ImportMetaWithEnv).env;

// 1. At preload, strip any ambient PSTDIO_* vars inherited from the parent
//    shell (e.g. a worktree launched from an IDE that exports
//    PSTDIO_SESSION_ID). This prevents tests that read process.env directly
//    from accidentally observing developer-machine state.
for (const key of Object.keys(process.env)) {
  if (key.startsWith("PSTDIO_")) {
    delete process.env[key];
  }
}

// Keep API project creation tests hermetic. Individual tests can still pass an
// explicit env object or set this value inside the test when exercising default
// extension installation.
process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";

// Keep dashboard API tests hermetic when a local Vite env file points at a
// running isolated API. Individual tests can still set this explicitly.
if (importMetaEnv) {
  delete importMetaEnv.VITE_API_BASE_URL;
}

// Point PSTDIO_HOME at a fresh temp dir so the per-project extension auto-enable
// pass cannot pick up real extensions from the developer machine.
process.env.PSTDIO_HOME = mkdtempSync(join(tmpdir(), "pstdio-test-home-"));
process.env.PSTDIO_LOG_PATH = join(process.env.PSTDIO_HOME, "logs.jsonl");

// 2. Snapshot/restore process.env around every test so mutations made by one
//    test cannot leak into the next. The snapshot is taken inside beforeEach,
//    so vars set by beforeAll/describe-level setup are preserved.
let snapshot: Record<string, string | undefined> = {};
let importMetaEnvSnapshot: Record<string, string | undefined> = {};

beforeEach(() => {
  snapshot = { ...process.env };
  importMetaEnvSnapshot = { ...importMetaEnv };
});

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in snapshot)) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(snapshot)) {
    process.env[key] = value;
  }

  if (!importMetaEnv) {
    return;
  }

  for (const key of Object.keys(importMetaEnv)) {
    if (!(key in importMetaEnvSnapshot)) {
      delete importMetaEnv[key];
    }
  }
  for (const [key, value] of Object.entries(importMetaEnvSnapshot)) {
    importMetaEnv[key] = value;
  }
});
