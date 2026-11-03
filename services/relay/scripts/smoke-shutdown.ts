import { strict as assert } from "node:assert";
import { Client } from "pg";
import type { createAccountManager } from "pstdio-account-manager";
import { type Scope, syncPath, syncProtocolHeader, syncProtocolVersion } from "pstdio-sync-contracts";
import { renewFixtureAccess } from "./manager.fixture";

export const checkBuiltShutdown = async (manager: ReturnType<typeof createAccountManager>, scope: Scope) => {
  const reader = await manager.registerDevice({
    accountId: scope.accountId,
    deviceId: "built-shutdown-reader",
    name: "Built shutdown reader",
    platform: "linux",
  });
  const access = await renewFixtureAccess(reader.token, scope.workbenchId);
  const keys = [
    "PATH",
    "HOME",
    "RELAY_ACCESS_TRUST_FILE",
    "DATABASE_URL",
    "S3_ENDPOINT",
    "S3_BUCKET",
    "S3_REGION",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
  ];
  const child = Bun.spawn([process.execPath, "/app/server.js"], {
    env: {
      ...Object.fromEntries(keys.map((key) => [key, process.env[key]])),
      RELAY_HOST: "127.0.0.1",
      RELAY_PORT: "0",
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  const output = child.stdout.getReader();
  const errors = new Response(child.stderr).text();
  const database = new Client({ connectionString: process.env.DATABASE_URL! });
  const observer = new Client({ connectionString: process.env.DATABASE_URL! });
  const controller = new AbortController();
  let guard: ReturnType<typeof setTimeout> | undefined;
  let unlockedByGuard = false;
  let reading: Promise<unknown> | undefined;
  await Promise.all([database.connect(), observer.connect()]);
  try {
    const first = new TextDecoder().decode((await output.read()).value);
    const origin = /Relay listening at (http:\/\/[^\s]+)/.exec(first)?.[1];
    assert(origin);
    console.log("Built shutdown: actual server ready");
    await database.query("BEGIN");
    await database.query("LOCK relay_sync_documents IN ACCESS EXCLUSIVE MODE");
    reading = Promise.all(
      Array.from({ length: 12 }, () =>
        fetch(
          new URL(
            syncPath({
              kind: "document",
              projectId: scope.workbenchId,
              spaceOwner: null,
              documentId: "a".repeat(64),
              operation: "read",
            }),
            origin,
          ),
          {
            method: "POST",
            headers: {
              authorization: `Bearer ${access.token}`,
              [syncProtocolHeader]: String(syncProtocolVersion),
              "content-type": "application/json",
            },
            body: JSON.stringify({ after: 0 }),
            signal: controller.signal,
          },
        ).catch((error: unknown) => error),
      ),
    );
    while (true) {
      const result = await observer.query(
        "SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'",
      );
      if (result.rows[0].count >= 10) break;
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    console.log("Built shutdown: 12 requests admitted and 10 backends blocked");
    // Unblock only a broken smoke so it can fail and clean its owned resources.
    const shutdownStarted = performance.now();
    guard = setTimeout(() => {
      unlockedByGuard = true;
      void database.query("ROLLBACK");
    }, 1000);
    child.kill("SIGTERM");
    assert.equal(await child.exited, 0);
    console.log("Built shutdown: actual server exited before unlock");
    assert.equal(await errors, "");
    let waiting = await observer.query(
      "SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'",
    );
    // PostgreSQL processes cancellation asynchronously after the clients close.
    // Keep the original guard armed until every blocked backend has actually left.
    while (waiting.rows[0].count !== 0 && !unlockedByGuard) {
      await new Promise<void>((resolve) => setImmediate(resolve));
      waiting = await observer.query(
        "SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'",
      );
    }
    assert.equal(unlockedByGuard, false);
    assert.equal(waiting.rows[0].count, 0);
    console.log(
      `Built shutdown: all blocked backends drained in ${(performance.now() - shutdownStarted).toFixed(1)}ms`,
    );
    console.log("Built actual server drained 12 readers and cancelled 10 owned backends before external unlock");
  } finally {
    clearTimeout(guard);
    await database.query("ROLLBACK");
    controller.abort();
    child.kill();
    await child.exited;
    await reading;
    output.releaseLock();
    await Promise.all([database.end(), observer.end()]);
  }
};
