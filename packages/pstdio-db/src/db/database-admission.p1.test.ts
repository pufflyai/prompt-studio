import { expect, test } from "bun:test";
import { withRuntimeOperationOrigin } from "pstdio-diagnostics";
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
