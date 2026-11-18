import { expect, test } from "bun:test";
import { channel } from "node:diagnostics_channel";
import { runtimeOperationChannel, withRuntimeOperationOrigin } from "pstdio-diagnostics";
import { openPglite } from "./open-pglite";

test("database evidence retains callers and execution sizes without SQL or parameters", async () => {
  const database = await openPglite(":memory:");
  await database.waitReady;
  const events: Record<string, unknown>[] = [];
  const sink = (value: unknown) => events.push(value as Record<string, unknown>);
  const diagnostics = channel(runtimeOperationChannel);
  diagnostics.subscribe(sink);
  try {
    await Promise.all(
      ["first-command", "second-command"].map((name) =>
        withRuntimeOperationOrigin({ kind: "command", name }, () =>
          database.query("SELECT $1::text as value", ["private-message-text"]),
        ),
      ),
    );
    const queries = events.filter((event) => event.kind === "database.query");
    expect(queries).toHaveLength(2);
    expect(queries.map((event) => (event.origin as { name: string }).name)).toEqual([
      "first-command",
      "second-command",
    ]);
    expect(queries[0]).toMatchObject({ statement: "SELECT", rows: 1, failed: false });
    expect(queries[0]?.caller).toBeString();
    expect(events.some((event) => event.kind === "database.execute" && event.parentId === queries[0]?.id)).toBe(true);
    expect(JSON.stringify(events)).not.toContain("private-message-text");
    expect(JSON.stringify(events)).not.toContain("SELECT $1");
    await expect(database.query("SELECT * FROM nonexistent_diagnostic_table")).rejects.toThrow();
    expect(events.some((event) => event.kind === "database.query" && event.failed === true)).toBe(true);
  } finally {
    diagnostics.unsubscribe(sink);
    await database.close();
  }
});

test("queries inside a transaction retain measurements and their initiating command", async () => {
  const database = await openPglite(":memory:");
  await database.waitReady;
  const events: Record<string, unknown>[] = [];
  const source = channel(runtimeOperationChannel);
  const observe = (value: unknown) => events.push(value as Record<string, unknown>);
  source.subscribe(observe);
  try {
    await withRuntimeOperationOrigin({ kind: "command", name: "transaction-command" }, () =>
      database.transaction(async (transaction) => {
        const result = await transaction.query("SELECT $1::int as value", [42]);
        expect(result.rows).toEqual([{ value: 42 }]);
        expect((await transaction.exec("SELECT 17 as value"))[0]?.rows).toEqual([{ value: 17 }]);
      }),
    );
    expect(
      events.some(
        (event) =>
          event.kind === "database.query" &&
          event.statement === "SELECT" &&
          event.rows === 1 &&
          (event.origin as { name?: string })?.name === "transaction-command",
      ),
    ).toBe(true);
  } finally {
    source.unsubscribe(observe);
    await database.close();
  }
});

test("tagged SQL entry points retain query attribution", async () => {
  const database = await openPglite(":memory:");
  await database.waitReady;
  const events: Record<string, unknown>[] = [];
  const source = channel(runtimeOperationChannel);
  const observe = (value: unknown) => events.push(value as Record<string, unknown>);
  source.subscribe(observe);
  try {
    await withRuntimeOperationOrigin({ kind: "command", name: "tagged-query-command" }, async () => {
      await database.sql`SELECT ${42}::int as value`;
      await database.transaction(async (transaction) => {
        await transaction.sql`SELECT ${43}::int as value`;
      });
    });
    expect(
      events.filter((event) => event.kind === "database.query" && event.statement === "SELECT" && event.rows === 1),
    ).toHaveLength(2);
  } finally {
    source.unsubscribe(observe);
    await database.close();
  }
});
