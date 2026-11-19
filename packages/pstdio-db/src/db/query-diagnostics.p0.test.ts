import { expect, test } from "bun:test";
import { channel } from "node:diagnostics_channel";
import { identifier, raw, sql } from "@electric-sql/pglite/template";
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

test("tagged SQL hashes expanded query shapes without retaining parameter values", async () => {
  const database = await openPglite(":memory:");
  await database.waitReady;
  const events: Record<string, unknown>[] = [];
  const source = channel(runtimeOperationChannel);
  const observe = (value: unknown) => events.push(value as Record<string, unknown>);
  source.subscribe(observe);
  try {
    await database.transaction(async (transaction) => {
      await transaction.sql`SELECT ${sql`${"private-one"}::text`} AS value`;
      await transaction.sql`SELECT ${sql`${"private-two"}::text`} AS value`;
      await transaction.sql`SELECT ${sql`${"private-one"}::text || ${"-tail"}::text`} AS value`;
      await transaction.sql`SELECT ${11}::int AS ${identifier`first_value`}`;
      await transaction.sql`SELECT ${12}::int AS ${identifier`second_value`}`;
      expect((await transaction.sql`SELECT ${raw`1`}::int AS value`).rows).toEqual([{ value: 1 }]);
      expect((await transaction.sql`SELECT ${raw`2`}::int AS value`).rows).toEqual([{ value: 2 }]);
    });
    await database.query('SELECT $1::int AS "first_value"', [99]);
    const hashes = events
      .filter((event) => event.kind === "database.query" && event.statement === "SELECT" && event.rows === 1)
      .map((event) => event.queryHash);
    expect(hashes).toHaveLength(8);
    expect(hashes[0]).toBe(hashes[1]);
    expect(hashes[0]).not.toBe(hashes[2]);
    expect(hashes[3]).not.toBe(hashes[4]);
    expect(hashes[5]).not.toBe(hashes[6]);
    expect(hashes[3]).toBe(hashes[7]);
    expect(JSON.stringify(events)).not.toContain("private-one");
    expect(JSON.stringify(events)).not.toContain("private-two");
    expect(JSON.stringify(events)).not.toContain("SELECT $1");
  } finally {
    source.unsubscribe(observe);
    await database.close();
  }
});

test("recording preserves rejected promises when tagged SQL expansion fails", async () => {
  const database = await openPglite(":memory:");
  const events: Record<string, unknown>[] = [];
  const source = channel(runtimeOperationChannel);
  const observe = (value: unknown) => events.push(value as Record<string, unknown>);
  const failure = new Error("Template classification failed");
  const parameter = {
    get _templateType() {
      throw failure;
    },
  };
  try {
    await database.transaction(async (transaction) => {
      const quiet = transaction.sql`SELECT ${parameter}::text`;
      expect(quiet).toBeInstanceOf(Promise);
      await expect(quiet).rejects.toBe(failure);
      source.subscribe(observe);
      let recorded: ReturnType<typeof transaction.sql> | undefined;
      expect(() => {
        recorded = transaction.sql`SELECT ${parameter}::text`;
      }).not.toThrow();
      expect(recorded).toBeInstanceOf(Promise);
      await expect(recorded!).rejects.toBe(failure);
    });
    expect(events.some((event) => event.kind === "database.query" && event.failed === true)).toBe(true);
  } finally {
    source.unsubscribe(observe);
    await database.close();
  }
});

test("recording expands tagged SQL parameters only once", async () => {
  const database = await openPglite(":memory:");
  const source = channel(runtimeOperationChannel);
  const events: Record<string, unknown>[] = [];
  const observe = (value: unknown) => events.push(value as Record<string, unknown>);
  let reads = 0;
  const parameter = {
    payload: "private-json-value",
    get _templateType() {
      reads++;
      return undefined;
    },
  };
  try {
    await database.transaction(async (transaction) => {
      const quiet = await transaction.sql`SELECT ${parameter}::jsonb AS value`;
      const quietReads = reads;
      reads = 0;
      source.subscribe(observe);
      const recorded = await transaction.sql`SELECT ${parameter}::jsonb AS value`;
      expect(recorded.rows).toEqual(quiet.rows);
      expect(reads).toBe(quietReads);
    });
    expect(JSON.stringify(events)).not.toContain("private-json-value");
  } finally {
    source.unsubscribe(observe);
    await database.close();
  }
});

test("invalid SQL tokens never become diagnostic statement kinds", async () => {
  const database = await openPglite(":memory:");
  const events: Record<string, unknown>[] = [];
  const source = channel(runtimeOperationChannel);
  const observe = (value: unknown) => events.push(value as Record<string, unknown>);
  source.subscribe(observe);
  try {
    await expect(database.query("private_word SELECT 1")).rejects.toThrow();
    await expect(
      database.transaction((transaction) => transaction.sql`${raw`private_word`} SELECT 1`),
    ).rejects.toThrow();
    const failed = events.filter((event) => event.kind === "database.query" && event.failed === true);
    expect(failed.map((event) => event.statement)).toEqual(["UNKNOWN", "UNKNOWN"]);
    expect(JSON.stringify(events)).not.toContain("PRIVATE_WORD");
    expect(JSON.stringify(events)).not.toContain("private_word");
  } finally {
    source.unsubscribe(observe);
    await database.close();
  }
});
