import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { acquireDbLock } from "./db-lock";

const tempDbPath = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), "pstdio-db-lock-")), "pstdio.db");

describe("acquireDbLock", () => {
  it("does not serialize in-memory databases", async () => {
    const first = await acquireDbLock(":memory:");
    // A real lock here would make the second call block on the first; in-memory dbs are independent.
    const second = await acquireDbLock(":memory:");

    await first();
    await second();
  });

  it("blocks a second acquirer until the first releases", async () => {
    const dbPath = tempDbPath();

    const release = await acquireDbLock(dbPath);

    // A live owner holds the lock, so a second attempt times out rather than racing in.
    await expect(acquireDbLock(dbPath, { retryMs: 10, timeoutMs: 80 })).rejects.toThrow(
      /Timed out acquiring database lock/,
    );

    await release();

    // Once released, the lock is free to take.
    const second = await acquireDbLock(dbPath, { retryMs: 10, timeoutMs: 80 });
    await second();

    fs.rmSync(path.dirname(dbPath), { force: true, recursive: true });
  });

  it("reclaims a lock abandoned by a dead process", async () => {
    const dbPath = tempDbPath();
    const lockDir = `${dbPath}.lock`;

    // Simulate a SIGKILL'd server: lock dir left behind, owner pid no longer alive.
    fs.mkdirSync(lockDir);
    fs.writeFileSync(path.join(lockDir, "owner"), String(2 ** 31 - 1));

    const release = await acquireDbLock(dbPath, { retryMs: 10, timeoutMs: 200 });

    expect(fs.readFileSync(path.join(lockDir, "owner"), "utf8")).toBe(String(process.pid));

    await release();
    fs.rmSync(path.dirname(dbPath), { force: true, recursive: true });
  });
});
