import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";
import { active, createFixture, definition, elapsed, fields } from "./fixture";
import {
  checkParity,
  indexInventory,
  querySql,
  type Representation,
  removeProjection,
  representations,
  scenarios,
  sizeInventory,
  timedInstallation,
} from "./projections";

const args = process.argv.slice(2);
const option = (name: string, fallback?: string) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  assert(args[index + 1] && !args[index + 1].startsWith("--"), `Missing value for ${name}`);
  return args[index + 1];
};
assert(args.includes("--out"), "Pass --out <report filesPath>; generated evidence must stay outside source");
const output = resolve(option("--out")!);
const count = Number(option("--count", "5000"));
const samples = Number(option("--samples", "12"));
assert(Number.isInteger(samples) && samples > 0);
await mkdir(output, { recursive: true });
const save = (name: string, value: unknown) => Bun.write(resolve(output, name), `${JSON.stringify(value, null, 2)}\n`);
const source = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const manifest = {
  source,
  baseline: "1e22f30df08f66b40743c63e3c8af4da8d6d3817",
  count,
  foobars: 5000,
  samples,
  started: new Date().toISOString(),
  host: {
    os: os.platform(),
    release: os.release(),
    arch: os.arch(),
    cpu: os.cpus()[0]?.model,
    memory: os.totalmem(),
    bun: Bun.version,
  },
  scope:
    "Disposable synthetic PGlite source diagnostic; not the historical PS-236 snapshot, a browser action benchmark, or V1–V5 qualification",
};
await save("manifest.json", manifest);
const f = await createFixture(count);
const ledger: unknown[] = [];
const record = async (entry: unknown) => {
  ledger.push(entry);
  await save("samples.json", ledger);
};

const board = async (bounded: boolean) => {
  const result = bounded
    ? await Promise.all([
        f.records.query({ index: definition.name, where: active, fields, limit: 100 }),
        f.records.aggregate({ index: definition.name, where: active, groupBy: ["statusId"] }),
      ])
    : await f.records.list();
  const encoded = JSON.stringify(result);
  return { result, bytes: Buffer.byteLength(encoded) };
};

const writes = async (kind: Representation, pass: number) => {
  const value = f.values[0];
  for (const [name, set] of [
    ["metadata", { "/statusId": pass % 2 ? "ready" : "backlog", "/priority": pass % 2 ? "high" : "normal" }],
    ["body", { "/content": `${value.content}\nSample ${pass}` }],
  ] as const) {
    const timed = await elapsed(() =>
      f.records.commit({ operationId: `${kind}-${name}-${pass}`, edits: [{ recordId: value.id, set }] }),
    );
    await record({ experiment: "E5", kind, phase: name, pass, ms: timed.ms });
    const [saved] = await f.records.readMany([value.id]);
    assert(saved.exists && !saved.deleted);
  }
  await f.records.commit({ operationId: `${kind}-restore-${pass}`, edits: [{ recordId: value.id, replace: value }] });
};

const projectionChecks = async (kind: Representation) => {
  const original = f.values[0];
  const created = { ...original, id: `created-${kind}`, position: "00000000" };
  await f.records.commit({ operationId: `${kind}-create-check`, edits: [{ recordId: created.id, replace: created }] });
  await checkParity(f, kind);
  await f.records.commit({ operationId: `${kind}-delete-check`, edits: [{ recordId: created.id, deleted: true }] });
  await checkParity(f, kind);
  await f.records.commit({
    operationId: `${kind}-archive-check`,
    edits: [{ recordId: original.id, set: { "/archived": true } }],
  });
  await checkParity(f, kind);
  await f.records.commit({
    operationId: `${kind}-restore-check`,
    edits: [{ recordId: original.id, replace: original }],
  });
  await assert.rejects(
    f.db.transaction(async (tx) => {
      await tx.execute(
        sql`UPDATE storage_current_records SET value=jsonb_set(value, '{archived}', 'true') WHERE workbench_id=${f.owner.workbenchId} AND extension_id=${f.owner.extensionId} AND record_id=${original.id}`,
      );
      throw new Error("intentional rollback");
    }),
    /intentional rollback/,
  );
  await checkParity(f, kind);
  // Prove rollback against canonical readback too, independently of parity.
  const [saved] = await f.records.readMany([original.id]);
  assert(saved.value && typeof saved.value === "object" && !Array.isArray(saved.value));
  assert.equal(saved.value.archived, false);
  if (kind !== "current") {
    const name = kind === "typed" ? "ps239_typed" : "ps239_compact";
    const before = (
      await f.db.execute(sql`SELECT ctid::text AS tuple FROM ${sql.identifier(name)} WHERE record_id=${original.id}`)
    ).rows;
    await f.records.commit({
      operationId: `${kind}-body-no-projection`,
      edits: [{ recordId: original.id, set: { "/content": `${original.content}\nbody-only` } }],
    });
    const after = (
      await f.db.execute(sql`SELECT ctid::text AS tuple FROM ${sql.identifier(name)} WHERE record_id=${original.id}`)
    ).rows;
    assert.deepEqual(before, after, "A body-only edit must not rewrite the compact query tuple");
    await f.records.commit({
      operationId: `${kind}-body-restore`,
      edits: [{ recordId: original.id, replace: original }],
    });
  }
};

try {
  // Keep first-run samples; alternate paired order without profiler work in the timing loop.
  for (let pass = 0; pass < samples; pass++) {
    for (const bounded of pass % 2 ? [true, false] : [false, true]) {
      const timed = await elapsed(() => board(bounded));
      await record({
        experiment: "E1",
        bounded,
        pass,
        ms: timed.ms,
        bytes: timed.value.bytes,
        materialized: bounded ? Math.min(100, count - Math.floor(count / 20)) : count,
        rss: process.memoryUsage().rss,
      });
    }
  }
  const first = await f.records.query({ index: definition.name, fields, where: active, limit: 100 });
  if (first.cursor) {
    const next = await f.records.query({
      index: definition.name,
      fields,
      where: active,
      limit: 100,
      cursor: first.cursor,
    });
    assert(!next.records.some((row) => first.records.some((old) => old.recordId === row.recordId)));
  }
  const tail = await f.records.query({
    index: definition.name,
    fields,
    where: { all: [active, { field: "id", op: "eq", value: f.values.at(-2)!.id }] },
    limit: 100,
  });
  assert.equal(tail.records[0]?.recordId, f.values.at(-2)!.id);
  for (let pass = 0; pass < samples; pass++) {
    for (const kind of pass % 2 ? [...representations].reverse() : representations) {
      if (kind !== "current") {
        const installed = await timedInstallation(f, kind);
        await record({ experiment: "E5", kind, phase: "backfill-and-index", pass, ms: installed.ms });
      }
      await checkParity(f, kind);
      for (const scenario of scenarios) {
        const timed = await elapsed(() => f.db.execute(querySql(f, kind, scenario)));
        await record({
          experiment: "E5",
          kind,
          phase: scenario,
          pass,
          ms: timed.ms,
          rows: timed.value.rows.length,
          bytes: Buffer.byteLength(JSON.stringify(timed.value.rows)),
        });
      }
      await writes(kind, pass);
      if (pass === samples - 1) {
        await projectionChecks(kind);
        await save(`indexes-${kind}.json`, await indexInventory(f));
        await save(`sizes-${kind}.json`, await sizeInventory(f));
        for (const scenario of scenarios)
          await save(
            `plan-${kind}-${scenario}.json`,
            (await f.db.execute(sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${querySql(f, kind, scenario)}`)).rows,
          );
      }
      if (kind !== "current") await removeProjection(f, kind);
    }
  }
  await save("correctness.json", {
    status: "passed",
    orderedIdsFieldsAndCounts: scenarios,
    canonicalCommitAndReadback: true,
    rollback: true,
    createArchiveDeleteParity: true,
    bodyOnlySidecarTupleUnchanged: true,
    nextPageAndTailSelection: true,
    typedScope: "ASCII scalar IDs with explicit null parents; missing and malformed scalars are not qualified",
    durability: "In-memory disposable PGlite; disk durability and restart not measured",
    writeScope: "Sidecar costs are incremental on top of canonical JSONB and its indexes",
    unrun: [
      "historical fixture parity",
      "browser actions",
      "true device sync",
      "persistent database restart",
      "permissions and malformed scalar conformance",
      "receiving/apply path",
      "relationship-rich board",
    ],
  });
} catch (error) {
  await save("failure.json", { message: String(error), stack: error instanceof Error ? error.stack : undefined });
  throw error;
} finally {
  await f.close();
  await save("manifest.json", { ...manifest, ended: new Date().toISOString() });
}
console.log(JSON.stringify({ output, count, samples, status: "passed" }));
