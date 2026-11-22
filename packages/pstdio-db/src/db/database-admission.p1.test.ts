import { expect, test } from "bun:test";
import { currentRuntimeOperationOrigin, withRuntimeOperationOrigin } from "pstdio-diagnostics";
import { openPglite } from "./open-pglite";

test("an extension's write burst leaves core queries and the event loop responsive", async () => {
  const database = await openPglite(":memory:");
  try {
    await database.exec("CREATE TABLE attachments (id integer PRIMARY KEY, body text)");
    const order: string[] = [];
    let timerFired = false;
    let burstSettled = false;

    const burst = withRuntimeOperationOrigin({ kind: "command", name: "reports.save", extensionId: "ext.bulk" }, () =>
      Promise.all(
        Array.from({ length: 300 }, (_, id) =>
          database.query("INSERT INTO attachments VALUES ($1, $2)", [id, "x".repeat(2_000)]),
        ),
      ).then(() => {
        burstSettled = true;
        order.push("burst");
      }),
    );
    setTimeout(() => {
      timerFired = !burstSettled;
    }, 0);
    const core = database.query<{ count: number }>("SELECT count(*)::int AS count FROM attachments").then((result) => {
      order.push("core");
      return result.rows[0]!.count;
    });

    expect(await core).toBeLessThan(300);
    await burst;
    expect(order).toEqual(["core", "burst"]);
    expect(timerFired).toBe(true);
  } finally {
    await database.close();
  }
});

test("transactions still run as one admitted unit", async () => {
  const database = await openPglite(":memory:");
  try {
    await database.exec("CREATE TABLE counters (id integer PRIMARY KEY, value integer)");
    await withRuntimeOperationOrigin({ kind: "command", name: "counter", extensionId: "ext.counter" }, () =>
      Promise.all([
        database.transaction(async (tx) => {
          await tx.query("INSERT INTO counters VALUES (1, 1)");
          await tx.query("UPDATE counters SET value = value + 1 WHERE id = 1");
        }),
        database.query("INSERT INTO counters VALUES (2, 5)"),
      ]),
    );
    const rows = await database.query<{ id: number; value: number }>("SELECT id, value FROM counters ORDER BY id");
    expect(rows.rows).toEqual([
      { id: 1, value: 2 },
      { id: 2, value: 5 },
    ]);
  } finally {
    await database.close();
  }
});

test("closing during a burst finishes admitted work and refuses later work", async () => {
  const database = await openPglite(":memory:");
  await database.exec("CREATE TABLE writes (id integer PRIMARY KEY)");
  const burst = withRuntimeOperationOrigin({ kind: "command", name: "bulk", extensionId: "ext.bulk" }, () =>
    Promise.allSettled(Array.from({ length: 2_000 }, (_, id) => database.query("INSERT INTO writes VALUES ($1)", [id]))),
  );
  await new Promise((resolve) => setImmediate(resolve));
  await database.close();
  const results = await burst;
  expect(results.every((result) => result.status === "fulfilled")).toBe(true);
  await expect(database.query("SELECT 1")).rejects.toThrow("PGlite is closed");
});

test("queued work keeps the origin of the caller that queued it", async () => {
  const database = await openPglite(":memory:");
  try {
    const origins: (string | undefined)[] = [];
    const extension = withRuntimeOperationOrigin({ kind: "command", name: "bulk", extensionId: "ext.a" }, () =>
      Promise.all(Array.from({ length: 20 }, () => database.query("SELECT 1"))),
    );
    const core = database.transaction(async (tx) => {
      origins.push(currentRuntimeOperationOrigin()?.extensionId);
      await tx.query("SELECT 1");
    });
    await Promise.all([extension, core]);
    expect(origins).toEqual([undefined]);
  } finally {
    await database.close();
  }
});
