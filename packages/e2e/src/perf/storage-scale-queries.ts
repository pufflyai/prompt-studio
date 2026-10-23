import { strict as assert } from "node:assert";
import { assess, createRow, owners, pageRows, type Selection, type Workload, workload } from "storage-scale-fixture";
import type { ScaleFixture, ScaleRuntime } from "./storage-scale-runtime";

export const queryOracles = (kind: Workload) =>
  owners(workload(kind)).map((owner) => ({
    owner,
    focus: pageRows(workload(kind), owner.index, "focus", 0).map((row) => row.id),
    second: pageRows(workload(kind), owner.index, "pages", 1).map((row) => row.id),
  }));
export type QueryOracles = ReturnType<typeof queryOracles>;

const page = async (
  runtime: ScaleRuntime,
  fixture: ScaleFixture,
  oracle: QueryOracles[number],
  selection: Selection,
  pageIndex: number,
) => {
  const { value, sdkRequestMs } = await runtime.execute<{
    rows: { id: string; owner: number }[];
    scanned: number | null;
    materialized: number;
    total: number;
  }>(fixture.projectId, oracle.owner.id, "scale", {
    input: { action: "page", selection, page: pageIndex, count: oracle.owner.rows, planner: oracle.owner.index === 9 },
  });
  const expected = pageIndex === 1 ? oracle.second : oracle.focus;
  assert.deepEqual(
    value.rows.map((row) => row.id),
    expected,
  );
  assert(value.rows.every((row) => row.owner === oracle.owner.index));
  assert.equal(value.total, oracle.owner.rows);
  return {
    owner: oracle.owner.id,
    durationMs: sdkRequestMs,
    ...value,
    correct: true,
    ...assess({
      durationMs: sdkRequestMs,
      correct: true,
      scanned: value.scanned,
      materialized: value.materialized,
      returned: value.rows.length,
      fullOwnerLoads: null,
      durable: true,
    }),
    paging: "legacy-full-list-slice; no indexed cursor API",
    valueBytes: Buffer.byteLength(JSON.stringify(value)),
  };
};

export const sampleQuery = async (
  runtime: ScaleRuntime,
  fixture: ScaleFixture,
  operation: string,
  oracles: QueryOracles,
) => {
  if (operation === "all-owner-burst") {
    const started = performance.now();
    const replies = await Promise.all(oracles.map((oracle) => page(runtime, fixture, oracle, "focus", 0)));
    return { durationMs: performance.now() - started, replies, passed: replies.every((reply) => reply.passed) };
  }
  if (operation === "second-page") return page(runtime, fixture, oracles[0], "pages", 1);
  if (operation === "aggregate") {
    const reply = await page(runtime, fixture, oracles[0], "focus", 0);
    return { ...reply, aggregateKind: "legacy scan; indexed aggregates are unavailable" };
  }
  const row = createRow(fixture.kind, 0, 37, 3);
  const result = await runtime.execute(fixture.projectId, oracles[0].owner.id, "scale", {
    input: { action: "read", id: row.id },
  });
  assert.deepEqual(result.value, row);
  return {
    durationMs: result.sdkRequestMs,
    correct: true,
    valueBytes: Buffer.byteLength(JSON.stringify(result.value)),
    passed: false,
    failures: ["indexed-point-access-unavailable", "owner-hydration-unmeasured"],
  };
};
