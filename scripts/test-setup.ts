/// <reference types="node" />
import { afterEach, beforeEach } from "bun:test";

// 1. At preload, strip any ambient PSTDIO_* vars inherited from the parent
//    shell (e.g. a worktree launched from an IDE that exports
//    PSTDIO_SESSION_ID). This prevents tests that read process.env directly
//    from accidentally observing developer-machine state.
for (const key of Object.keys(process.env)) {
  if (key.startsWith("PSTDIO_")) {
    delete process.env[key];
  }
}

// 2. Snapshot/restore process.env around every test so mutations made by one
//    test cannot leak into the next. The snapshot is taken inside beforeEach,
//    so vars set by beforeAll/describe-level setup are preserved.
let snapshot: Record<string, string | undefined> = {};

beforeEach(() => {
  snapshot = { ...process.env };
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
});
