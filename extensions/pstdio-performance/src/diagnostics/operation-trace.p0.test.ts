import { expect, test } from "bun:test";
import { channel } from "node:diagnostics_channel";
import { collectOperationTrace } from "./operation-trace";

test("operation evidence is bounded and strips unknown payload fields", () => {
  const trace = collectOperationTrace();
  const source = channel("pstdio.diagnostics.operation");
  try {
    for (let index = 0; index < 1100; index++)
      source.publish({
        kind: "database.query",
        startedAt: new Date().toISOString(),
        durationMs: 1,
        rows: index,
        sql: "private SQL",
        params: ["private value"],
        caller: "frame".repeat(1000),
      });
    const snapshot = trace.snapshot();
    expect(snapshot.events.length).toBeLessThanOrEqual(1000);
    expect(snapshot.bytes).toBeLessThanOrEqual(512 * 1024);
    expect(snapshot.dropped).toBeGreaterThan(0);
    expect(snapshot.events.at(-1)?.rows).toBe(1099);
    expect(JSON.stringify(snapshot)).not.toContain("private");
    source.publish({ kind: "invalid", durationMs: NaN, startedAt: "invalid" });
    expect(trace.snapshot().events.length).toBe(snapshot.events.length);
  } finally {
    trace.close();
  }
});

test("closing the collector stops retaining operations", () => {
  const trace = collectOperationTrace();
  trace.close();
  channel("pstdio.diagnostics.operation").publish({
    kind: "chat.encode",
    startedAt: new Date().toISOString(),
    durationMs: 1,
  });
  expect(trace.snapshot().events).toHaveLength(0);
});

test("progress replaces an event with the latest cumulative measurements", () => {
  const trace = collectOperationTrace();
  const source = channel("pstdio.diagnostics.operation");
  try {
    source.publish({
      kind: "chat.encode",
      id: "event-id",
      startedAt: new Date().toISOString(),
      durationMs: 1,
      wireBytes: 30,
      fragments: 1,
      complete: false,
    });
    source.publish({
      kind: "chat.encode",
      id: "event-id",
      startedAt: new Date().toISOString(),
      durationMs: 2,
      wireBytes: 60,
      fragments: 2,
      complete: false,
    });
    const snapshot = trace.snapshot();
    expect(snapshot.events).toHaveLength(1);
    expect(snapshot.events[0]).toMatchObject({ durationMs: 2, fragments: 2, wireBytes: 60, complete: false });
    expect(snapshot.dropped).toBe(0);
  } finally {
    trace.close();
  }
});
